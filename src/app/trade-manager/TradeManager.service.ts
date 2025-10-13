/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
  Platform,
  TradePositionStatus,
  TradeType,
  PositionDirection,
  PositionType,
  TradingOpportunity,
  TradingDecision,
  CreateTradePositionOptions,
  MAX_TOTAL_POSITIONS,
  TradeOrderStatus,
} from '../../shared';
import { IndexerAdapter } from '../../infrastructure';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { PlatformManagerService } from '../platform-manager/PlatformManagerService';
import { PerpService } from '../perps/Perp.service';
import { SettingsService } from '../settings/Settings.service';
import { TradeOrderService } from '../trade-order/TradeOrder.service';

@Injectable()
export class TradeManagerService implements OnApplicationBootstrap {
  private logger = new Logger(TradeManagerService.name);

  constructor(
    private tradePositionService: TradePositionService,
    private tradeOrderService: TradeOrderService,
    private indexerAdapter: IndexerAdapter,
    private platformManagerService: PlatformManagerService,
    private perpService: PerpService,
    private settingsService: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Starting trade manager on application bootstrap');
    try {
      await this.startTrading();
      this.logger.log('Successfully started trade manager');
    } catch (error) {
      this.logger.error('Failed to start trade manager', error);
    }
  }

  async startTrading(): Promise<void> {
    this.logger.log('Starting trading process');

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
        .map((op) => `${op.token} on ${op.platform}`)
        .join(', ')}`,
    );

    let remainingSlots = MAX_TOTAL_POSITIONS - currentOpenPositions.length;

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

      if (
        platformOpenPositions >= platformConfig.tradingParams.maxOpenPositions
      ) {
        this.logger.log(
          `Platform ${opportunity.platform} has reached max open positions (${platformConfig.tradingParams.maxOpenPositions})`,
        );
        continue;
      }

      try {
        await this.enterPosition(opportunity);
        remainingSlots--; // For now we presume the order is filled, we don't open other positions
      } catch (error) {
        this.logger.error(
          `Failed to submit trade order for ${opportunity.token} on ${opportunity.platform}:`,
          error,
        );
      }
    }
  }

  async monitorAndClosePositions(): Promise<void> {
    const tradePositions =
      await this.tradePositionService.getOpenTradePositions();

    const settings = await this.settingsService.getSettings();

    for (const tradePosition of tradePositions) {
      const { platform, token, exitFlag } = tradePosition;
      const priceResponse = await this.indexerAdapter.getLastPrice(token);
      if (!priceResponse) {
        this.logger.warn(`No price response for ${token}`);
        continue;
      }

      const { price } = priceResponse;

      const shouldClosePosition =
        settings.closeAllPositions ||
        exitFlag ||
        (await this.shouldClosePosition(tradePosition, price));

      if (shouldClosePosition) {
        try {
          this.logger.log(
            `Closing position for ${token} on ${platform}, flags; closeAllPositions:  ${settings.closeAllPositions}, exitFlag: ${exitFlag}`,
          );
          await this.exitPosition(tradePosition);
        } catch (error) {
          this.logger.error(`Failed to close position: ${error}`);
        }
      }
    }
  }

  /**
   * Determines whether a position should be closed based on various conditions
   * Checks traditional conditions first (cheaper to evaluate), then AI if needed
   * @param tradePosition - The trade position to evaluate
   * @param currentPrice - Current price (if available)
   * @returns Promise<boolean> - Whether the position should be closed
   */
  private async shouldClosePosition(
    tradePosition: TradePositionDocument,
    currentPrice: number,
  ): Promise<boolean> {
    const { token, platform } = tradePosition;

    const stopLossPrice = tradePosition.stopLossPrice ?? -1;
    const takeProfitPrice = tradePosition.takeProfitPrice ?? Number.MAX_VALUE;

    if (
      currentPrice &&
      (currentPrice < stopLossPrice || currentPrice > takeProfitPrice)
    ) {
      this.logger.log(
        `Closing position for ${token}: stop loss/take profit triggered (current: ${currentPrice}, stop loss: ${stopLossPrice}, take profit: ${takeProfitPrice})`,
      );
      return true;
    }

    try {
      if (
        !this.platformManagerService.getEnabledPlatforms().includes(platform)
      ) {
        this.logger.debug(
          `Skipping AI evaluation for ${token}: platform ${platform} not enabled`,
        );
        return false;
      }

      const exitDecision =
        await this.platformManagerService.evaluateExitDecision(tradePosition);

      if (exitDecision?.shouldExit) {
        if (exitDecision.reason === 'Error during evaluation') {
          this.logger.warn(
            `Ignoring AI exit recommendation for ${token}: based on evaluation error`,
          );
          return false;
        }

        this.logger.log(
          `AI recommends exiting position for ${token} on ${platform}: ${exitDecision.reason} (confidence: ${exitDecision.confidence}, urgency: ${exitDecision.urgency})`,
        );
        return true;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate AI exit decision for position ${token}:`,
        error,
      );
    }

    return false;
  }

  private async enterPosition(opportunity: TradingOpportunity): Promise<void> {
    const { platform, token, tradingDecision } = opportunity;

    this.logger.log(
      `Executing trading opportunity: ${token} on ${platform} (confidence: ${tradingDecision.confidence})`,
    );

    const tradeType = this.getTradeTypeForPlatform(platform);

    const platformService =
      this.platformManagerService.getPlatformService(platform);

    const platformConfig =
      this.platformManagerService.getPlatformConfiguration(platform);

    // Calculate SL/TP prices for perps
    let stopLossPrice: number | undefined;
    let takeProfitPrice: number | undefined;

    if (
      tradeType === TradeType.PERPETUAL &&
      tradingDecision.metadata?.direction
    ) {
      const currentPrice = await this.getCurrentPrice(platform, token);
      const direction = tradingDecision.metadata.direction as PositionDirection;
      const stopLossPercent =
        platformConfig.tradingParams.stopLossPercent || 10;
      const takeProfitPercent =
        platformConfig.tradingParams.takeProfitPercent || 20;

      if (direction === PositionDirection.LONG) {
        stopLossPrice = currentPrice * (1 - stopLossPercent / 100);
        takeProfitPrice = currentPrice * (1 + takeProfitPercent / 100);
      } else {
        stopLossPrice = currentPrice * (1 + stopLossPercent / 100);
        takeProfitPrice = currentPrice * (1 - takeProfitPercent / 100);
      }

      this.logger.log(
        `Calculated SL/TP prices for ${token}: SL=${stopLossPrice?.toFixed(4)}, TP=${takeProfitPrice?.toFixed(4)}`,
      );
    }

    const result = await platformService.enterPosition({
      platform,
      currency:
        this.platformManagerService.getPlatformConfiguration(platform)
          .defaultCurrencyFrom,
      token,
      amountIn: tradingDecision.recommendedAmount,
      tradeType,
      stopLossPrice,
      takeProfitPrice,
    });

    const { status, orderId, type, size, price } = result;

    if (status !== TradeOrderStatus.CREATED) {
      this.logger.error(
        `Failed to execute trading opportunity for ${token} on ${platform}:`,
        result,
      );
      throw new Error('Failed to enter position');
    }

    const tradePositionData = this.createTradePositionData(
      platform,
      token,
      tradingDecision,
      stopLossPrice,
      takeProfitPrice,
    );

    const tradePosition =
      await this.tradePositionService.createTradePosition(tradePositionData);

    // Determine side based on position direction for entry order
    const side =
      tradePositionData.positionDirection === PositionDirection.LONG
        ? 'B'
        : 'S';

    await this.tradeOrderService.createTradeOrder({
      status,
      position: String(tradePosition._id),
      type,
      orderId,
      coin: token,
      side,
      size,
      price,
    });

    // SL/TP orders will be created automatically by the WebSocket fill handler
    // when the entry order is confirmed filled. This eliminates the race condition
    // where we previously waited 500ms and hoped the order was filled.
    this.logger.log(
      `Position ${tradePosition._id} created for ${token}. SL/TP orders will be created upon fill confirmation.`,
    );

    if (tradeType === TradeType.PERPETUAL) {
      try {
        const perp = await this.perpService.findByToken(token);
        if (perp && perp.buyFlag) {
          await this.perpService.update(String(perp._id), { buyFlag: false });
          this.logger.log(
            `Successfully purchased perp ${token}, setting buyFlag to false`,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to reset buyFlag for perp ${token}:`, error);
        throw error;
      }
    }
  }

  private async exitPosition(position: TradePositionDocument): Promise<void> {
    const { platform, token, positionDirection } = position;

    this.logger.log(`Closing position: ${token} on ${platform}`);

    const platformService =
      this.platformManagerService.getPlatformService(platform);

    const result = await platformService.exitPosition(position);

    const { status, orderId, type, size, price } = result;

    if (status !== TradeOrderStatus.CREATED) {
      this.logger.error(
        `Failed to execute closing position order for ${token} on ${platform}:`,
        result,
      );
      throw new Error('Failed to close position');
    }

    // Determine side based on position direction for exit order (opposite of entry)
    const side = positionDirection === PositionDirection.LONG ? 'S' : 'B';

    await this.tradeOrderService.createTradeOrder({
      status,
      position: String(position._id),
      type,
      orderId,
      coin: token,
      side,
      size,
      price,
    });

    this.logger.log(`Successfully closed position: ${token} on ${platform}`);
  }

  private getTradeTypeForPlatform(platform: Platform): TradeType {
    switch (platform) {
      case Platform.HYPERLIQUID:
        return TradeType.PERPETUAL;
      default:
        return TradeType.PERPETUAL;
    }
  }

  private async getCurrentPrice(
    platform: Platform,
    token: string,
  ): Promise<number> {
    // Get current price from indexer
    try {
      const priceData = await this.indexerAdapter.getLastPrice(token);
      return priceData?.price || 0;
    } catch (error) {
      this.logger.warn(
        `Failed to get price from indexer for ${token}, using fallback: ${error}`,
      );

      // Fallback: get price from platform service
      const platformService =
        this.platformManagerService.getPlatformService(platform);
      if (platform === Platform.HYPERLIQUID) {
        const hyperliquidService = (platformService as any).hyperliquidService;
        if (hyperliquidService) {
          const ticker = await hyperliquidService.getTicker(token);
          return parseFloat(ticker.mark);
        }
      }

      throw new Error(`Failed to get current price for ${token}`);
    }
  }

  private createTradePositionData(
    platform: Platform,
    token: string,
    tradingDecision: TradingDecision,
    stopLossPrice?: number,
    takeProfitPrice?: number,
  ): CreateTradePositionOptions {
    const baseData = {
      currency:
        this.platformManagerService.getPlatformConfiguration(platform)
          .defaultCurrencyFrom,
      amountIn: tradingDecision.recommendedAmount,
      amountOut: 0,
      platform,
      status: TradePositionStatus.CREATED, // Position starts as CREATED, WebSocket will set to OPEN when filled
    };

    if (platform === Platform.HYPERLIQUID) {
      // Use metadata from trading decision for Hyperliquid positions
      return {
        ...baseData,
        positionType: PositionType.PERPETUAL,
        positionDirection:
          tradingDecision.metadata?.direction || PositionDirection.LONG,
        leverage: tradingDecision.metadata?.leverage || 3,
        positionSize: tradingDecision.recommendedAmount || 100, // Default 100 USDC
        // Entry price will be set by WebSocket handler when order fills
        token,
        // Store SL/TP prices - orders will be created by WebSocket handler after fill
        stopLossPrice,
        takeProfitPrice,
      };
    } else {
      //  DEX platforms
      return {
        ...baseData,
        token,
        positionType: PositionType.SPOT,
        // Entry price will be set by WebSocket handler when order fills
      };
    }
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
    positionSize: number | undefined,
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

    if (positionDirection === PositionDirection.LONG) {
      return (exitPrice - entryPrice) * positionSize;
    } else {
      return (entryPrice - exitPrice) * positionSize;
    }
  }
}
