import { Platform } from '../../models/platform/Platform';
import { PlatformTokenDiscoveryPort } from './PlatformTokenDiscoveryPort';
import {
  PlatformTradingStrategyPort,
  TradingDecision,
  ExitDecision,
  PlatformTradingParams,
} from './PlatformTradingStrategyPort';
import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { BasePlatformService } from '@perps/shared/models/platform';
import { Currency } from '@perps/shared/constants';

export interface PlatformConfiguration {
  platform: Platform;
  enabled: boolean;
  tradingParams: PlatformTradingParams;
  defaultCurrencyFrom: Currency;
}

export interface TradingOpportunity {
  platform: Platform;
  token: string;
  tradingDecision: TradingDecision;
}

export abstract class PlatformManagerPort {
  abstract registerPlatform(
    tokenDiscovery: PlatformTokenDiscoveryPort,
    tradingStrategy: PlatformTradingStrategyPort,
    platformService: BasePlatformService,
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

  abstract getPlatformConfiguration(platform: Platform): PlatformConfiguration;

  abstract updatePlatformConfiguration(
    platform: Platform,
    config: Partial<PlatformConfiguration>,
  ): Promise<void>;
}
