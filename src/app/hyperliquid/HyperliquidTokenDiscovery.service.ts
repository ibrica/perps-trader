import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, MarketStats, HLMarket } from '../../shared';
import { PlatformTokenDiscoveryPort } from '../../shared/ports/trading/PlatformTokenDiscoveryPort';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PerpService } from '../perps/Perp.service';

@Injectable()
export class HyperliquidTokenDiscoveryService extends PlatformTokenDiscoveryPort {
  private readonly logger = new Logger(HyperliquidTokenDiscoveryService.name);
  public readonly platform = Platform.HYPERLIQUID;

  private marketsCache: string[] = [];
  private lastFetch: number = 0;
  private readonly cacheTtl = 900000; // 15 minutes

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

      // Extract symbols that are available for trading
      const availableSymbols: string[] = [];

      const perpsToTrade = await this.perpService.getPerpsForTrading(
        Platform.HYPERLIQUID,
      );

      for (const perp of perpsToTrade) {
        try {
          // Check if we have a perp definition for this market
          const symbol = perp.token;
          const market = await this.findMarket(perp.name, symbol);

          const isActive = await this.isMarketActive(market.name);
          if (isActive) {
            availableSymbols.push(symbol);
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
   * Find a market by name or symbol
   */
  private async findMarket(name: string, symbol: string): Promise<HLMarket> {
    const markets = await this.hyperliquidService.getMarkets();
    const constructedName = this.constructMarketName(symbol);

    const market = markets.find(
      (m) => m.name === name || m.name === constructedName,
    );

    if (!market) {
      throw new Error(`Market not found: ${name} or ${constructedName}`);
    }
    return market;
  }

  /**
   * Construct Hyperliquid market name from symbol
   */
  private constructMarketName(symbol: string): string {
    // Most Hyperliquid perpetuals follow the pattern SYMBOL-PERP
    return `${symbol.toUpperCase()}-PERP`;
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
