import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, PositionDirection } from '../../shared';
import {
  PlatformTradingStrategyPort,
  TradingDecision,
  ExitDecision,
  PlatformTradingParams,
} from '../../shared/ports/trading/PlatformTradingStrategyPort';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';
import {
  PredictionHorizon,
  Recommendation,
  TokenCategory,
} from '../../shared/models/predictor/types';
import { PerpService } from '../perps/Perp.service';

@Injectable()
export class HyperliquidTradingStrategyService extends PlatformTradingStrategyPort {
  private readonly logger = new Logger(HyperliquidTradingStrategyService.name);
  public readonly platform = Platform.HYPERLIQUID;

  constructor(
    private configService: ConfigService,
    private hyperliquidService: HyperliquidService,
    private perpService: PerpService,
    private predictorAdapter: PredictorAdapter,
  ) {
    super();
  }

  /**
   * Determine token category for prediction
   */
  private determineTokenCategory(tokenSymbol: string): TokenCategory {
    const mainCoins = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT'];

    if (mainCoins.includes(tokenSymbol.toUpperCase())) {
      return TokenCategory.MAIN_COINS;
    }

    return TokenCategory.ALT_COINS;
  }

  /**
   * Determine whether to enter a position based on AI predictions and market conditions
   */
  async shouldEnterPosition(
    token: string,
    tradingParams: PlatformTradingParams,
  ): Promise<TradingDecision> {
    try {
      const isEnabled = this.configService.get<boolean>('hyperliquid.enabled');
      if (!isEnabled) {
        return {
          shouldTrade: false,
          reason: 'Hyperliquid trading is disabled',
          confidence: 0,
          recommendedAmount: 0,
          metadata: { direction: PositionDirection.LONG },
        };
      }
      const perp = await this.perpService.findByToken(token);

      if (!perp) {
        this.logger.warn(`No perp found for token: ${token}`);
        return {
          shouldTrade: false,
          reason: `No perp definition found for ${token}`,
          confidence: 0,
          recommendedAmount: 0,
          metadata: { direction: PositionDirection.LONG },
        };
      }

      const tokenCategory = this.determineTokenCategory(token);

      const aiPrediction = await this.predictorAdapter.predictToken(
        token,
        tokenCategory,
        PredictionHorizon.ONE_HOUR,
        true,
      );

      const positions = await this.hyperliquidService.getPositions();
      const currentPositionCount = positions.filter(
        (p) => parseFloat(p.szi) !== 0,
      ).length;
      const maxPositions =
        tradingParams.maxOpenPositions ||
        this.configService.get<number>('hyperliquid.maxOpenPositions', 1);

      if (currentPositionCount >= maxPositions) {
        return {
          shouldTrade: false,
          reason: `Maximum positions reached (${currentPositionCount}/${maxPositions})`,
          confidence: 0,
          metadata: { direction: PositionDirection.LONG },
        };
      }

      if (aiPrediction) {
        const shouldEnter = aiPrediction.recommendation !== Recommendation.HOLD;
        const direction =
          aiPrediction.recommendation === Recommendation.BUY
            ? PositionDirection.LONG
            : PositionDirection.SHORT;

        return {
          shouldTrade: shouldEnter,
          reason: shouldEnter
            ? `AI recommends ${aiPrediction.recommendation} with ${aiPrediction.confidence.toFixed(2)} confidence`
            : 'AI recommends HOLD',
          confidence: aiPrediction.confidence,
          recommendedAmount: tradingParams.defaultAmountIn,
          metadata: {
            direction,
            aiPrediction: {
              recommendation: aiPrediction.recommendation,
              predictedChange: aiPrediction.percentage_change,
              confidence: aiPrediction.confidence,
            },
            leverage:
              perp.defaultLeverage ||
              tradingParams.defaultLeverage ||
              this.configService.get<number>('hyperliquid.defaultLeverage', 3),
          },
        };
      }

      // Fallback: use market direction if no AI prediction
      const ticker = await this.hyperliquidService.getTicker(token);
      const markPrice = parseFloat(ticker.mark);
      const bidPrice = parseFloat(ticker.bid);
      const askPrice = parseFloat(ticker.ask);

      // Simple momentum check
      const spread = (askPrice - bidPrice) / markPrice;
      const momentum = markPrice > (bidPrice + askPrice) / 2 ? 'UP' : 'DOWN';

      if (spread > 0.005) {
        // If spread is too wide (>0.5%), skip
        return {
          shouldTrade: false,
          reason: `Spread too wide (${(spread * 100).toFixed(2)}%)`,
          confidence: 0.3,
          metadata: { direction: PositionDirection.LONG },
        };
      }

      const direction =
        momentum === 'UP' ? PositionDirection.LONG : PositionDirection.SHORT;

      return {
        shouldTrade: true,
        reason: `Market momentum ${momentum}, entering ${direction}`,
        confidence: 0.5, // Lower confidence for non-AI based decisions
        recommendedAmount: tradingParams.defaultAmountIn,
        metadata: {
          direction,
          leverage:
            tradingParams.defaultLeverage ||
            this.configService.get<number>('hyperliquid.defaultLeverage', 3),
          markPrice,
          spread,
        },
      };
    } catch (error) {
      this.logger.error('Error in shouldEnterPosition', error);
      return {
        shouldTrade: false,
        reason: `Error evaluating position: ${error.message}`,
        confidence: 0,
        metadata: { direction: PositionDirection.LONG },
      };
    }
  }

