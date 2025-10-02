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
  PositionExecutionStatus,
} from '../../shared';
import { IndexerAdapter } from '../../infrastructure';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { PlatformManagerService } from '../platform-manager/PlatformManagerService';
import { PerpService } from '../perps/Perp.service';
import { SettingsService } from '../settings/Settings.service';

@Injectable()
export class TradeManagerService implements OnApplicationBootstrap {
  private logger = new Logger(TradeManagerService.name);

  constructor(
    private tradePositionService: TradePositionService,
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
    this.logger.log('Starting  trading process');

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
        await this.enterPosition(opportunity); // TODO: check if try catch rethrows the error in platform service
        remainingSlots--;
      } catch (error) {
        this.logger.error(
          `Failed to execute trading opportunity for ${opportunity.token} on ${opportunity.platform}:`,
          error,
        );
      }
    }
  }

  async monitorAndClosePositions(): Promise<number> {
    const tradePositions =
      await this.tradePositionService.getOpenTradePositions();

    const settings = await this.settingsService.getSettings();

    let nrOfOpenPositions = tradePositions.length;

    for (const tradePosition of tradePositions) {
      const { platform, token, exitFlag } = tradePosition;
      // TODO: check what is happening when no price is available
      const priceResponse = await this.indexerAdapter.getLastPrice(token);

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
          await this.platformManagerService
            .getPlatformService(platform)
            .exitPosition(tradePosition);
          nrOfOpenPositions--;
        } catch (error) {
          this.logger.error(`Failed to close position: ${error}`);
        }
      }
    }

    return nrOfOpenPositions;
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
    const { token } = tradePosition;

    if (tradePosition.exitFlag) {
      this.logger.log(
        `Closing position for ${tradePosition.token}: exitFlag is set`,
      );
      return true;
    }

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
      const enabledPlatforms =
        this.platformManagerService.getEnabledPlatforms();
      if (!enabledPlatforms.includes(tradePosition.platform)) {
        this.logger.debug(
          `Skipping AI evaluation for ${token}: platform ${tradePosition.platform} not enabled`,
        );
        return false;
      }

      const exitDecisions =
        await this.platformManagerService.evaluateExitDecision(tradePosition);

      if (exitDecisions.length > 0 && exitDecisions[0].decision.shouldExit) {
        const decision = exitDecisions[0].decision;
        if (decision.reason === 'Error during evaluation') {
          this.logger.warn(
            `Ignoring AI exit recommendation for ${tradePosition.token}: based on evaluation error`,
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

  private async enterPosition(opportunity: TradingOpportunity): Promise<void> {
    const { platform, token, tradingDecision } = opportunity;

    this.logger.log(
      `Executing trading opportunity: ${token} on ${platform} (confidence: ${tradingDecision.confidence})`,
    );

    // Execute the trade
    const tradeType = this.getTradeTypeForPlatform(platform);

    const platformService =
      this.platformManagerService.getPlatformService(platform);

    // Change this for perps
    const result = await platformService.enterPosition({
      platform,
      currency:
        this.platformManagerService.getPlatformConfiguration(platform)
          .defaultCurrencyFrom,
      token,
      amountIn: tradingDecision.recommendedAmount,
      tradeType,
    });

    // TODO: pending state handling
    if (result.status !== PositionExecutionStatus.SUCCESS) {
      this.logger.error(
        `Failed to execute trading opportunity for ${token} on ${platform}:`,
        result,
      );
      return;
    }

    const tradePositionData = this.createTradePositionData(
      platform,
      token,
      tradingDecision,
    );

    await this.tradePositionService.createTradePosition(tradePositionData);

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
      }
    }
  }

  private getTradeTypeForPlatform(platform: Platform): TradeType {
    switch (platform) {
      case Platform.HYPERLIQUID:
        return TradeType.PERPETUAL;
      default:
        return TradeType.PERPETUAL;
    }
  }

  private createTradePositionData(
    platform: Platform,
    token: string,
    tradingDecision: TradingDecision,
  ): CreateTradePositionOptions {
    const baseData = {
      currency:
        this.platformManagerService.getPlatformConfiguration(platform)
          .defaultCurrencyFrom,
      amountIn: tradingDecision.recommendedAmount,
      amountOut: 0n,
      platform,
      status: TradePositionStatus.OPEN,
    };

    if (platform === Platform.HYPERLIQUID) {
      // Use metadata from trading decision for Hyperliquid positions
      const defaultPrice = 0.0001; // Default entry price

      return {
        ...baseData,
        positionType: PositionType.PERPETUAL,
        positionDirection:
          tradingDecision.metadata?.direction || PositionDirection.LONG,
        leverage: tradingDecision.metadata?.leverage || 3,
        positionSize: tradingDecision.recommendedAmount || 100000000n, // Default 100 USDC
        entryPrice: defaultPrice,
        token,
      };
    } else {
      //  DEX platforms
      return {
        ...baseData,
        token,
        positionType: PositionType.SPOT,
        entryPrice: 0,
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
