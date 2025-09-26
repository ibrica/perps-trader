import { Injectable, Logger } from '@nestjs/common';
import { Platform } from '../../shared/models/trade/Platform';
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
import { TradePositionStatus } from '../../shared/constants/TradePositionStatus';
import { HL_DEFAULT_MINT_FROM, SOL_MINT } from '../../shared';

// Import the PlatformPriceService interface
interface PlatformPriceService {
  getMarketPrice(marketIndex: number): Promise<{ bid: number; ask: number }>;
  getAvailableMarkets(): Promise<
    Array<{ marketIndex: number; baseAssetSymbol: string }>
  >;
}

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
  private platformServices = new Map<Platform, PlatformPriceService>();
  private platformConfigurations = new Map<Platform, PlatformConfiguration>();

  constructor(private readonly tradePositionService: TradePositionService) {
    super();
    this.initializeDefaultConfigurations();
  }

  private initializeDefaultConfigurations(): void {
    const defaultConfigs: PlatformConfiguration[] = [
      {
        platform: Platform.PUMP_FUN,
        enabled: false, // TODO: read this from the env or even from db in future, or maybe just in separate file so it is easy to configure
        priority: 3,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 5,
          defaultAmountIn: 1000000000n, // 1 SOL
          stopLossPercent: 20,
          takeProfitPercent: 30,
        },
        defaultMintFrom: SOL_MINT,
      },
      {
        platform: Platform.RAYDIUM,
        enabled: false, // Disabled by default until implementation is complete
        priority: 4,
        maxOpenPositions: 4,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 500000000n, // 0.5 SOL
          stopLossPercent: 15,
          takeProfitPercent: 20,
        },
        defaultMintFrom: SOL_MINT,
      },
      {
        platform: Platform.JUPITER,
        enabled: false, // Disabled by default until implementation is complete
        priority: 5,
        maxOpenPositions: 2,
        tradingParams: {
          maxOpenPositions: 2,
          defaultAmountIn: 250000000n, // 0.25 SOL
          stopLossPercent: 10,
          takeProfitPercent: 15,
        },
        defaultMintFrom: SOL_MINT,
      },
      {
        platform: Platform.DRIFT,
        enabled: true,
        priority: 2,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n, // 0.1 SOL
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: SOL_MINT,
      },
      {
        platform: Platform.HYPERLIQUID,
        enabled: true,
        priority: 1,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n, // 100 USDC
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: HL_DEFAULT_MINT_FROM,
      },
    ];

    defaultConfigs.forEach((config) => {
      this.platformConfigurations.set(config.platform, config);
    });
  }

  registerPlatform(
    tokenDiscovery: PlatformTokenDiscoveryPort,
    tradingStrategy: PlatformTradingStrategyPort,
  ): void {
    const platform = tokenDiscovery.platform;

    if (platform !== tradingStrategy.platform) {
      throw new Error(
        `Platform mismatch: token discovery (${tokenDiscovery.platform}) != trading strategy (${tradingStrategy.platform})`,
      );
    }

    this.tokenDiscoveryServices.set(platform, tokenDiscovery);
    this.tradingStrategyServices.set(platform, tradingStrategy);

    this.logger.log(`Registered platform: ${platform}`);
  }

  registerPlatformService(
    platform: Platform,
    platformService: PlatformPriceService,
  ): void {
    this.platformServices.set(platform, platformService);
    this.logger.log(`Registered platform service: ${platform}`);
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

        const activeTokens = await tokenDiscovery.getActiveTokens({
          limit: 50, // TODO: Get rid of this if we will not work with meme coins
          minTrades: 10,
        });

        for (const tokenMintAddress of activeTokens) {
          const existingPosition =
            await this.tradePositionService.getTradePositionByTokenMint(
              tokenMintAddress,
              TradePositionStatus.OPEN,
            );

          if (existingPosition) {
            this.logger.debug(
              `Skipping ${tokenMintAddress} on ${platform} - already have open position`,
            );
            continue;
          }

          const tradingDecision = await tradingStrategy.shouldEnterPosition(
            tokenMintAddress,
            config.tradingParams,
          );

          if (tradingDecision.shouldTrade) {
            opportunities.push({
              platform,
              tokenMintAddress,
              tradingDecision,
              priority: config.priority,
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

    // Sort by priority (higher priority first) and then by confidence
    return opportunities.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.tradingDecision.confidence - a.tradingDecision.confidence;
    });
  }

  async evaluateExitDecisions(
    openPositions: TradePositionDocument[],
    platforms?: Platform[],
  ): Promise<{ position: TradePositionDocument; decision: ExitDecision }[]> {
    const targetPlatforms = platforms || this.getEnabledPlatforms();
    const exitDecisions: {
      position: TradePositionDocument;
      decision: ExitDecision;
    }[] = [];

    for (const position of openPositions) {
      try {
        if (!targetPlatforms.includes(position.platform)) {
          continue;
        }

        const tradingStrategy = this.getTradingStrategyService(
          position.platform,
        );
        const config = this.getPlatformConfiguration(position.platform);

        const exitDecision = await tradingStrategy.shouldExitPosition(
          position,
          config.tradingParams,
        );

        if (exitDecision.shouldExit) {
          exitDecisions.push({
            position,
            decision: exitDecision,
          });
        }
      } catch (error) {
        this.logger.error(
          `Error evaluating exit for position ${position.tokenMint}:`,
          error,
        );

        exitDecisions.push({
          position,
          decision: {
            shouldExit: true,
            reason: 'Error during evaluation',
            confidence: 0.5,
            urgency: 'medium',
          },
        });
      }
    }

    // Sort by urgency (high > medium > low) and then by confidence
    return exitDecisions.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      const aUrgency = urgencyOrder[a.decision.urgency];
      const bUrgency = urgencyOrder[b.decision.urgency];

      if (aUrgency !== bUrgency) {
        return bUrgency - aUrgency;
      }
      return b.decision.confidence - a.decision.confidence;
    });
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

  getPlatformService(platform: Platform): PlatformPriceService {
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
