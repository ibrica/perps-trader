import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidClient, HyperliquidError } from './HyperliquidClient';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';
import {
  type ClearinghouseState,
  type AllMids,
  type L2Book,
  type Order,
  type FundingHistory,
} from 'hyperliquid';
import {
  HL_SYMBOL_MAP,
  HL_SYMBOL_REVERSE_MAP,
  HLMarket,
  HLTicker,
  HLOrderbook,
  PlacePerpOrderParams,
  HLOrderResponse,
  HLPosition,
  PositionDirection,
  TradeOrderResult,
  TradeOrderStatus,
} from '../../shared';

@Injectable()
export class HyperliquidService {
  private readonly logger = new Logger(HyperliquidService.name);
  private marketsCache: Map<string, HLMarket> = new Map();
  private lastMarketsFetch: number = 0;
  private readonly marketsCacheTtl = 60000; // 1 minute

  constructor(
    private readonly client: HyperliquidClient,
    private readonly configService: ConfigService,
    private readonly signatureAdapter: HyperliquidSignatureAdapter,
  ) {}

  /**
   * Get all available markets
   */
  async getMarkets(): Promise<HLMarket[]> {
    // Check cache
    if (
      this.marketsCache.size > 0 &&
      Date.now() - this.lastMarketsFetch < this.marketsCacheTtl
    ) {
      return Array.from(this.marketsCache.values());
    }

    try {
      const response = await this.client.getInfo('metaAndAssetCtxs');
      const markets = response[0]?.universe || [];

      // Enhance markets with additional properties for backward compatibility
      const enhancedMarkets = markets.map((market) => ({
        ...market,
        pxDecimals: 8, // Default price decimals
        minSize: 0.00001, // Default minimum size
      }));

      // Update cache
      this.marketsCache.clear();
      for (const market of enhancedMarkets) {
        this.marketsCache.set(market.name, market);
      }
      this.lastMarketsFetch = Date.now();
      return enhancedMarkets;
    } catch (error) {
      this.logger.error('Failed to fetch markets', error);
      throw error;
    }
  }

