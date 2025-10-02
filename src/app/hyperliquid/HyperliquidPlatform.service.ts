import { Injectable, Logger } from '@nestjs/common';
import {
  BasePlatformService,
  PositionDirection,
  PositionExecutionResult,
  PositionExecutionStatus,
} from '../../shared';
import { EnterPositionOptions, Platform, TradeType } from '../../shared';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

@Injectable()
export class HyperliquidPlatformService extends BasePlatformService {
  private readonly logger = new Logger(HyperliquidPlatformService.name);

  constructor(private readonly hyperliquidService?: HyperliquidService) {
    super();
  }

  async enterPosition(
    options: EnterPositionOptions,
  ): Promise<PositionExecutionResult> {
    const { platform, tradeType, currency, token, amountIn } = options;

    this.logger.log(`Executing Hyperliquid trade`, {
      platform,
      tradeType,
      currency,
      token,
      amountIn: amountIn.toString(),
    });

    try {
      if (options.platform !== Platform.HYPERLIQUID) {
        throw new Error(
          `Invalid platform for Hyperliquid service: ${options.platform}`,
        );
      }

      if (options.tradeType !== TradeType.PERPETUAL) {
        throw new Error(
          `Hyperliquid only supports perpetual futures trading, got: ${options.tradeType}`,
        );
      }

      const symbol = token;

      // Determine direction based on the trade
      // For perps, we're either going long or short on the base asset
      // amountIn represents the quote amount (USDC) we want to use
      const direction = this.determineDirection();

      const orderId = await this.hyperliquidService.placePerpOrder({
        symbol,
        direction,
        quoteAmount: options.amountIn,
        // Use market order by default (no price specified)
        tif: 'Ioc', // Immediate or Cancel for market-like execution
      });

      this.logger.log(`Hyperliquid order placed successfully`, {
        orderId,
        symbol,
        direction,
        quoteAmount: options.amountIn.toString(),
      });

      return {
        orderId,
        status: PositionExecutionStatus.SUCCESS,
        message: '',
      };
    } catch (error) {
      this.logger.error('Failed to execute Hyperliquid trade', error);

      return {
        orderId: '',
        status: PositionExecutionStatus.FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<PositionExecutionResult> {
    try {
      const { token, platform, positionDirection } = tradePosition;

      if (platform !== Platform.HYPERLIQUID) {
        throw new Error(
          `Invalid platform for Hyperliquid service: ${platform}`,
        );
      }

      const closeDirection =
        positionDirection === PositionDirection.LONG
          ? PositionDirection.SHORT
          : PositionDirection.LONG;

      // For closing, we need to use the current market price and size
      // The position size should be in base asset terms, but we need quote amount for the order
      const ticker = await this.hyperliquidService.getTicker(token);
      const currentPrice = parseFloat(ticker.mark);
      const positionSizeAbs = Math.abs(Number(tradePosition.positionSize || 0));
      const quoteAmount = BigInt(
        Math.floor(positionSizeAbs * currentPrice * 1000000),
      ); // Convert to USDC (6 decimals)

      this.logger.log(
        `Closing ${tradePosition.positionDirection} position for ${token}`,
        {
          closeDirection,
          positionSize: positionSizeAbs,
          currentPrice,
          quoteAmount: quoteAmount.toString(),
          platform,
        },
      );

      const orderId = await this.hyperliquidService.placePerpOrder({
        symbol: token,
        direction: closeDirection,
        quoteAmount,
        reduceOnly: true, // Ensure this order only reduces the position
        tif: 'Ioc', // Immediate or Cancel for market execution
      });

      this.logger.log(
        `Successfully placed closing order for ${token} position`,
      );

      return {
        orderId,
        status: PositionExecutionStatus.SUCCESS,
        message: '',
      };
    } catch (error) {
      this.logger.error('Failed to execute Hyperliquid trade', error);

      return {
        orderId: '',
        status: PositionExecutionStatus.FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private determineDirection(): PositionDirection {
    // TODO: finish this!
    // For now, we'll default to LONG
    // In a real implementation, you'd determine this based on:
    // - AI prediction/recommendation
    // - User preference
    // - Market analysis
    //
    // This could be extended to use additional fields in CreateTradeOptions
    // or be determined by the trading strategy
    return PositionDirection.LONG;
  }
}
