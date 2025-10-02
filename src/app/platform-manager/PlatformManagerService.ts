import { Injectable, Logger } from '@nestjs/common';
import {
  Platform,
  TradePositionStatus,
  HL_DEFAULT_CURRENCY_FROM,
  BasePlatformService,
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

  constructor(private readonly tradePositionService: TradePositionService) {
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
          defaultAmountIn: 100000000n, // 100 USDC
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

        const activeTokens = await tokenDiscovery.getTokensToTrade();

        for (const token of activeTokens) {
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
}
