import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PositionDirection,
  TradeOrderResult,
  calculateQuoteAmount,
} from '../../shared';
import { EnterPositionOptions, Platform, TradeType } from '../../shared';
import { retryCallback } from '../../shared/utils/retryCallback';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import {
  OrderFill,
  BasePlatformService,
  PredictorAdapter,
} from '../../infrastructure';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { TradeOrderService } from '../trade-order/TradeOrder.service';
import { TradePositionService } from '../trade-position/TradePosition.service';

@Injectable()
export class HyperliquidPlatformService extends BasePlatformService {
  protected readonly logger = new Logger(HyperliquidPlatformService.name);

  constructor(
    private readonly configService: ConfigService,
    readonly predictorAdapter: PredictorAdapter,
    private readonly hyperliquidService?: HyperliquidService,
    private readonly hyperliquidWebSocket?: HyperliquidWebSocketService,
    private readonly tradeOrderService?: TradeOrderService,
    private readonly tradePositionService?: TradePositionService,
  ) {
    super(predictorAdapter);
    this.registerWebSocketHandlers();
  }

  /**
   * Validate order size against maximum notional amount
   * Throws error if order size exceeds configured limit
   */
  private validateOrderSize(quoteAmount: number, operation: string): void {
    const maxNotionalPerOrder = this.configService.get<number>(
      'hyperliquid.maxNotionalPerOrder',
      10000,
    );

    if (!quoteAmount || quoteAmount <= 0) {
      throw new Error(
        `Invalid order size for ${operation}: ${quoteAmount}. Must be positive.`,
      );
    }

    if (quoteAmount > maxNotionalPerOrder) {
      throw new Error(
        `Order size ${quoteAmount.toFixed(2)} for ${operation} exceeds maximum allowed ${maxNotionalPerOrder}. Rejecting order to prevent unintended large positions.`,
      );
    }

    this.logger.log(
      `Order size validation passed for ${operation}: ${quoteAmount.toFixed(2)} (max: ${maxNotionalPerOrder})`,
    );
  }

  /**
   * Register WebSocket handlers for order fills and updates
   */
  private registerWebSocketHandlers(): void {
    if (!this.hyperliquidWebSocket || !this.tradeOrderService) {
      return;
    }

    // Register handler for order fills
    this.hyperliquidWebSocket.onOrderFill(async (fill) => {
      await this.tradeOrderService.handleOrderFill(fill);
      // After handling the fill, check if we need to create SL/TP orders
      await this.handlePositionFillForSlTp(fill);
    });

    // Register handler for order updates
    this.hyperliquidWebSocket.onOrderUpdate((update) => {
      this.tradeOrderService.handleOrderUpdate(update);
    });

    this.logger.log(
      'WebSocket handlers registered for order fills and updates',
    );
  }

  /**
   * Handle position fill event and create SL/TP orders if needed
   * This is called after an entry order is filled
   * Optimized to reduce DB queries by fetching order with populated position
   */
  private async handlePositionFillForSlTp(fill: OrderFill): Promise<void> {
    try {
      if (!this.tradeOrderService || !this.tradePositionService) {
        return;
      }

      // Only process entry orders (not exit/reduce orders)
      if (fill.closedPnl && parseFloat(fill.closedPnl) !== 0) {
        return;
      }

      const order = await this.tradeOrderService.getByOrderId(fill.orderId, {
        queryOptions: { populate: 'position' },
      });
      if (!order) {
        return;
      }

      const position =
        typeof order.position === 'string'
          ? await this.tradePositionService.getTradePositionById(order.position)
          : order.position;

      if (!position) {
        return;
      }

      const hasSlTpPrices = position.stopLossPrice || position.takeProfitPrice;
      if (!hasSlTpPrices) {
        return;
      }

      const positionId = String(position._id);

      const hasSlTpOrders = await this.hasExistingSlTpOrders(positionId);

      if (!hasSlTpOrders) {
        this.logger.log(
          `Creating SL/TP orders for position ${positionId} after fill confirmation`,
        );

        await this.createStopLossAndTakeProfitOrders(
          position.token,
          position.positionDirection,
          parseFloat(fill.size),
          positionId,
          position.stopLossPrice,
          position.takeProfitPrice,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to handle position fill for SL/TP creation, falling  back to manual SL/TP',
        error,
      );
    }
  }

  /**
   * Check if position already has SL/TP trigger orders
   */
  private async hasExistingSlTpOrders(positionId: string): Promise<boolean> {
    try {
      // Query orders for this position that are trigger orders
      const orders = await this.tradeOrderService.getMany({
        position: positionId,
        isTrigger: true,
      });
      return orders.length > 0;
    } catch (error) {
      this.logger.warn(
        `Failed to check existing SL/TP orders for position ${positionId}`,
        error,
      );
      return false;
    }
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
      const direction = await this.determineDirection(token);
      if (!direction) {
        throw new Error(
          `Unable to determine trading direction for ${token}. No valid trend signals found.`,
        );
      }

      // Validate order size before placing order to prevent extremely large orders
      this.validateOrderSize(options.amountIn, 'entry position');

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
      throw error;
    }
  }

