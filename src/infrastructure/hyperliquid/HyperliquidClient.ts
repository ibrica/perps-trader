import { Injectable, Logger } from '@nestjs/common';
import {
  Hyperliquid,
  type HyperliquidConfig,
  type Meta,
  type MetaAndAssetCtxs,
  type AllMids,
  type ClearinghouseState,
  type L2Book,
  type UserOpenOrders,
  type UserFills,
  type FundingHistory,
  type OrderResponse,
  type CancelOrderResponse,
  type OrderRequest,
  type Order,
  type BulkOrderRequest,
  type CancelOrderRequest,
} from 'hyperliquid';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';

export interface HyperliquidClientConfig {
  testnet?: boolean;
  privateKey?: string;
  walletAddress?: string;
  enableWs?: boolean;
  maxReconnectAttempts?: number;
}

export class HyperliquidError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = 'HyperliquidError';
  }
}

@Injectable()
export class HyperliquidClient {
  private readonly logger = new Logger(HyperliquidClient.name);
  private readonly sdk: Hyperliquid;
  private initialized = false;

  constructor(
    private readonly config: HyperliquidClientConfig,
    private readonly signatureAdapter?: HyperliquidSignatureAdapter,
  ) {
    const sdkConfig: HyperliquidConfig = {
      testnet: config.testnet || false,
      privateKey: config.privateKey,
      walletAddress: config.walletAddress,
      enableWs: config.enableWs || false,
      maxReconnectAttempts: config.maxReconnectAttempts || 3,
    };

    this.sdk = new Hyperliquid(sdkConfig);
  }

  /**
   * Initialize the SDK if not already done
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.sdk.connect();
      this.initialized = true;
      this.logger.log('Hyperliquid SDK initialized successfully');
    }
  }

  /**
   * Get the underlying SDK instance
   */
  getSdk(): Hyperliquid {
    return this.sdk;
  }

  /**
   * Check if the client is authenticated (has private key)
   */
  isAuthenticated(): boolean {
    return this.sdk.isAuthenticated();
  }

