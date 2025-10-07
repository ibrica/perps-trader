import { Injectable, Logger } from '@nestjs/common';
import {
  BasePlatformService,
  PositionDirection,
  TradeOrderResult,
  TradeOrderStatus,
} from '../../shared';
import { EnterPositionOptions, Platform, TradeType } from '../../shared';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { TradeOrderService } from '../trade-order/TradeOrder.service';

@Injectable()
export class HyperliquidPlatformService extends BasePlatformService {
  private readonly logger = new Logger(HyperliquidPlatformService.name);

  constructor(
    private readonly hyperliquidService?: HyperliquidService,
    private readonly hyperliquidWebSocket?: HyperliquidWebSocketService,
    private readonly tradeOrderService?: TradeOrderService,
  ) {
    super();
    this.registerWebSocketHandlers();
  }

  /**
   * Register WebSocket handlers for order fills and updates
   */
  private registerWebSocketHandlers(): void {
    if (!this.hyperliquidWebSocket || !this.tradeOrderService) {
      return;
    }

    // Register handler for order fills
    this.hyperliquidWebSocket.onOrderFill((fill) => {
      this.tradeOrderService.handleOrderFill(fill);
    });

    // Register handler for order updates
    this.hyperliquidWebSocket.onOrderUpdate((update) => {
      this.tradeOrderService.handleOrderUpdate(update);
    });

    this.logger.log(
      'WebSocket handlers registered for order fills and updates',
    );
  }

  async enterPosition(
    options: EnterPositionOptions,
  ): Promise<TradeOrderResult> {
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

      // Determine direction based on the trade
      // For perps, we're either going long or short on the base asset
      // amountIn represents the quote amount (USDC) we want to use
      const direction = this.determineDirection();

      const tradeOrderResult = await this.hyperliquidService.placePerpOrder({
        symbol: token,
        direction,
        quoteAmount: options.amountIn,
        // Use market order by default (no price specified)
        tif: 'Ioc', // Immediate or Cancel for market-like execution
      });

      const { orderId, status, size, price, fee, type } = tradeOrderResult;

      this.logger.log(`Hyperliquid order placed successfully`, {
        orderId,
        token,
        direction,
        size,
      });

      return {
        orderId,
        status,
        size,
        price,
        fee,
        type,
        message: '',
      };
    } catch (error) {
      this.logger.error('Failed to execute Hyperliquid trade', error);

      return {
        orderId: '',
        status: TradeOrderStatus.FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<TradeOrderResult> {
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

      const tradeOrderResult = await this.hyperliquidService.placePerpOrder({
        symbol: token,
        direction: closeDirection,
        quoteAmount,
        reduceOnly: true, // Ensure this order only reduces the position
        tif: 'Ioc', // Immediate or Cancel for market execution
      });

      const { orderId, status, size, price, fee, type } = tradeOrderResult;

      this.logger.log(
        `Successfully placed closing order for ${token} position`,
        { orderId, size, price },
      );

      return {
        orderId,
        status,
        size,
        price,
        fee,
        type,
        message: '',
      };
    } catch (error) {
      this.logger.error('Failed to execute Hyperliquid trade', error);

      return {
        orderId: '',
        status: TradeOrderStatus.FAILED,
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
