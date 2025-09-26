/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { Platform } from '../../models/trade/Platform';

export interface TokenDiscoveryParams {
  minBuyPosition?: number;
  maxBuyPosition?: number;
  minTradeInterval?: number;
  minTrades?: number;
  limit?: number;
  minVolume?: number;
  maxMarketCap?: number;
  [key: string]: any; // Allow platform-specific parameters
}

export abstract class PlatformTokenDiscoveryPort {
  abstract readonly platform: Platform;

  abstract getActiveTokens(params: TokenDiscoveryParams): Promise<string[]>;

  abstract isTokenTradeable(tokenMintAddress: string): Promise<boolean>;
}
