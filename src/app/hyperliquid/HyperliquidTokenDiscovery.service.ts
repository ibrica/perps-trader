import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform } from '../../shared';
import { PlatformTokenDiscoveryPort } from '../../shared/ports/trading/PlatformTokenDiscoveryPort';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PerpService } from '../perps/Perp.service';
import { MarketStats } from './types';

@Injectable()
export class HyperliquidTokenDiscoveryService extends PlatformTokenDiscoveryPort {
  private readonly logger = new Logger(HyperliquidTokenDiscoveryService.name);
  public readonly platform = Platform.HYPERLIQUID;

  private marketsCache: string[] = [];
  private lastFetch: number = 0;
  private readonly cacheTtl = 300000; // 5 minutes

  constructor(
    private configService: ConfigService,
    private hyperliquidService: HyperliquidService,
    private perpService: PerpService,
  ) {
    super();
  }

  /**
   * Get active tokens available for trading on Hyperliquid
   */
  async getTokensToTrade(): Promise<string[]> {
    try {
      // Check if Hyperliquid is enabled
      const isEnabled = this.configService.get<boolean>('hyperliquid.enabled');
      if (!isEnabled) {
        this.logger.warn('Hyperliquid trading is disabled');
        return [];
      }

      // Check cache
      if (
        this.marketsCache.length > 0 &&
        Date.now() - this.lastFetch < this.cacheTtl
      ) {
        return this.marketsCache;
      }

      // Fetch markets from Hyperliquid
      const markets = await this.hyperliquidService.getMarkets();

      // Extract symbols that are available for trading
      const availableSymbols: string[] = [];

      const perpsToTrade = await this.perpService.getPerpsForTrading(
        Platform.HYPERLIQUID,
      );

      for (const perp of perpsToTrade) {
        try {
          // Check if we have a perp definition for this market
          const symbol = perp.token;
          const market = markets.find(
            (m) => m.name === this.constructMarketName(symbol),
          );

          if (market) {
            const isActive = await this.isMarketActive(market.name);
            if (isActive) {
              availableSymbols.push(symbol);
            }
          }
        } catch (error) {
          this.logger.debug(
            `Error checking perp for trading: ${perp.name}:`,
            error,
          );
          continue;
        }
      }

      // Update cache
      this.marketsCache = availableSymbols;
      this.lastFetch = Date.now();

      this.logger.log(
        `Found ${availableSymbols.length} active tokens on Hyperliquid`,
      );

      return availableSymbols;
    } catch (error) {
      this.logger.error('Failed to get active tokens', error);
      return [];
    }
  }

  /**
   * Check if a specific token is tradeable
   */
  async isTokenTradeable(tokenSymbol: string): Promise<boolean> {
    try {
      // Check if Hyperliquid is enabled
      const isEnabled = this.configService.get<boolean>('hyperliquid.enabled');
      if (!isEnabled) {
        return false;
      }

      // Check if we have a perp definition
      const perp = await this.perpService.findByToken(tokenSymbol);
      if (!perp) {
        return false;
      }

      // Check if the market exists on Hyperliquid
      const markets = await this.hyperliquidService.getMarkets();
      const marketName = this.constructMarketName(tokenSymbol);
      const market = markets.find((m) => m.name === marketName);

      if (!market) {
        return false;
      }

      // Check if the market is active
      return await this.isMarketActive(marketName);
    } catch (error) {
      this.logger.error(
        `Failed to check if token ${tokenSymbol} is tradeable`,
        error,
      );
      return false;
    }
  }

  /**
   * Extract base symbol from Hyperliquid market name
   * e.g., "SOL-USD" -> "SOL"
   */
  private extractBaseSymbol(marketName: string): string {
    // Handle different naming conventions
    if (marketName.includes('-USD')) {
      return marketName.split('-USD')[0];
    }
    if (marketName.includes('-PERP')) {
      return marketName.split('-PERP')[0];
    }
    if (marketName.includes('/')) {
      return marketName.split('/')[0];
    }

    // Fallback: assume the market name is the symbol
    return marketName;
  }

  /**
   * Construct Hyperliquid market name from symbol
   */
  private constructMarketName(symbol: string): string {
    // Most Hyperliquid perpetuals follow the pattern SYMBOL-USD
    return `${symbol.toUpperCase()}-USD`;
  }

  /**
   * Check if a market is currently active for trading
   */
  private async isMarketActive(marketName: string): Promise<boolean> {
    try {
      // Get ticker to verify the market is live
      const ticker = await this.hyperliquidService.getTicker(
        this.extractBaseSymbol(marketName),
      );

      // Check that we have valid bid/ask
      const bid = parseFloat(ticker.bid);
      const ask = parseFloat(ticker.ask);

      if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) {
        return false;
      }

      // Check spread is reasonable (less than 10%)
      const spread = (ask - bid) / bid;
      if (spread > 0.1) {
        this.logger.debug(
          `Market ${marketName} has wide spread: ${(spread * 100).toFixed(2)}%`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.debug(`Market ${marketName} appears inactive:`, error);
      return false;
    }
  }

  /**
   * Get preferred trading symbols for Hyperliquid
   * These are typically high-volume, well-established tokens
   */
  getPreferredSymbols(): string[] {
    return [
      'BTC',
      'ETH',
      'SOL',
      'DOGE',
      'AVAX',
      'MATIC',
      'ATOM',
      'DOT',
      'UNI',
      'LINK',
    ];
  }

  /**
   * Check if any of the preferred symbols are available
   */
  async getAvailablePreferredSymbols(): Promise<string[]> {
    const preferred = this.getPreferredSymbols();
    const available: string[] = [];

    for (const symbol of preferred) {
      const isAvailable = await this.isTokenTradeable(symbol);
      if (isAvailable) {
        available.push(symbol);
      }
    }

    return available;
  }

  /**
   * Get market statistics for active tokens
   */
  async getMarketStats(
    symbols?: string[],
  ): Promise<Record<string, MarketStats>> {
    const tokensToCheck = symbols || (await this.getTokensToTrade());
    const stats: Record<string, MarketStats> = {};

    for (const symbol of tokensToCheck) {
      try {
        const ticker = await this.hyperliquidService.getTicker(symbol);
        stats[symbol] = {
          price: ticker.mark,
          volume24h: ticker.volume24h,
          bid: ticker.bid,
          ask: ticker.ask,
          mark: ticker.mark,
          openInterest: ticker.openInterest,
          fundingRate: ticker.fundingRate,
          spread: (
            ((parseFloat(ticker.ask) - parseFloat(ticker.bid)) /
              parseFloat(ticker.bid)) *
            100
          ).toFixed(4),
        };
      } catch (error) {
        this.logger.debug(`Failed to get stats for ${symbol}:`, error);
      }
    }

    return stats;
  }
}