  /**
   * Create stop-loss and take-profit trigger orders after entering a position
   * This should be called after the position is created and we have the position ID
   * Uses actual filled size from exchange to ensure SL/TP matches real position
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

    // Query actual position size from exchange to handle partial fills
    // Use retry logic to handle exchange lag after fill
    let actualSize = size;
    const { result: exchangePosition, error: retryError } = await retryCallback(
      async () => {
        const position = await this.hyperliquidService.getPosition(token);
        if (!position || !position.szi) {
          throw new Error(`No position found for ${token}`);
        }
        return position;
      },
      {
        maxCount: 5,
        delayMs: 6000,
        logger: this.logger,
      },
    );

    if (exchangePosition && exchangePosition.szi) {
      actualSize = Math.abs(parseFloat(exchangePosition.szi));
      this.logger.log(
        `Using actual position size from exchange: ${actualSize} (requested: ${size})`,
      );
    } else {
      this.logger.warn(
        `No exchange position found for ${token} after retries, using requested size: ${size}`,
        retryError,
      );
    }

    // Get current ticker to calculate quote amount
    const ticker = await this.hyperliquidService.getTicker(token);
    const currentPrice = parseFloat(ticker.mark);
    const quoteAmount = calculateQuoteAmount(actualSize, currentPrice);

    this.logger.log(
      `Creating SL/TP orders for ${token}: size=${actualSize}, quoteAmount=${quoteAmount}`,
    );

    // Validate order size before placing SL/TP orders
    this.validateOrderSize(quoteAmount, 'stop-loss/take-profit');

    // Determine the opposite direction for closing orders
    const closeDirection =
      direction === PositionDirection.LONG
        ? PositionDirection.SHORT
        : PositionDirection.LONG;

    // Validate trigger prices before placing orders
    if (stopLossPrice) {
      if (
        direction === PositionDirection.LONG &&
        stopLossPrice >= currentPrice
      ) {
        throw new Error(
          `Invalid SL price ${stopLossPrice} for LONG (current: ${currentPrice})`,
        );
      }
      if (
        direction === PositionDirection.SHORT &&
        stopLossPrice <= currentPrice
      ) {
        throw new Error(
          `Invalid SL price ${stopLossPrice} for SHORT (current: ${currentPrice})`,
        );
      }
    }

    if (takeProfitPrice) {
      if (
        direction === PositionDirection.LONG &&
        takeProfitPrice <= currentPrice
      ) {
        throw new Error(
          `Invalid TP price ${takeProfitPrice} for LONG (current: ${currentPrice})`,
        );
      }
      if (
        direction === PositionDirection.SHORT &&
        takeProfitPrice >= currentPrice
      ) {
        throw new Error(
          `Invalid TP price ${takeProfitPrice} for SHORT (current: ${currentPrice})`,
        );
      }
    }

    // Create SL and TP orders in parallel to reduce latency
    const [slResult, tpResult] = await Promise.all([
      stopLossPrice
        ? this.hyperliquidService
            .placePerpOrder({
              symbol: token,
              direction: closeDirection,
              quoteAmount,
              triggerPrice: stopLossPrice,
              triggerType: 'sl',
              isMarket: true,
              reduceOnly: true,
            })
            .catch((error) => {
              this.logger.error('Failed to create stop-loss order', error);
              throw error;
            })
        : Promise.resolve(null),
      takeProfitPrice
        ? this.hyperliquidService
            .placePerpOrder({
              symbol: token,
              direction: closeDirection,
              quoteAmount,
              triggerPrice: takeProfitPrice,
              triggerType: 'tp',
              isMarket: true,
              reduceOnly: true,
            })
            .catch((error) => {
              this.logger.error('Failed to create take-profit order', error);
              throw error;
            })
        : Promise.resolve(null),
    ]);

    // Save SL order to database
    if (slResult?.orderId && this.tradeOrderService) {
      this.logger.log(`Stop-loss order created`, {
        orderId: slResult.orderId,
        token,
        triggerPrice: stopLossPrice,
      });

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

    if (tpResult?.orderId && this.tradeOrderService) {
      this.logger.log(`Take-profit order created`, {
        orderId: tpResult.orderId,
        token,
        triggerPrice: takeProfitPrice,
      });

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
  }

  async getCurrentPrice(token: string): Promise<number> {
    const ticker = await this.hyperliquidService.getTicker(token);
    return parseFloat(ticker.mark);
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

      // Use remaining size from position (accounts for partial fills)
      // Fall back to totalFilledSize if remainingSize not set
      let positionSizeToClose =
        tradePosition.remainingSize ||
        tradePosition.totalFilledSize ||
        Math.abs(tradePosition.positionSize || 0);

      // Query exchange for actual position size to be extra safe
      try {
        const exchangePosition =
          await this.hyperliquidService.getPosition(token);
        if (exchangePosition && exchangePosition.szi) {
          const exchangeSize = Math.abs(parseFloat(exchangePosition.szi));
          if (exchangeSize > 0) {
            this.logger.log(
              `Using actual position size from exchange: ${exchangeSize} (DB: ${positionSizeToClose})`,
            );
            positionSizeToClose = exchangeSize;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch exchange position for ${token}, using DB size: ${positionSizeToClose}`,
          error,
        );
      }

      // For closing, we need to use the current market price and size
      // The position size should be in base asset terms, but we need quote amount for the order
      const ticker = await this.hyperliquidService.getTicker(token);
      const currentPrice = parseFloat(ticker.mark);
      const quoteAmount = calculateQuoteAmount(
        positionSizeToClose,
        currentPrice,
      );

      this.logger.log(
        `Closing ${tradePosition.positionDirection} position for ${token}`,
        {
          closeDirection,
          positionSize: positionSizeToClose,
          currentPrice,
          quoteAmount,
          platform,
        },
      );

      // Validate order size before placing closing order
      this.validateOrderSize(quoteAmount, 'exit position');

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
      throw error;
    }
  }
}
