/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  BlockchainSymbol,
  isNil,
  Platform,
  SOL_MINT,
  TradePositionStatus,
  ItemExistsException,
  TradeNotification,
  TradeType,
  PositionDirection,
  PositionType,
  TradingOpportunity,
  UpdateTradePositionOptions,
  TradingDecision,
  CreateTradePositionOptions,
  PriceAndDate,
  Blockchain,
} from '../../shared';
import { TradeService } from '../trade/Trade.service';
import { OnEvent } from '@nestjs/event-emitter';
import { IndexerAdapter } from '../../infrastructure';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { PlatformManagerService } from '../platform-manager/PlatformManagerService';
import { TimeService } from '../../infrastructure/services/TimeService';
import { PerpService } from '../perps/Perp.service';

@Injectable()
export class TradeManagerService implements OnApplicationBootstrap {
  private logger = new Logger(TradeManagerService.name);

  constructor(
    private tradePositionService: TradePositionService,
    private tradeService: TradeService,
    private indexerAdapter: IndexerAdapter,
    private platformManagerService: PlatformManagerService,
    private perpService: PerpService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Starting multi-platform trading on application bootstrap');
    try {
      await this.startTrading();
      this.logger.log('Successfully started multi-platform trading');
    } catch (error) {
      this.logger.error('Failed to start multi-platform trading', error);
    }
  }

  @OnEvent(SUBSCRIPTION_EVENTS.TRADE_INDEXER)
  async handleTradeIndexerEvent(event: TradeNotification): Promise<void> {
    // Meme tokens only for now
    this.logger.debug('Trade for token event received', event);
    const tradePosition =
      await this.tradePositionService.getTradePositionByTokenMint(
        event.tokenMint,
        TradePositionStatus.OPEN,
      );

    if (isNil(tradePosition)) {
      this.logger.warn(
        `No open trade position found for token: ${event.tokenMint}`,
      );
      this.logger.log('unsubscribing from token monitoring', event.tokenMint);
      await this.safeUnsubscribe(event.tokenMint);
      return;
    }

    const exitDecisions =
      await this.platformManagerService.evaluateExitDecisions(
        [tradePosition],
        [tradePosition.platform],
      );

    if (exitDecisions.length > 0 && exitDecisions[0].decision.shouldExit) {
      const decision = exitDecisions[0].decision;
      this.logger.log(
        `Exiting position for ${tradePosition.tokenMint} on ${tradePosition.platform}: ${decision.reason} (confidence: ${decision.confidence}, urgency: ${decision.urgency})`,
      );

      // Fetch current price for accurate P&L calculation
      let currentPrice = tradePosition.currentPrice || 0;
      try {
        const priceAndDate = await this.getPriceForPosition(tradePosition);
        if (priceAndDate.price) {
          currentPrice = priceAndDate.price;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch current price for ${tradePosition.tokenMint}, using cached price: ${currentPrice}`,
          error,
        );
      }

      await this.closePosition(tradePosition, currentPrice);
      await this.startTrading();
    } else if (tradePosition.platform === Platform.PUMP_FUN) {
      // Update price for Pump.fun positions based on curve position
      const curvePosition = BigInt(event.trade.CurvePosition);
      const currentPrice = getPumpFunPriceFromCurvePosition(curvePosition);

      await this.tradePositionService.updateTradePosition(
        String(tradePosition._id),
        {
          currentPrice,
          timeLastPriceUpdate: new Date(),
        },
      );
    }
  }

  async startTrading(): Promise<void> {
    this.logger.log('Starting multi-platform trading process');

    const currentOpenPositions =
      await this.tradePositionService.getOpenTradePositions();
    this.logger.log(
      `Current number of open trade positions: ${currentOpenPositions.length}`,
    );

    const tradingOpportunities =
      await this.platformManagerService.findTradingOpportunities();

    if (tradingOpportunities.length === 0) {
      this.logger.warn('No trading opportunities found across all platforms');
      return;
    }

    this.logger.log(
      `Found ${tradingOpportunities.length} trading opportunities across platforms: ${tradingOpportunities
        .map((op) => `${op.tokenMintAddress} on ${op.platform}`)
        .join(', ')}`,
    );

    const maxTotalPositions = 10; // TODO: Make this configurable
    let remainingSlots = maxTotalPositions - currentOpenPositions.length;

    for (const opportunity of tradingOpportunities) {
      if (remainingSlots <= 0) {
        this.logger.log('General trading slot limit reached');
        break;
      }

      const platformConfig =
        this.platformManagerService.getPlatformConfiguration(
          opportunity.platform,
        );
      const platformOpenPositions = currentOpenPositions.filter(
        (pos) => pos.platform === opportunity.platform,
      ).length;

      if (platformOpenPositions >= platformConfig.maxOpenPositions) {
        this.logger.log(
          `Platform ${opportunity.platform} has reached max open positions (${platformConfig.maxOpenPositions})`,
        );
        continue;
      }

      try {
        await this.enterPosition(opportunity);
        remainingSlots--;
      } catch (error) {
        this.logger.error(
          `Failed to execute trading opportunity for ${opportunity.tokenMintAddress} on ${opportunity.platform}:`,
          error,
        );
      }
    }
  }

  private async enterPosition(opportunity: TradingOpportunity): Promise<void> {
    const { platform, tokenMintAddress, tradingDecision } = opportunity;

    this.logger.log(
      `Executing trading opportunity: ${tokenMintAddress} on ${platform} (confidence: ${tradingDecision.confidence})`,
    );

    // Execute the trade
    const tradeType = this.getTradeTypeForPlatform(platform);

    // Change this for perps
    await this.tradeService.executeTrade({
      platform,
      mintFrom:
        this.platformManagerService.getPlatformConfiguration(platform)
          .defaultMintFrom,
      mintTo: tokenMintAddress,
      amountIn: tradingDecision.recommendedAmount || 1000000000n, // Default 1 SOL
      blockchain: Blockchain.HYPERLIQUID,
      tradeType,
    });

    const tradePositionData = this.createTradePositionData(
      platform,
      tokenMintAddress,
      tradingDecision,
    );

    await this.tradePositionService.createTradePosition(tradePositionData);

    if (tradeType === TradeType.PERPETUAL) {
      try {
        const perp =
          await this.perpService.findByBaseAssetSymbol(tokenMintAddress);
        if (perp && perp.buyFlag) {
          await this.perpService.update(String(perp._id), { buyFlag: false });
          this.logger.log(
            `Successfully purchased perp ${tokenMintAddress}, setting buyFlag to false`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to reset buyFlag for perp ${tokenMintAddress}:`,
          error,
        );
      }
    }
  }