  /**
   * Determine whether to exit an existing position
   */
  async shouldExitPosition(
    tradePosition: TradePositionDocument,
    tradingParams: PlatformTradingParams,
  ): Promise<ExitDecision> {
    const { token } = tradePosition;
    try {
      // Get current market data
      const ticker = await this.hyperliquidService.getTicker(token);
      const currentPrice = parseFloat(ticker.mark);

      // Calculate PnL
      const entryPrice = tradePosition.entryPrice || 0;
      const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      const isLong = tradePosition.positionDirection === PositionDirection.LONG;
      const adjustedPnlPercent = isLong ? pnlPercent : -pnlPercent;

      // Check stop loss
      const stopLossPercent =
        tradingParams.stopLossPercent ||
        this.configService.get<number>('hyperliquid.stopLossPercent', 10);
      if (adjustedPnlPercent <= -stopLossPercent) {
        return {
          shouldExit: true,
          reason: `Stop loss triggered (${adjustedPnlPercent.toFixed(2)}%)`,
          confidence: 1,
          urgency: 'high',
          metadata: {
            currentPrice,
            entryPrice,
            pnlPercent: adjustedPnlPercent,
          },
        };
      }

      // Check take profit
      const takeProfitPercent =
        tradingParams.takeProfitPercent ||
        this.configService.get<number>('hyperliquid.takeProfitPercent', 20);
      if (adjustedPnlPercent >= takeProfitPercent) {
        return {
          shouldExit: true,
          reason: `Take profit triggered (${adjustedPnlPercent.toFixed(2)}%)`,
          confidence: 0.9,
          urgency: 'medium',
          metadata: {
            currentPrice,
            entryPrice,
            pnlPercent: adjustedPnlPercent,
          },
        };
      }

      // Try to get AI prediction for exit decision
      try {
        const tokenCategory = this.determineTokenCategory(token);

        const aiPrediction = await this.predictorAdapter.predictToken(
          token,
          tokenCategory,
          PredictionHorizon.ONE_HOUR,
          true,
        );

        if (aiPrediction) {
          // Exit if AI prediction opposes current position
          const aiDirection =
            aiPrediction.recommendation === Recommendation.BUY
              ? PositionDirection.LONG
              : aiPrediction.recommendation === Recommendation.SELL
                ? PositionDirection.SHORT
                : null;

          if (aiDirection && aiDirection !== tradePosition.positionDirection) {
            return {
              shouldExit: true,
              reason: `AI recommends opposite direction (${aiPrediction.recommendation})`,
              confidence: aiPrediction.confidence,
              urgency: aiPrediction.confidence > 0.8 ? 'high' : 'medium',
              metadata: {
                currentPrice,
                entryPrice,
                pnlPercent: adjustedPnlPercent,
                aiPrediction: {
                  recommendation: aiPrediction.recommendation,
                  confidence: aiPrediction.confidence,
                  predictedChange: aiPrediction.percentage_change,
                },
              },
            };
          }

          // Exit if AI predicts significant adverse movement
          if (
            aiPrediction.recommendation === Recommendation.HOLD &&
            aiPrediction.percentage_change
          ) {
            const predictedAdverse = isLong
              ? aiPrediction.percentage_change < -5
              : aiPrediction.percentage_change > 5;

            if (predictedAdverse) {
              return {
                shouldExit: true,
                reason: `AI predicts adverse movement (${aiPrediction.percentage_change.toFixed(2)}%)`,
                confidence: aiPrediction.confidence * 0.7,
                urgency: 'medium',
                metadata: {
                  currentPrice,
                  entryPrice,
                  pnlPercent: adjustedPnlPercent,
                  predictedChange: aiPrediction.percentage_change,
                },
              };
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          'Failed to get AI prediction for exit decision',
          error,
        );
      }

      // No exit signal
      return {
        shouldExit: false,
        reason: 'Position within acceptable range',
        confidence: 0.5,
        urgency: 'low',
        metadata: {
          currentPrice,
          entryPrice,
          pnlPercent: adjustedPnlPercent,
        },
      };
    } catch (error) {
      this.logger.error('Error in shouldExitPosition', error);
      return {
        shouldExit: false,
        reason: `Error evaluating exit: ${error.message}`,
        confidence: 0.3,
        urgency: 'low',
      };
    }
  }

  /**
   * Get take profit price for a position
   */
  getTakeProfitPrice(
    tradePosition: TradePositionDocument,
    params: PlatformTradingParams,
  ): number {
    const entryPrice = tradePosition.entryPrice || 0;
    const takeProfitPercent =
      params.takeProfitPercent ||
      this.configService.get<number>('hyperliquid.takeProfitPercent', 20);

    const isLong = tradePosition.positionDirection === PositionDirection.LONG;
    const multiplier = isLong
      ? 1 + takeProfitPercent / 100
      : 1 - takeProfitPercent / 100;

    return entryPrice * multiplier;
  }

  /**
   * Get stop loss price for a position
   */
  getStopLossPrice(
    tradePosition: TradePositionDocument,
    params: PlatformTradingParams,
  ): number {
    const entryPrice = tradePosition.entryPrice || 0;
    const stopLossPercent =
      params.stopLossPercent ||
      this.configService.get<number>('hyperliquid.stopLossPercent', 10);

    const isLong = tradePosition.positionDirection === PositionDirection.LONG;
    const multiplier = isLong
      ? 1 - stopLossPercent / 100
      : 1 + stopLossPercent / 100;

    return entryPrice * multiplier;
  }

  /**
   * Get default trading parameters for Hyperliquid
   */
  getDefaultTradingParams(): PlatformTradingParams {
    return {
      maxOpenPositions: this.configService.get<number>(
        'hyperliquid.maxOpenPositions',
        1,
      ),
      defaultAmountIn: this.configService.get<number>(
        'hyperliquid.defaultAmountIn',
        100,
      ),
      stopLossPercent: this.configService.get<number>(
        'hyperliquid.stopLossPercent',
        10,
      ),
      takeProfitPercent: this.configService.get<number>(
        'hyperliquid.takeProfitPercent',
        20,
      ),
      defaultLeverage: this.configService.get<number>(
        'hyperliquid.defaultLeverage',
        3,
      ),
    };
  }
}
