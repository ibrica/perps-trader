import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PerpService } from './Perp.service';
import { Platform } from '../../shared';
import { MarketDirection, PerpDocument } from './Perp.schema';
import { allowedPerpPlatforms } from './constants';

export interface PerpPriceData {
  perpId: string;
  currentPrice: number;
  previousPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  marketDirection: MarketDirection;
  shouldTriggerBuy?: boolean;
  timestamp: Date;
}

export interface PerpMonitoringResult {
  perpId: string;
  name: string;
  platform: Platform;
  currentPrice: number;
  marketDirection: MarketDirection;
  shouldTriggerBuy: boolean;
  reason?: string;
}

@Injectable()
export class PerpPriceMonitorService {
  private readonly logger = new Logger(PerpPriceMonitorService.name);
  private priceHistory: Map<string, PerpPriceData[]> = new Map();
  private readonly MAX_PRICE_HISTORY = 50; // Keep last 50 price points per perp

  constructor(private perpService: PerpService) {}

  async monitorAllActivePerps(): Promise<PerpMonitoringResult[]> {
    try {
      // Get all perps marked for trading across all platforms
      const allActivePerps = await this.perpService.getAllPerpsForTrading();

      if (allActivePerps.length === 0) {
        this.logger.debug('No active perps found for monitoring');
        return [];
      }

      this.logger.log(
        `Found ${allActivePerps.length} active perps for monitoring`,
      );

      const results: PerpMonitoringResult[] = [];

      for (const perp of allActivePerps) {
        try {
          if (!allowedPerpPlatforms.includes(perp.platform)) {
            this.logger.error(
              `Perp ${perp.name} uses unsupported platform ${perp.platform}. ` +
                `Allowed platforms: ${allowedPerpPlatforms.join(', ')}. Skipping monitoring.`,
            );
            continue;
          }

          const result = await this.monitorPerpPrice(perp);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          this.logger.error(`Error monitoring perp ${perp.name}:`, error);
        }
      }

      if (results.length > 0) {
        this.logger.log(`Successfully monitoring ${results.length} perps`);
      }

      return results;
    } catch (error) {
      this.logger.error('Error monitoring active perps:', error);
      return [];
    }
  }

