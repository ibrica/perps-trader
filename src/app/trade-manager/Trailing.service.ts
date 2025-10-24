import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { PositionDirection } from '../../shared';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';
import {
  PredictionHorizon,
  Recommendation,
  CoinCategory,
} from '../../shared/models/predictor/types';

export interface TrailingEvaluation {
  shouldTrail: boolean;
  newStopLossPrice?: number;
  newTakeProfitPrice?: number;
  reason: string;
  progressToTp?: number;
}

@Injectable()
export class TrailingService {
  private readonly logger = new Logger(TrailingService.name);

  constructor(
    private configService: ConfigService,
    private predictorAdapter: PredictorAdapter,
  ) {}

  /**
   * Evaluate whether a position should have its SL/TP trailed
   * Returns evaluation with new prices if trailing should occur
   */
  async evaluateTrailing(
    position: TradePositionDocument,
    currentPrice: number,
  ): Promise<TrailingEvaluation> {
    const {
      token,
      positionDirection,
      entryPrice,
      takeProfitPrice,
      lastTrailAt,
    } = position;

    // Validation checks
    if (!entryPrice || !takeProfitPrice) {
      return {
        shouldTrail: false,
        reason: 'Missing entry or take profit price',
      };
    }

    if (!currentPrice || currentPrice <= 0) {
      return {
        shouldTrail: false,
        reason: 'Invalid current price',
      };
    }

    // Calculate progress to TP
    const progressToTp = this.calculateProgressToTp(
      positionDirection,
      currentPrice,
      entryPrice,
      takeProfitPrice,
    );

    // Check if price is close enough to TP (80% threshold)
    const activationRatio = this.configService.get<number>(
      'hyperliquid.trailingActivationRatio',
      0.8,
    );

    if (progressToTp < activationRatio) {
      return {
        shouldTrail: false,
        reason: `Progress to TP (${(progressToTp * 100).toFixed(1)}%) below activation threshold (${(activationRatio * 100).toFixed(1)}%)`,
        progressToTp,
      };
    }

    // Check rate limiting
    const minIntervalMs = this.configService.get<number>(
      'hyperliquid.trailingMinIntervalMs',
      300000,
    );

    if (lastTrailAt) {
      const timeSinceLastTrail = Date.now() - lastTrailAt.getTime();
      if (timeSinceLastTrail < minIntervalMs) {
        return {
          shouldTrail: false,
          reason: `Rate limited: ${Math.round(timeSinceLastTrail / 1000)}s since last trail (min: ${minIntervalMs / 1000}s)`,
          progressToTp,
        };
      }
    }

    // Calculate new TP price
    const newTakeProfitPrice = this.calculateNewTakeProfit(
      positionDirection,
      currentPrice,
    );

    // Movement guard: only trail if new TP differs by >= 0.5%
    if (takeProfitPrice) {
      const tpChange = Math.abs(newTakeProfitPrice - takeProfitPrice);
      const tpChangePercent = (tpChange / takeProfitPrice) * 100;

      if (tpChangePercent < 0.5) {
        return {
          shouldTrail: false,
          reason: `TP movement too small (${tpChangePercent.toFixed(2)}% < 0.5%)`,
          progressToTp,
        };
      }
    }

    // Check AI continuation signal
    const aiContinuation = await this.checkAiContinuation(
      token,
      positionDirection,
    );

    if (!aiContinuation.shouldContinue) {
      return {
        shouldTrail: false,
        reason: `AI does not support continuation: ${aiContinuation.reason}`,
        progressToTp,
      };
    }

    // Calculate new SL price (DB only)
    const newStopLossPrice = this.calculateNewStopLoss(
      positionDirection,
      currentPrice,
    );

    // Validate new prices
    const validation = this.validateTrailingPrices(
      positionDirection,
      currentPrice,
      newStopLossPrice,
      newTakeProfitPrice,
    );

    if (!validation.valid) {
      return {
        shouldTrail: false,
        reason: `Price validation failed: ${validation.reason}`,
        progressToTp,
      };
    }

    return {
      shouldTrail: true,
      newStopLossPrice,
      newTakeProfitPrice,
      reason: `Trailing activated: progress=${(progressToTp * 100).toFixed(1)}%, AI=${aiContinuation.reason}`,
      progressToTp,
    };
  }

  /**
   * Calculate progress to take profit
   * Returns value between 0 and 1+ (can exceed 1 if price moves beyond TP)
   */
  private calculateProgressToTp(
    direction: PositionDirection,
    currentPrice: number,
    entryPrice: number,
    takeProfitPrice: number,
  ): number {
    if (direction === PositionDirection.LONG) {
      // LONG: (currentPrice - entryPrice) / (takeProfitPrice - entryPrice)
      const move = currentPrice - entryPrice;
      const target = takeProfitPrice - entryPrice;
      return target > 0 ? move / target : 0;
    } else {
      // SHORT: (entryPrice - currentPrice) / (entryPrice - takeProfitPrice)
      const move = entryPrice - currentPrice;
      const target = entryPrice - takeProfitPrice;
      return target > 0 ? move / target : 0;
    }
  }

