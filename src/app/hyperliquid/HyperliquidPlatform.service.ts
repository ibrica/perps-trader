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
    const {
      platform,
      tradeType,
      currency,
      token,
      amountIn,
      stopLossPrice,
      takeProfitPrice,
    } = options;

    this.logger.log(`Executing Hyperliquid trade`, {
      platform,
      tradeType,
      currency,
      token,
      amountIn,
      stopLossPrice,
      takeProfitPrice,
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

      // Store entry order result with SL/TP info for later use
      return {
        orderId,
        status,
        size,
        price,
        fee,
        type,
        message: '',
        // Pass SL/TP info so caller can create orders after position is created
        metadata: {
          direction,
          stopLossPrice,
          takeProfitPrice,
        },
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

  /**
   * Create stop-loss and take-profit trigger orders after entering a position
   * This should be called after the position is created and we have the position ID
   */
  async createStopLossAndTakeProfitOrders(
    token: string,
    direction: PositionDirection,
    size: number,
    positionId: string,
    stopLossPrice?: number,
    takeProfitPrice?: number,
  ): Promise<void> {
    if (!stopLossPrice && !takeProfitPrice) {
      return;
    }

    // Get current ticker to calculate quote amount
    const ticker = await this.hyperliquidService.getTicker(token);
    const currentPrice = parseFloat(ticker.mark);
    const quoteAmount = size * currentPrice;

    // Determine the opposite direction for closing orders
    const closeDirection =
      direction === PositionDirection.LONG
        ? PositionDirection.SHORT
        : PositionDirection.LONG;

    // Create stop-loss order
    if (stopLossPrice) {
      try {
        const slResult = await this.hyperliquidService.placePerpOrder({
          symbol: token,
          direction: closeDirection,
          quoteAmount,
          triggerPrice: stopLossPrice,
          triggerType: 'sl',
          isMarket: true,
          reduceOnly: true,
        });

        this.logger.log(`Stop-loss order created`, {
          orderId: slResult.orderId,
          token,
          triggerPrice: stopLossPrice,
        });

        // Save SL order to database
        if (slResult.orderId && this.tradeOrderService) {
          await this.tradeOrderService.createTradeOrder({
            orderId: slResult.orderId,
            status: slResult.status,
            position: positionId,
            type: slResult.type || 'trigger_sl',
            coin: token,
            side: closeDirection,
            size: slResult.size,
            price: slResult.price,
            isTrigger: true,
            triggerPrice: stopLossPrice,
            triggerType: 'sl',
            isMarket: true,
          });
        }
      } catch (error) {
        this.logger.error('Failed to create stop-loss order', error);
        throw error;
      }
    }

    // Create take-profit order
    if (takeProfitPrice) {
      try {
        const tpResult = await this.hyperliquidService.placePerpOrder({
          symbol: token,
          direction: closeDirection,
          quoteAmount,
          triggerPrice: takeProfitPrice,
          triggerType: 'tp',
          isMarket: true,
          reduceOnly: true,
        });

        this.logger.log(`Take-profit order created`, {
          orderId: tpResult.orderId,
          token,
          triggerPrice: takeProfitPrice,
        });

        // Save TP order to database
        if (tpResult.orderId && this.tradeOrderService) {
          await this.tradeOrderService.createTradeOrder({
            orderId: tpResult.orderId,
            status: tpResult.status,
            position: positionId,
            type: tpResult.type || 'trigger_tp',
            coin: token,
            side: closeDirection,
            size: tpResult.size,
            price: tpResult.price,
            isTrigger: true,
            triggerPrice: takeProfitPrice,
            triggerType: 'tp',
            isMarket: true,
          });
        }
      } catch (error) {
        this.logger.error('Failed to create take-profit order', error);
        throw error;
      }
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
      const positionSizeAbs = Math.abs(tradePosition.positionSize || 0);
      const quoteAmount = positionSizeAbs * currentPrice;

      this.logger.log(
        `Closing ${tradePosition.positionDirection} position for ${token}`,
        {
          closeDirection,
          positionSize: positionSizeAbs,
          currentPrice,
          quoteAmount,
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