  async unsubscribeFromAllTokens(): Promise<void> {
    this.logger.log('Unsubscribing from all tokens');
    try {
      await this.indexerAdapter.unsubscribeFromAll();
    } catch (error) {
      this.logger.warn(`Failed to unsubscribe from all tokens: ${error}`);
    }
  }

  private async safeUnsubscribe(tokenMint: string): Promise<void> {
    try {
      if (
        this.indexerAdapter.isConnected() &&
        this.indexerAdapter.getSubscriptions().includes(tokenMint)
      ) {
        await this.indexerAdapter.unsubscribe(tokenMint);
      } else {
        this.logger.debug(
          `Token ${tokenMint} is not subscribed or WebSocket not connected, skipping unsubscribe`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to unsubscribe from token ${tokenMint}: ${error}`,
      );
    }
  }

  async monitorAndClosePositions(): Promise<number> {
    const tradePositions =
      await this.tradePositionService.getOpenTradePositions();
    const settings = await this.settingsService.getSettings();

    let nrOfOpenPositions = tradePositions.length;

    for (const tradePosition of tradePositions) {
      const priceAndDate = await this.getPriceForPosition(tradePosition);
      const { price, date } = priceAndDate;
      if (price && date) {
        await this.tradePositionService.updateTradePosition(
          String(tradePosition._id),
          { currentPrice: price, timeLastPriceUpdate: date },
        );
      }

      const shouldClosePosition = await this.shouldClosePosition(
        tradePosition,
        settings,
        price,
        date,
      );

      if (shouldClosePosition) {
        try {
          await this.closePosition(
            tradePosition,
            price || tradePosition.currentPrice || 0,
          );
          nrOfOpenPositions--;
        } catch (error) {
          this.logger.error(`Failed to close position: ${error}`);
        }
      }
    }

    return nrOfOpenPositions;
  }

  async closePosition(
    tradePosition: TradePositionDocument,
    price: number = 0,
  ): Promise<void> {
    // Handle platform-specific position closing
    if (tradePosition.positionType === PositionType.PERPETUAL) {
      await this.closePerpetualPosition(tradePosition, price);
      return;
    }

    // Handle spot trading positions (DEX platforms)
    const openTrades = await this.tradeService.getTradesByTradePosition(
      String(tradePosition._id),
    );

    for (const trade of openTrades) {
      await this.tradeService.executeTrade({
        platform: trade.platform,
        mintFrom: trade.mintTo,
        mintTo: trade.mintFrom,
        amountIn: trade.amountOut!,
        blockchain: String(trade.blockchain),
        tradeType: trade.tradeType,
      });
    }

    // Prepare update data based on position type
    const updateData: UpdateTradePositionOptions = {
      status: TradePositionStatus.CLOSED,
      timeClosed: new Date(),
      exitFlag: false,
    };

    // TODO: get real price from executed trade
    updateData.realizedPnl =
      this.calculateRealizedPnl(
        tradePosition.entryPrice,
        price,
        tradePosition.positionSize,
        tradePosition.positionDirection,
      ) ?? 0;

    await this.tradePositionService.updateTradePosition(
      String(tradePosition._id),
      updateData,
    );

    if (
      tradePosition.tokenMint &&
      tradePosition.platform === Platform.PUMP_FUN
    ) {
      this.logger.log(
        'unsubscribing from token monitoring',
        tradePosition.tokenMint,
      );
      await this.safeUnsubscribe(tradePosition.tokenMint);
    }
  }

  /**
   * Close a perpetual futures position by placing a reducing order
   */
  private async closePerpetualPosition(
    tradePosition: TradePositionDocument,
    price: number = 0,
  ): Promise<void> {
    try {
      const platform = tradePosition.platform;
      const tokenSymbol =
        tradePosition.baseAssetSymbol || tradePosition.tokenMint;

      if (!tokenSymbol) {
        throw new Error('No token symbol found for position');
      }

      if (platform === Platform.HYPERLIQUID) {
        // Get the trading strategy service which should have access to HyperliquidService
        const tradingStrategy =
          this.platformManagerService.getTradingStrategyService(platform);
        const hyperliquidService = (tradingStrategy as any).hyperliquidService;

        if (!hyperliquidService?.placePerpOrder) {
          throw new Error(
            'Hyperliquid service not available or does not support perpetual orders',
          );
        }

        // Determine the opposite direction to close the position
        const closeDirection =
          tradePosition.positionDirection === PositionDirection.LONG
            ? 'SHORT'
            : 'LONG';

        // For closing, we need to use the current market price and size
        // The position size should be in base asset terms, but we need quote amount for the order
        const ticker = await hyperliquidService.getTicker(tokenSymbol);
        const currentPrice = parseFloat(ticker.mark);
        const positionSizeAbs = Math.abs(
          Number(tradePosition.positionSize || 0),
        );
        const quoteAmount = BigInt(
          Math.floor(positionSizeAbs * currentPrice * 1000000),
        ); // Convert to USDC (6 decimals)

        this.logger.log(
          `Closing ${tradePosition.positionDirection} position for ${tokenSymbol}`,
          {
            closeDirection,
            positionSize: positionSizeAbs,
            currentPrice,
            quoteAmount: quoteAmount.toString(),
            platform,
          },
        );

        await hyperliquidService.placePerpOrder({
          symbol: tokenSymbol,
          direction: closeDirection,
          quoteAmount,
          reduceOnly: true, // Ensure this order only reduces the position
          tif: 'Ioc', // Immediate or Cancel for market execution
        });

        this.logger.log(
          `Successfully placed closing order for ${tokenSymbol} position`,
        );
      } else if (platform === Platform.DRIFT) {
        // TODO: Implement Drift position closing logic
        this.logger.warn(
          `Drift perpetual position closing not yet implemented`,
        );
        throw new Error('Drift perpetual position closing not yet implemented');
      } else {
        throw new Error(
          `Unsupported platform for perpetual position closing: ${platform}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to close perpetual position`, error);
      throw error;
    }
  }

  private getTradeTypeForPlatform(platform: Platform): TradeType {
    switch (platform) {
      case Platform.DRIFT:
      case Platform.HYPERLIQUID:
        return TradeType.PERPETUAL;
      default:
        return TradeType.PERPETUAL;
    }
  }

  private createTradePositionData(
    platform: Platform,
    tokenMintAddress: string,
    tradingDecision: TradingDecision,
  ): CreateTradePositionOptions {
    const baseData = {
      currencyMint: SOL_MINT,
      amountIn: tradingDecision.recommendedAmount || 1000000000n,
      amountOut: 0n,
      platform,
      status: TradePositionStatus.OPEN,
    };

    if (platform === Platform.DRIFT) {
      // Use metadata from trading decision for Drift positions
      const marketIndex = tradingDecision.metadata?.marketIndex || 1; // Default market index
      const defaultPrice = 0.0001; // Default entry price

      return {
        ...baseData,
        positionType: PositionType.PERPETUAL,
        positionDirection:
          tradingDecision.metadata?.direction || PositionDirection.LONG,
        marketIndex,
        leverage: tradingDecision.metadata?.leverage || 5,
        positionSize: tradingDecision.recommendedAmount || 1000000000n,
        entryPrice: defaultPrice,
        baseAssetSymbol: tokenMintAddress,
      };
    } else if (platform === Platform.HYPERLIQUID) {
      // Use metadata from trading decision for Hyperliquid positions
      const marketIndex = tradingDecision.metadata?.marketIndex || 0; // Default market index
      const defaultPrice = 0.0001; // Default entry price

      return {
        ...baseData,
        positionType: PositionType.PERPETUAL,
        positionDirection:
          tradingDecision.metadata?.direction || PositionDirection.LONG,
        marketIndex,
        leverage: tradingDecision.metadata?.leverage || 3,
        positionSize: tradingDecision.recommendedAmount || 100000000n, // Default 100 USDC
        entryPrice: defaultPrice,
        baseAssetSymbol: tokenMintAddress,
      };
    } else {
      // Other DEX platforms
      return {
        ...baseData,
        tokenMint: tokenMintAddress, // TODO: check for each platform how is it handling
        positionType: PositionType.SPOT,
        entryPrice: 0,
      };
    }
  }

  private async getPriceForPosition(
    tradePosition: TradePositionDocument,
  ): Promise<PriceAndDate> {
    let price: number | undefined;
    let date: Date | undefined;
    if (tradePosition.positionType === PositionType.PERPETUAL) {
      // For perpetual positions, get the actual current price
      try {
        if (
          tradePosition.platform === Platform.DRIFT &&
          tradePosition.marketIndex
        ) {
          const platformService =
            this.platformManagerService.getPlatformService(
              tradePosition.platform,
            );
          const priceData = await platformService.getMarketPrice(
            tradePosition.marketIndex,
          );
          // Use bid price for selling (closing long position) or ask price for buying (closing short position)
          price =
            tradePosition.positionDirection === PositionDirection.LONG
              ? priceData.bid
              : priceData.ask;
          date = new Date();
        } else if (
          tradePosition.platform === Platform.HYPERLIQUID &&
          tradePosition.marketIndex !== undefined
        ) {
          const platformService =
            this.platformManagerService.getPlatformService(
              tradePosition.platform,
            );
          const priceData = await platformService.getMarketPrice(
            tradePosition.marketIndex,
          );
          // Use bid price for selling (closing long position) or ask price for buying (closing short position)
          price =
            tradePosition.positionDirection === PositionDirection.LONG
              ? priceData.bid
              : priceData.ask;
          date = new Date();
        }
      } catch (error) {
        this.logger.log(
          `Failed to get current price for perpetual position mint ${tradePosition.tokenMint}: ${error}`,
        );
      }
    }

    // fallback to indexer if price is not available from platform service
    // TODO: correct later for launchpad positions
    if (isNil(price)) {
      const lastPriceResponse = await this.indexerAdapter.getLastPrice(
        tradePosition.tokenMint!,
      );
      price = lastPriceResponse.price;
      date = new Date(lastPriceResponse.timestamp);
    }

    return { price, date };
  }

  /**
   * Determines whether a position should be closed based on various conditions
   * Checks traditional conditions first (cheaper to evaluate), then AI if needed
   * @param tradePosition - The trade position to evaluate
   * @param settings - Current system settings
   * @param price - Current price (if available)
   * @param date - Current price date (if available)
   * @returns Promise<boolean> - Whether the position should be closed
   */
  private async shouldClosePosition(
    tradePosition: TradePositionDocument,
    settings: any,
    price?: number,
    date?: Date,
  ): Promise<boolean> {
    if (settings.closeAllPositions) {
      this.logger.log(
        `Closing position for ${tradePosition.tokenMint}: closeAllPositions setting enabled`,
      );
      return true;
    }

    if (tradePosition.exitFlag) {
      this.logger.log(
        `Closing position for ${tradePosition.tokenMint}: exitFlag is set`,
      );
      return true;
    }

    const stopLossPrice = tradePosition.stopLossPrice ?? -1;
    const takeProfitPrice = tradePosition.takeProfitPrice ?? Number.MAX_VALUE;
    const currentPrice = price ?? tradePosition.currentPrice ?? 0;

    const timePositionOpened =
      tradePosition.timeOpened ?? tradePosition.createdAt!;

    if (TimeService.isBeforeNow(timePositionOpened, 24 * 60)) {
      this.logger.log(
        `Closing position for ${tradePosition.tokenMint}: position too old (${timePositionOpened})`,
      );
      return true;
    }

    if (
      currentPrice &&
      (currentPrice < stopLossPrice || currentPrice > takeProfitPrice)
    ) {
      this.logger.log(
        `Closing position for ${tradePosition.tokenMint}: stop loss/take profit triggered (current: ${currentPrice}, stop loss: ${stopLossPrice}, take profit: ${takeProfitPrice})`,
      );
      return true;
    }

    try {
      const enabledPlatforms =
        this.platformManagerService.getEnabledPlatforms();
      if (!enabledPlatforms.includes(tradePosition.platform)) {
        this.logger.debug(
          `Skipping AI evaluation for ${tradePosition.tokenMint}: platform ${tradePosition.platform} not enabled`,
        );
        return false;
      }

      const exitDecisions =
        await this.platformManagerService.evaluateExitDecisions(
          [tradePosition],
          [tradePosition.platform],
        );

      if (exitDecisions.length > 0 && exitDecisions[0].decision.shouldExit) {
        const decision = exitDecisions[0].decision;
        if (decision.reason === 'Error during evaluation') {
          this.logger.warn(
            `Ignoring AI exit recommendation for ${tradePosition.tokenMint}: based on evaluation error`,
          );
          return false;
        }

        this.logger.log(
          `AI recommends exiting position for ${tradePosition.tokenMint} on ${tradePosition.platform}: ${decision.reason} (confidence: ${decision.confidence}, urgency: ${decision.urgency})`,
        );
        return true;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate AI exit decision for position ${tradePosition.tokenMint}:`,
        error,
      );
      // Continue without AI recommendation if it fails
    }

    return false;
  }

  /**
   * Calculates the realized P&L for a trade position
   * @param entryPrice - The entry price of the position
   * @param exitPrice - The current/exit price of the position
   * @param positionSize - The size of the position
   * @param positionDirection - The direction of the position (LONG or SHORT)
   * @returns The calculated P&L value, or 0 if any required parameters are missing
   */
  private calculateRealizedPnl(
    entryPrice: number | undefined,
    exitPrice: number | undefined,
    positionSize: bigint | undefined,
    positionDirection: PositionDirection | undefined,
  ): number | undefined {
    if (
      entryPrice == null ||
      exitPrice == null ||
      positionSize == null ||
      positionDirection == null
    ) {
      return undefined;
    }

    const positionSizeNumber = Number(positionSize); // TODO: check if this is correct for all platforms especially for perps

    if (positionDirection === PositionDirection.LONG) {
      return (exitPrice - entryPrice) * positionSizeNumber;
    } else {
      return (entryPrice - exitPrice) * positionSizeNumber;
    }
  }
}