  async monitorPerpPrice(
    perp: PerpDocument,
  ): Promise<PerpMonitoringResult | null> {
    try {
      let currentPrice: number;

      const platformService = this.getPlatformService(perp.platform);
      if (!platformService) {
        this.logger.error(
          `No service available for platform ${perp.platform} for perp ${perp.name}`,
        );
        return null;
      }

      if (perp.marketIndex) {
        const priceData = await platformService.getMarketPrice(
          perp.marketIndex,
        );
        currentPrice = priceData.ask;
      } else {
        // Try to find market by symbol
        const markets = await platformService.getAvailableMarkets();
        const market = markets.find(
          (m) => m.baseAssetSymbol === perp.baseAssetSymbol,
        );
        if (!market) {
          this.logger.warn(
            `No market found for perp ${perp.name} with symbol ${perp.baseAssetSymbol} on platform ${perp.platform}`,
          );
          return null;
        }
        const priceData = await platformService.getMarketPrice(
          market.marketIndex,
        );
        currentPrice = priceData.ask;
      }

      // Update price history
      const perpId = String(perp._id);
      const priceData: PerpPriceData = {
        perpId,
        currentPrice,
        marketDirection: perp.marketDirection,
        timestamp: new Date(),
      };

      const history = this.priceHistory.get(perpId) || [];

      if (history.length > 0) {
        const previousPrice = history[history.length - 1].currentPrice;
        priceData.previousPrice = previousPrice;
        priceData.priceChange = currentPrice - previousPrice;
        priceData.priceChangePercent =
          ((currentPrice - previousPrice) / previousPrice) * 100;
      }

      // Add to history and maintain size limit
      history.push(priceData);
      if (history.length > this.MAX_PRICE_HISTORY) {
        history.shift();
      }
      this.priceHistory.set(perpId, history);

      // Determine if should trigger buy based on market direction and price movement
      const shouldTriggerBuy = this.shouldTriggerBuy(priceData, history);

      const result: PerpMonitoringResult = {
        perpId,
        name: perp.name,
        platform: perp.platform,
        currentPrice,
        marketDirection: perp.marketDirection,
        shouldTriggerBuy,
        reason: this.getBuyTriggerReason(priceData, history, shouldTriggerBuy),
      };

      if (shouldTriggerBuy) {
        this.logger.log(`Buy trigger for perp ${perp.name}: ${result.reason}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error monitoring price for perp ${perp.name}:`, error);
      return null;
    }
  }

  private shouldTriggerBuy(
    currentData: PerpPriceData,
    history: PerpPriceData[],
  ): boolean {
    if (history.length < 2) {
      return false; // Need at least 2 data points
    }

    const { marketDirection, priceChangePercent } = currentData;

    if (!priceChangePercent) {
      return false;
    }

    // Basic logic - can be enhanced later
    switch (marketDirection) {
      case MarketDirection.UP:
        // Buy on upward momentum (price increase > 1%)
        return priceChangePercent > 1.0;

      case MarketDirection.DOWN:
        // Buy on reversal signal (price starting to increase after decline)
        return this.detectReversalSignal(history, 'up');

      case MarketDirection.NEUTRAL:
        // Buy on significant price movement in either direction
        return Math.abs(priceChangePercent) > 2.0;

      default:
        return false;
    }
  }

  private detectReversalSignal(
    history: PerpPriceData[],
    direction: 'up' | 'down',
  ): boolean {
    if (history.length < 3) {
      return false;
    }

    const recent = history.slice(-3);
    const [oldest, middle, newest] = recent;

    if (direction === 'up') {
      // Detect upward reversal: declining then increasing
      return (
        oldest.priceChangePercent !== undefined &&
        middle.priceChangePercent !== undefined &&
        newest.priceChangePercent !== undefined &&
        oldest.priceChangePercent < 0 &&
        middle.priceChangePercent < 0 &&
        newest.priceChangePercent > 0.5
      );
    } else {
      // Detect downward reversal: increasing then declining
      return (
        oldest.priceChangePercent !== undefined &&
        middle.priceChangePercent !== undefined &&
        newest.priceChangePercent !== undefined &&
        oldest.priceChangePercent > 0 &&
        middle.priceChangePercent > 0 &&
        newest.priceChangePercent < -0.5
      );
    }
  }

  private getBuyTriggerReason(
    currentData: PerpPriceData,
    history: PerpPriceData[],
    shouldTrigger: boolean,
  ): string {
    if (!shouldTrigger) {
      return 'No trigger conditions met';
    }

    const { marketDirection, priceChangePercent } = currentData;

    switch (marketDirection) {
      case MarketDirection.UP:
        return `Upward momentum detected: ${priceChangePercent?.toFixed(2)}% price increase`;

      case MarketDirection.DOWN:
        if (this.detectReversalSignal(history, 'up')) {
          return `Reversal signal detected: price starting to increase after decline`;
        }
        return 'Buy condition met for downward trend';

      case MarketDirection.NEUTRAL:
        return `Significant price movement: ${priceChangePercent?.toFixed(2)}% change`;

      default:
        return 'Buy trigger activated';
    }
  }

  getPriceHistory(perpId: string): PerpPriceData[] {
    return this.priceHistory.get(perpId) || [];
  }

  clearPriceHistory(perpId?: string): void {
    if (perpId) {
      this.priceHistory.delete(perpId);
    } else {
      this.priceHistory.clear();
    }
  }

  private getPlatformService(platform: Platform): PlatformPriceService | null {
    switch (platform) {
      case Platform.DRIFT:
        return this.driftService;
      // Add other platforms here as they are implemented
      // case Platform.RAYDIUM:
      //   return this.raydiumService;
      // case Platform.JUPITER:
      //   return this.jupiterService;
      default:
        this.logger.error(`Platform service not implemented for ${platform}`);
        return null;
    }
  }
}
