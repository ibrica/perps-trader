/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
import { Platform } from '../../models/platform/Platform';
import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';

export interface PlatformTradingParams {
  maxOpenPositions: number;
  defaultAmountIn: bigint;
  stopLossPercent: number;
  takeProfitPercent: number;
  [key: string]: any; // Platform-specific parameters
}

export interface TradingDecision {
  shouldTrade: boolean;
  reason: string;
  confidence: number;
  recommendedAmount?: bigint;
  metadata?: Record<string, any>;
}

export interface ExitDecision {
  shouldExit: boolean;
  reason: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export abstract class PlatformTradingStrategyPort {
  abstract readonly platform: Platform;

  abstract shouldEnterPosition(
    tokenMintAddress: string,
    params: PlatformTradingParams,
  ): Promise<TradingDecision>;

  abstract shouldExitPosition(
    tradePosition: TradePositionDocument,
    params: PlatformTradingParams,
  ): Promise<ExitDecision>;

  abstract getTakeProfitPrice(
    tradePosition: TradePositionDocument,
    params: PlatformTradingParams,
  ): number;

  abstract getStopLossPrice(
    tradePosition: TradePositionDocument,
    params: PlatformTradingParams,
  ): number;

  abstract getDefaultTradingParams(): PlatformTradingParams;
}