  /**
   * Calculate new take profit price based on current price
   */
  private calculateNewTakeProfit(
    direction: PositionDirection,
    currentPrice: number,
  ): number {
    const tpOffsetPercent = this.configService.get<number>(
      'hyperliquid.trailingTpOffsetPercent',
      10,
    );

    if (direction === PositionDirection.LONG) {
      // LONG: New TP = currentPrice × (1 + 0.10)
      return currentPrice * (1 + tpOffsetPercent / 100);
    } else {
      // SHORT: New TP = currentPrice × (1 - 0.10)
      return currentPrice * (1 - tpOffsetPercent / 100);
    }
  }

  /**
   * Calculate new stop loss price based on current price
   */
  private calculateNewStopLoss(
    direction: PositionDirection,
    currentPrice: number,
  ): number {
    const slOffsetPercent = this.configService.get<number>(
      'hyperliquid.trailingStopOffsetPercent',
      2,
    );

    if (direction === PositionDirection.LONG) {
      // LONG: New SL = currentPrice × (1 - 0.02)
      return currentPrice * (1 - slOffsetPercent / 100);
    } else {
      // SHORT: New SL = currentPrice × (1 + 0.02)
      return currentPrice * (1 + slOffsetPercent / 100);
    }
  }

  /**
   * Check if AI prediction supports continuation in the same direction
   */
  private async checkAiContinuation(
    token: string,
    direction: PositionDirection,
  ): Promise<{ shouldContinue: boolean; reason: string }> {
    try {
      const coinCategory = this.determineCoinCategory(token);
      const minConfidence = this.configService.get<number>(
        'hyperliquid.predictorMinConfidence',
        0.6,
      );

      const prediction = await this.predictorAdapter.predictToken(
        token,
        coinCategory,
        PredictionHorizon.ONE_HOUR,
        true,
      );

      if (!prediction) {
        return {
          shouldContinue: false,
          reason: 'No AI prediction available',
        };
      }

      // Check confidence threshold
      if (prediction.confidence < minConfidence) {
        return {
          shouldContinue: false,
          reason: `AI confidence (${prediction.confidence.toFixed(2)}) below threshold (${minConfidence})`,
        };
      }

      // Check direction alignment
      if (direction === PositionDirection.LONG) {
        // LONG requires BUY or positive percentage_change
        const isBuy = prediction.recommendation === Recommendation.BUY;
        const isPositive =
          prediction.percentage_change && prediction.percentage_change > 0;

        if (isBuy || isPositive) {
          return {
            shouldContinue: true,
            reason: `AI ${prediction.recommendation} with ${prediction.confidence.toFixed(2)} confidence`,
          };
        }
      } else {
        // SHORT requires SELL or negative percentage_change
        const isSell = prediction.recommendation === Recommendation.SELL;
        const isNegative =
          prediction.percentage_change && prediction.percentage_change < 0;

        if (isSell || isNegative) {
          return {
            shouldContinue: true,
            reason: `AI ${prediction.recommendation} with ${prediction.confidence.toFixed(2)} confidence`,
          };
        }
      }

      return {
        shouldContinue: false,
        reason: `AI ${prediction.recommendation} does not align with ${direction} position`,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to check AI continuation for ${token}: ${error.message}`,
      );
      return {
        shouldContinue: false,
        reason: `AI check failed: ${error.message}`,
      };
    }
  }

  /**
   * Validate that new trailing prices are correct relative to current price
   */
  private validateTrailingPrices(
    direction: PositionDirection,
    currentPrice: number,
    newStopLoss: number,
    newTakeProfit: number,
  ): { valid: boolean; reason?: string } {
    if (direction === PositionDirection.LONG) {
      // LONG: SL < current < TP
      if (newStopLoss >= currentPrice) {
        return {
          valid: false,
          reason: `LONG SL (${newStopLoss.toFixed(4)}) must be below current (${currentPrice.toFixed(4)})`,
        };
      }
      if (newTakeProfit <= currentPrice) {
        return {
          valid: false,
          reason: `LONG TP (${newTakeProfit.toFixed(4)}) must be above current (${currentPrice.toFixed(4)})`,
        };
      }
    } else {
      // SHORT: TP < current < SL
      if (newStopLoss <= currentPrice) {
        return {
          valid: false,
          reason: `SHORT SL (${newStopLoss.toFixed(4)}) must be above current (${currentPrice.toFixed(4)})`,
        };
      }
      if (newTakeProfit >= currentPrice) {
        return {
          valid: false,
          reason: `SHORT TP (${newTakeProfit.toFixed(4)}) must be below current (${currentPrice.toFixed(4)})`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Determine coin category for prediction
   */
  private determineCoinCategory(tokenSymbol: string): CoinCategory {
    const mainCoins = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT'];

    if (mainCoins.includes(tokenSymbol.toUpperCase())) {
      return CoinCategory.MAIN_COINS;
    }

    return CoinCategory.ALT_COINS;
  }
}
