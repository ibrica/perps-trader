import { Injectable, Logger } from '@nestjs/common';
import {
  Platform,
  TradePositionStatus,
  HL_DEFAULT_CURRENCY_FROM,
  PositionDirection,
} from '../../shared';
import {
  PlatformManagerPort,
  PlatformConfiguration,
  TradingOpportunity,
} from '../../shared/ports/trading/PlatformManagerPort';
import { PlatformTokenDiscoveryPort } from '../../shared/ports/trading/PlatformTokenDiscoveryPort';
import {
  PlatformTradingStrategyPort,
  ExitDecision,
} from '../../shared/ports/trading/PlatformTradingStrategyPort';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { TradePositionService } from '../trade-position/TradePosition.service';
import {
  PlatformWebSocketService,
  OrderFillCallback,
  BasePlatformService,
  IndexerAdapter,
} from '../../infrastructure';

@Injectable()
export class PlatformManagerService extends PlatformManagerPort {
  private readonly logger = new Logger(PlatformManagerService.name);

  private tokenDiscoveryServices = new Map<
    Platform,
    PlatformTokenDiscoveryPort
  >();
  private tradingStrategyServices = new Map<
    Platform,
    PlatformTradingStrategyPort
  >();
  private platformServices = new Map<Platform, BasePlatformService>();
  private platformConfigurations = new Map<Platform, PlatformConfiguration>();
  private webSocketServices = new Map<Platform, PlatformWebSocketService>();

  constructor(
    private readonly tradePositionService: TradePositionService,
    private readonly indexerAdapter: IndexerAdapter,
  ) {
    super();
    this.initializeDefaultConfigurations();
  }

  private initializeDefaultConfigurations(): void {
    const defaultConfigs: PlatformConfiguration[] = [
      {
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 1,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultCurrencyFrom: HL_DEFAULT_CURRENCY_FROM,
      },
    ];

    defaultConfigs.forEach((config) => {
      this.platformConfigurations.set(config.platform, config);
    });
  }

  registerPlatform(
    tokenDiscovery: PlatformTokenDiscoveryPort,
    tradingStrategy: PlatformTradingStrategyPort,
    platformService: BasePlatformService,
    webSocketService?: PlatformWebSocketService,
  ): void {
    const platform = tokenDiscovery.platform;

    if (platform !== tradingStrategy.platform) {
      throw new Error(
        `Platform mismatch: token discovery (${tokenDiscovery.platform}) != trading strategy (${tradingStrategy.platform})`,
      );
    }

    this.tokenDiscoveryServices.set(platform, tokenDiscovery);

    this.tradingStrategyServices.set(platform, tradingStrategy);

    this.platformServices.set(platform, platformService);

    if (webSocketService) {
      this.webSocketServices.set(platform, webSocketService);
      this.logger.log(`Registered WebSocket service for platform: ${platform}`);
    }

    this.logger.log(`Registered platform: ${platform}`);
  }

  getAvailablePlatforms(): Platform[] {
    return Array.from(this.tokenDiscoveryServices.keys());
  }

  getEnabledPlatforms(): Platform[] {
    return Array.from(this.platformConfigurations.entries())
      .filter(([, config]) => config.enabled)
      .map(([platform]) => platform);
  }

  async findTradingOpportunities(
    platforms?: Platform[],
  ): Promise<TradingOpportunity[]> {
    const targetPlatforms = platforms || this.getEnabledPlatforms();
    const opportunities: TradingOpportunity[] = [];

    for (const platform of targetPlatforms) {
      try {
        const tokenDiscovery = this.getTokenDiscoveryService(platform);
        const tradingStrategy = this.getTradingStrategyService(platform);
        const config = this.getPlatformConfiguration(platform);

        if (!config.enabled) {
          continue;
        }

        const tokensToTrade = await tokenDiscovery.getTokensToTrade();

        for (const token of tokensToTrade) {
          const existingPosition =
            await this.tradePositionService.getTradePositionByToken(
              token,
              TradePositionStatus.OPEN,
            );

          if (existingPosition) {
            this.logger.debug(
              `Skipping ${token} on ${platform} - already have open position`,
            );
            continue;
          }

          const tradingDecision = await tradingStrategy.shouldEnterPosition(
            token,
            config.tradingParams,
          );

          if (tradingDecision.shouldTrade) {
            opportunities.push({
              platform,
              token,
              tradingDecision,
            });
          }
        }
      } catch (error) {
        this.logger.error(
          `Error finding opportunities for platform ${platform}:`,
          error,
        );
      }
    }

    return opportunities;
  }

