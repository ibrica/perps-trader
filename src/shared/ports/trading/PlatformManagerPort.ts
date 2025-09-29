import { Platform } from '../../models/platform/Platform';
import { PlatformTokenDiscoveryPort } from './PlatformTokenDiscoveryPort';
import {
  PlatformTradingStrategyPort,
  TradingDecision,
  ExitDecision,
  PlatformTradingParams,
} from './PlatformTradingStrategyPort';
import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { PlatformPriceService } from '../../../app/perps';

export interface PlatformConfiguration {
  platform: Platform;
  enabled: boolean;
  priority: number; // Higher number = higher priority
  maxOpenPositions: number;
  tradingParams: PlatformTradingParams;
  defaultMintFrom: string;
}

export interface TradingOpportunity {
  platform: Platform;
  tokenMintAddress: string;
  tradingDecision: TradingDecision;
  priority: number;
}

export abstract class PlatformManagerPort {
  abstract registerPlatform(
    tokenDiscovery: PlatformTokenDiscoveryPort,
    tradingStrategy: PlatformTradingStrategyPort,
  ): void;

  abstract getAvailablePlatforms(): Platform[];

  abstract getEnabledPlatforms(): Platform[];

  abstract findTradingOpportunities(
    platforms?: Platform[],
  ): Promise<TradingOpportunity[]>;

  abstract evaluateExitDecisions(
    openPositions: TradePositionDocument[],
    platforms?: Platform[],
  ): Promise<{ position: TradePositionDocument; decision: ExitDecision }[]>;

  abstract getTokenDiscoveryService(
    platform: Platform,
  ): PlatformTokenDiscoveryPort;

  abstract getTradingStrategyService(
    platform: Platform,
  ): PlatformTradingStrategyPort;

  abstract getPlatformService(platform: Platform): PlatformPriceService;

  abstract getPlatformConfiguration(platform: Platform): PlatformConfiguration;

  abstract updatePlatformConfiguration(
    platform: Platform,
    config: Partial<PlatformConfiguration>,
  ): Promise<void>;
}
