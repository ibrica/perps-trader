/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { Platform } from '../../models/platform/Platform';

export abstract class PlatformTokenDiscoveryPort {
  abstract readonly platform: Platform;

  abstract getTokensToTrade(): Promise<string[]>;

  abstract isTokenTradeable(token: string): Promise<boolean>;
}