  async evaluateExitDecision(
    position: TradePositionDocument,
  ): Promise<ExitDecision> {
    const { platform } = position;

    const tradingStrategy = this.getTradingStrategyService(platform);
    const config = this.getPlatformConfiguration(platform);

    return tradingStrategy.shouldExitPosition(position, config.tradingParams);
  }

  getTokenDiscoveryService(platform: Platform): PlatformTokenDiscoveryPort {
    const service = this.tokenDiscoveryServices.get(platform);
    if (!service) {
      throw new Error(
        `Token discovery service not found for platform: ${platform}`,
      );
    }
    return service;
  }

  getTradingStrategyService(platform: Platform): PlatformTradingStrategyPort {
    const service = this.tradingStrategyServices.get(platform);
    if (!service) {
      throw new Error(
        `Trading strategy service not found for platform: ${platform}`,
      );
    }
    return service;
  }

  getPlatformService(platform: Platform): BasePlatformService {
    const service = this.platformServices.get(platform);
    if (!service) {
      throw new Error(`Platform service not found for platform: ${platform}`);
    }
    return service;
  }

  getPlatformConfiguration(platform: Platform): PlatformConfiguration {
    const config = this.platformConfigurations.get(platform);
    if (!config) {
      throw new Error(`Platform configuration not found for: ${platform}`);
    }
    return config;
  }

  async updatePlatformConfiguration(
    platform: Platform,
    configUpdate: Partial<PlatformConfiguration>,
  ): Promise<void> {
    const existingConfig = this.getPlatformConfiguration(platform);
    const updatedConfig = { ...existingConfig, ...configUpdate };

    this.platformConfigurations.set(platform, updatedConfig);
    this.logger.log(
      `Updated configuration for platform ${platform}:`,
      updatedConfig,
    );
  }

  /**
   * Register a callback for order fills across all platforms
   */
  registerOrderFillCallback(callback: OrderFillCallback): void {
    for (const [platform, wsService] of this.webSocketServices.entries()) {
      wsService.onOrderFill(callback);
      this.logger.log(
        `Registered order fill callback for platform: ${platform}`,
      );
    }
  }

  /**
   * Get WebSocket service for a specific platform
   */
  getWebSocketService(
    platform: Platform,
  ): PlatformWebSocketService | undefined {
    return this.webSocketServices.get(platform);
  }

  /**
   * Check if any platform has an active WebSocket connection
   */
  hasActiveWebSockets(): boolean {
    for (const wsService of this.webSocketServices.values()) {
      if (wsService.isConnected()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create stop-loss and take-profit orders for a platform
   * Delegates to platform-specific implementation
   */
  async createStopLossAndTakeProfitOrders(
    platform: Platform,
    token: string,
    direction: PositionDirection,
    size: number,
    positionId: string,
    stopLossPrice?: number,
    takeProfitPrice?: number,
  ): Promise<void> {
    const platformService = this.getPlatformService(platform);
    await platformService.createStopLossAndTakeProfitOrders(
      token,
      direction,
      size,
      positionId,
      stopLossPrice,
      takeProfitPrice,
    );
  }

  /**
   * Get current price for a token on a platform
   * Tries platform first, then falls back to indexer
   */
  async getCurrentPrice(platform: Platform, token: string): Promise<number> {
    // Try platform first
    try {
      const platformService = this.getPlatformService(platform);
      const price = await platformService.getCurrentPrice(token);
      if (price && price > 0) {
        return price;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to get price from platform for ${token}, trying indexer fallback: ${error}`,
      );
    }

    // Fallback to indexer if platform fails
    try {
      const priceData = await this.indexerAdapter.getLastPrice(token);
      if (priceData?.price && priceData.price > 0) {
        this.logger.debug(
          `Using indexer price for ${token}: ${priceData.price}`,
        );
        return priceData.price;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get price from indexer for ${token}: ${error}`,
      );
    }

    throw new Error(`Failed to get current price for ${token}`);
  }
}