  /**
   * Get info endpoint data using the SDK
   */
  async getInfo(type: 'meta'): Promise<Meta>;
  async getInfo(type: 'metaAndAssetCtxs'): Promise<MetaAndAssetCtxs>;
  async getInfo(type: 'allMids'): Promise<AllMids>;
  async getInfo(
    type: 'userState',
    params: { user: string },
  ): Promise<ClearinghouseState>;
  async getInfo(type: 'l2Book', params: { coin: string }): Promise<L2Book>;
  async getInfo(
    type: 'openOrders',
    params: { user: string },
  ): Promise<UserOpenOrders>;
  async getInfo(
    type: 'userFills',
    params: { user: string },
  ): Promise<UserFills>;
  async getInfo(
    type: 'fundingHistory',
    params: { coin: string; startTime?: number; endTime?: number },
  ): Promise<FundingHistory>;
  async getInfo(
    type: string,
    params?: Record<string, unknown>,
  ): Promise<unknown> {
    await this.ensureInitialized();

    try {
      // Use SDK's info API methods based on type
      switch (type) {
        case 'meta':
          return await this.sdk.info.perpetuals.getMeta();
        case 'metaAndAssetCtxs':
          return await this.sdk.info.perpetuals.getMetaAndAssetCtxs();
        case 'allMids':
          return await this.sdk.info.getAllMids();
        case 'userState':
          if (!params?.user || typeof params.user !== 'string') {
            throw new HyperliquidError('User parameter required for userState');
          }
          return await this.sdk.info.perpetuals.getClearinghouseState(
            params.user,
          );
        case 'l2Book':
          if (!params?.coin || typeof params.coin !== 'string') {
            throw new HyperliquidError('Coin parameter required for l2Book');
          }
          return await this.sdk.info.getL2Book(params.coin);
        case 'openOrders':
          if (!params?.user || typeof params.user !== 'string') {
            throw new HyperliquidError(
              'User parameter required for openOrders',
            );
          }
          return await this.sdk.info.getUserOpenOrders(params.user);
        case 'userFills':
          if (!params?.user || typeof params.user !== 'string') {
            throw new HyperliquidError('User parameter required for userFills');
          }
          return await this.sdk.info.getUserFills(params.user);
        case 'fundingHistory':
          if (!params?.coin || typeof params.coin !== 'string') {
            throw new HyperliquidError(
              'Coin parameter required for fundingHistory',
            );
          }
          return await this.sdk.info.perpetuals.getFundingHistory(
            params.coin,
            typeof params.startTime === 'number' ? params.startTime : 0,
            typeof params.endTime === 'number' ? params.endTime : undefined,
          );
        default:
          this.logger.warn(`Unsupported info type: ${type}`);
          throw new HyperliquidError(`Unsupported info type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get info for type ${type}`, error);
      throw this.createErrorFromSdkError(error);
    }
  }

  /**
   * Execute exchange action using the SDK
   */
  async exchangeAction(action: {
    type: 'order';
    order: OrderRequest | Order | BulkOrderRequest;
  }): Promise<OrderResponse>;
  async exchangeAction(action: {
    type: 'cancel';
    cancels: unknown;
  }): Promise<CancelOrderResponse>;
  async exchangeAction(action: {
    type: 'updateLeverage';
    asset: string;
    isCross: boolean;
    leverage: number;
  }): Promise<unknown>;
  async exchangeAction(action: unknown): Promise<unknown> {
    await this.ensureInitialized();

    if (!this.sdk.isAuthenticated()) {
      throw new HyperliquidError(
        'Client not authenticated. Private key required for exchange actions.',
      );
    }

    try {
      const actionObj = action as Record<string, unknown>;
      switch (actionObj.type) {
        case 'order':
          const order = actionObj.order;
          if (!order) {
            throw new HyperliquidError('Order parameter is required');
          }
          const response = await this.sdk.exchange.placeOrder(
            order as OrderRequest | Order | BulkOrderRequest,
          );
          return response;
        case 'cancel':
          const cancels = actionObj.cancels;
          if (!cancels) {
            throw new HyperliquidError('Cancels parameter is required');
          }
          return await this.sdk.exchange.cancelOrder(
            cancels as CancelOrderRequest | CancelOrderRequest[],
          );
        case 'updateLeverage':
          // Convert action to SDK format
          const markets = await this.sdk.info.perpetuals.getMeta();
          const asset = actionObj.asset;
          if (typeof asset !== 'string') {
            throw new HyperliquidError('Asset must be a string');
          }
          const market = markets.universe[asset];
          if (!market) {
            throw new HyperliquidError(`Invalid asset index: ${asset}`);
          }

          const isCross = actionObj.isCross;
          if (typeof isCross !== 'boolean') {
            throw new HyperliquidError('isCross must be a boolean');
          }

          const leverage = actionObj.leverage;
          if (typeof leverage !== 'number') {
            throw new HyperliquidError('leverage must be a number');
          }
          return await this.sdk.exchange.updateLeverage(
            market.name,
            isCross ? 'cross' : 'isolated',
            leverage,
          );
        default:
          this.logger.warn(`Unsupported action type: ${actionObj.type}`);
          throw new HyperliquidError(
            `Unsupported action type: ${actionObj.type}`,
          );
      }
    } catch (error) {
      this.logger.error(`Failed to execute exchange action`, error);
      throw this.createErrorFromSdkError(error);
    }
  }

  /**
   * Create HyperliquidError from SDK error
   */
  private createErrorFromSdkError(error: unknown): HyperliquidError {
    if (error instanceof Error) {
      return new HyperliquidError(error.message, undefined, undefined, error);
    }

    return new HyperliquidError(
      typeof error === 'string' ? error : 'Unknown SDK error',
      undefined,
      undefined,
      error,
    );
  }
}