  /**
   * Get ticker for a symbol
   */
  async getTicker(symbol: string): Promise<HLTicker> {
    try {
      const mappedSymbol = this.mapSymbolToHL(symbol);
      const allMids: AllMids = await this.client.getInfo('allMids');
      const midPrice = allMids[mappedSymbol];

      if (!midPrice) {
        throw new HyperliquidError(`Ticker not found for symbol: ${symbol}`);
      }

      // Get additional market data from metaAndAssetCtxs for more complete ticker
      const [meta, assetCtxs] = await this.client.getInfo('metaAndAssetCtxs');
      const assetIndex = meta.universe.findIndex(
        (m) => m.name === mappedSymbol,
      );
      const assetCtx = assetCtxs[assetIndex];

      return {
        coin: mappedSymbol,
        bid: midPrice, // AllMids only provides mid price, so use it for bid/ask
        ask: midPrice,
        last: midPrice,
        mark: assetCtx?.markPx || midPrice,
        volume24h: assetCtx?.dayNtlVlm || '0',
        openInterest: assetCtx?.openInterest || '0',
        fundingRate: assetCtx?.funding || '0',
      };
    } catch (error) {
      this.logger.error(`Failed to fetch ticker for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Get orderbook for a symbol
   */
  async getOrderbook(symbol: string): Promise<HLOrderbook> {
    try {
      const mappedSymbol = this.mapSymbolToHL(symbol);
      const l2Book: L2Book = await this.client.getInfo('l2Book', {
        coin: mappedSymbol,
      });

      return {
        coin: mappedSymbol,
        levels: l2Book.levels || [[], []],
      };
    } catch (error) {
      this.logger.error(`Failed to fetch orderbook for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Place a perpetual order
   */
  async placePerpOrder(
    params: PlacePerpOrderParams,
  ): Promise<TradeOrderResult> {
    try {
      const mappedSymbol = this.mapSymbolToHL(params.symbol);
      const market = await this.getMarket(mappedSymbol);

      const ticker = await this.getTicker(params.symbol);
      const markPrice = parseFloat(ticker.mark);
      const baseSize = params.quoteAmount / markPrice;

      const roundedSize = this.roundToStep(baseSize, market.minSize || 0.001);

      // Fix precision to avoid floating point issues
      const sizePrecision = this.getSizePrecision(market.minSize || 0.001);
      const preciseSize = parseFloat(roundedSize.toFixed(sizePrecision));

      const minSize = market.minSize || 0.001;
      if (preciseSize < minSize) {
        throw new HyperliquidError(
          `Order size ${preciseSize} is below minimum ${minSize}`,
        );
      }

      const maxLeverage = this.configService.get<number>(
        'hyperliquid.maxLeveragePerSymbol',
        10,
      );
      const maxNotionalPerOrder = this.configService.get<number>(
        'hyperliquid.maxNotionalPerOrder',
        10000,
      );

      // Check leverage limit
      const requestedLeverage =
        params.leverage ||
        this.configService.get<number>('hyperliquid.defaultLeverage', 3);
      if (requestedLeverage > maxLeverage) {
        throw new HyperliquidError(
          `Requested leverage ${requestedLeverage}x exceeds maximum ${maxLeverage}x`,
        );
      }

      if (requestedLeverage > market.maxLeverage) {
        throw new HyperliquidError(
          `Requested leverage ${requestedLeverage}x exceeds market maximum ${market.maxLeverage}x`,
        );
      }

      const orderNotional = preciseSize * markPrice;
      if (orderNotional > maxNotionalPerOrder) {
        throw new HyperliquidError(
          `Order notional ${orderNotional.toFixed(2)} exceeds maximum ${maxNotionalPerOrder}`,
        );
      }

      const positions = await this.getPositions();
      const currentPositionCount = positions.filter(
        (p) => parseFloat(p.szi) !== 0,
      ).length;
      const maxOpenPositions = this.configService.get<number>(
        'hyperliquid.maxOpenPositions',
        1,
      );

      if (currentPositionCount >= maxOpenPositions) {
        throw new HyperliquidError(
          `Maximum open positions reached (${currentPositionCount}/${maxOpenPositions})`,
        );
      }

      const tif = params.tif || 'Gtc';
      const order: Order = {
        coin: mappedSymbol,
        is_buy: params.direction === PositionDirection.LONG,
        sz: preciseSize.toString(),
        limit_px: (params.price || markPrice).toString(),
        order_type:
          params.triggerPrice && params.triggerType
            ? {
                trigger: {
                  triggerPx: params.triggerPrice.toString(),
                  isMarket: params.isMarket ?? true,
                  tpsl: params.triggerType,
                },
              }
            : {
                limit: {
                  tif: tif,
                },
              },
        reduce_only: params.reduceOnly || false,
        ...(params.clientOrderId && { cloid: params.clientOrderId }),
      };

      if (params.leverage) {
        await this.updateLeverage(mappedSymbol, params.leverage);
      }

      const response: HLOrderResponse = await this.client.exchangeAction({
        type: 'order' as const,
        order,
      });

      const orderStatus = response?.response?.data?.statuses?.[0];
      const orderId = orderStatus?.resting?.oid || orderStatus?.filled?.oid;

      if (!orderId) {
        throw new HyperliquidError(`Failed to place order: error ${response}`);
      }

      this.logger.log(`Placed ${params.direction} order for ${params.symbol}`, {
        orderId,
        size: preciseSize,
        price: params.price || markPrice,
      });

      return {
        orderId: String(orderId),
        status: TradeOrderStatus.CREATED,
        size: preciseSize,
        price: markPrice, // TODO: check in the future, price and fee
        type: params.triggerType
          ? `trigger_${params.triggerType}`
          : String(tif),
        isTrigger: !!params.triggerPrice,
        triggerPrice: params.triggerPrice,
        triggerType: params.triggerType,
        isMarket: params.isMarket,
      };
    } catch (error) {
      this.logger.error('Failed to place perp order', error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol?: string): Promise<void> {
    try {
      const cancelRequest = {
        coin: symbol ? this.mapSymbolToHL(symbol) : '',
        o: parseInt(orderId, 10),
      };

      await this.client.exchangeAction({
        type: 'cancel',
        cancels: [cancelRequest],
      });
      this.logger.log(`Cancelled order ${orderId}`);
    } catch (error) {
      this.logger.error(`Failed to cancel order ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Cancel all orders for a symbol
   */
  async cancelAll(symbol?: string): Promise<number> {
    try {
      // Get open orders first to count them
      const sdk = this.client.getSdk();
      if (!sdk.isAuthenticated()) {
        throw new HyperliquidError(
          'Client not authenticated for canceling orders',
        );
      }

      // Use the SDK's custom operations to cancel all orders
      const response = await sdk.custom.cancelAllOrders(
        symbol ? this.mapSymbolToHL(symbol) : undefined,
      );
      const cancelledCount = response?.response?.data?.statuses?.length || 0;

      this.logger.log(`Cancelled ${cancelledCount} orders`);
      return cancelledCount;
    } catch (error) {
      this.logger.error('Failed to cancel all orders', error);
      throw error;
    }
  }

  /**
   * Get open positions
   */
  async getPositions(): Promise<HLPosition[]> {
    try {
      const sdk = this.client.getSdk();
      if (!sdk.isAuthenticated()) {
        throw new HyperliquidError(
          'Client not authenticated for getting positions',
        );
      }

      // Get wallet address from signature adapter
      const walletAddress = this.signatureAdapter.getPublicAddress();
      if (!walletAddress) {
        throw new HyperliquidError('No wallet address available');
      }

      const clearinghouse: ClearinghouseState = await this.client.getInfo(
        'userState',
        {
          user: walletAddress,
        },
      );

      const positions = clearinghouse.assetPositions || [];

      return positions.map((pos) => pos.position);
    } catch (error) {
      this.logger.error('Failed to fetch positions', error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ total: number; available: number }> {
    try {
      const sdk = this.client.getSdk();
      if (!sdk.isAuthenticated()) {
        throw new HyperliquidError(
          'Client not authenticated for getting balance',
        );
      }

      // Get wallet address from signature adapter
      const walletAddress = this.signatureAdapter.getPublicAddress();
      if (!walletAddress) {
        throw new HyperliquidError('No wallet address available');
      }

      const clearinghouse: ClearinghouseState = await this.client.getInfo(
        'userState',
        {
          user: walletAddress,
        },
      );

      const marginSummary = clearinghouse.marginSummary;

      return {
        total: parseFloat(marginSummary.accountValue || '0'),
        available: parseFloat(marginSummary.totalMarginUsed || '0'),
      };
    } catch (error) {
      this.logger.error('Failed to fetch balance', error);
      throw error;
    }
  }

  /**
   * Get funding rates
   */
  async getFundingRates(symbol?: string): Promise<FundingHistory> {
    try {
      if (!symbol) {
        // If no symbol provided, get predicted fundings for all
        const response = await this.client.getInfo('fundingHistory', {
          coin: 'BTC', // Default to BTC for now
          startTime: Date.now() - 86400000, // Last 24 hours
        });
        return response || [];
      }

      const mappedSymbol = this.mapSymbolToHL(symbol);
      const response = await this.client.getInfo('fundingHistory', {
        coin: mappedSymbol,
        startTime: Date.now() - 86400000, // Last 24 hours
      });
      return response || [];
    } catch (error) {
      this.logger.error('Failed to fetch funding rates', error);
      throw error;
    }
  }

  /**
   * Update leverage for a symbol
   */
  private async updateLeverage(
    symbol: string,
    leverage: number,
  ): Promise<void> {
    try {
      const leverageAction = {
        type: 'updateLeverage' as const,
        asset: symbol,
        isCross: true,
        leverage: leverage,
      };

      await this.client.exchangeAction(leverageAction);
      this.logger.log(`Updated leverage for ${symbol} to ${leverage}x`);
    } catch (error) {
      this.logger.error(`Failed to update leverage for ${symbol}`, error);
      throw error;
    }
  }

  /**
   * Get market info for a symbol
   */
  private async getMarket(symbol: string): Promise<HLMarket> {
    const markets = await this.getMarkets();
    const market = markets.find((m) => m.name === symbol);

    if (!market) {
      throw new HyperliquidError(`Market not found: ${symbol}`);
    }

    return market;
  }

  /**
   * Map internal symbol to Hyperliquid format
   */
  private mapSymbolToHL(symbol: string): string {
    return HL_SYMBOL_MAP[symbol] || symbol;
  }

  /**
   * Map Hyperliquid symbol to internal format
   */
  private mapSymbolFromHL(symbol: string): string {
    return HL_SYMBOL_REVERSE_MAP[symbol] || symbol;
  }

  /**
   * Round a number to the nearest step
   */
  private roundToStep(value: number, step: number): number {
    return Math.floor(value / step) * step;
  }

  /**
   * Calculate the number of decimal places needed for a given step size
   */
  private getSizePrecision(step: number): number {
    const stepStr = step.toString();
    if (stepStr.includes('e')) {
      // Handle scientific notation
      const parts = stepStr.split('e');
      return Math.abs(parseInt(parts[1]));
    }
    const decimalIndex = stepStr.indexOf('.');
    return decimalIndex === -1 ? 0 : stepStr.length - decimalIndex - 1;
  }

  /**
   * Get market price by market index (required by PlatformPriceService)
   */
  async getMarketPrice(
    marketIndex: number,
  ): Promise<{ bid: number; ask: number }> {
    const markets = await this.getMarkets();
    if (marketIndex >= markets.length || marketIndex < 0) {
      throw new HyperliquidError(`Invalid market index: ${marketIndex}`);
    }

    const market = markets[marketIndex];
    const symbol = this.mapSymbolFromHL(market.name);
    const ticker = await this.getTicker(symbol);

    return {
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
    };
  }

  /**
   * Get available markets (required by PlatformPriceService)
   */
  async getAvailableMarkets(): Promise<
    Array<{ marketIndex: number; baseAssetSymbol: string }>
  > {
    const markets = await this.getMarkets();

    return markets.map((market, index) => ({
      marketIndex: index,
      baseAssetSymbol: this.mapSymbolFromHL(market.name),
    }));
  }
}
