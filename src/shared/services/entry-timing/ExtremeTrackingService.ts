import { Injectable, Logger } from '@nestjs/common';
import { IndexerAdapter } from '@perps-infra/indexer/IndexerAdapter';
import { OHLCVCandle } from '@perps-infra/indexer/types';
import { PositionDirection } from '../../constants/PositionDirection';

export interface PriceExtreme {
  /** Extreme price (high for LONG, low for SHORT) */
  price: number;
  /** Timestamp of the extreme */
  timestamp: string;
  /** Number of candles analyzed */
  candleCount: number;
}

export interface CorrectionDepth {
  /** Current price */
  currentPrice: number;
  /** Extreme price (peak/bottom) */
  extremePrice: number;
  /** Correction depth as percentage */
  depthPercent: number;
  /** Direction of the position */
  direction: PositionDirection;
}

/**
 * Service for tracking price extremes (highs/lows) from OHLCV data
 *
 * This service fetches 1-minute candle data from the indexer and calculates:
 * - Highest price (for SHORT entry - waiting for price to drop from peak)
 * - Lowest price (for LONG entry - waiting for price to rise from bottom)
 * - Correction depth from these extremes
 */
@Injectable()
export class ExtremeTrackingService {
  private readonly logger = new Logger(ExtremeTrackingService.name);

  constructor(private readonly indexerAdapter: IndexerAdapter) {}

  /**
   * Get the price extreme (high or low) for a token based on direction
   *
   * @param token Token symbol (e.g., "BTC", "ETH")
   * @param direction Position direction (LONG looks for lows, SHORT looks for highs)
   * @param lookbackMinutes Number of minutes to look back (default: 60 = 1 hour)
   * @returns Price extreme information
   */
  async getExtreme(
    token: string,
    direction: PositionDirection,
    lookbackMinutes: number = 60,
  ): Promise<PriceExtreme> {
    this.logger.debug(
      `Fetching price extreme for ${token}, direction: ${direction}, lookback: ${lookbackMinutes}m`,
    );

    try {
      // Fetch OHLCV data from indexer (1-minute candles)
      const ohlcvData = await this.indexerAdapter.getOHLCV(
        token,
        lookbackMinutes,
      );

      if (!ohlcvData.candles || ohlcvData.candles.length === 0) {
        throw new Error(`No OHLCV data available for ${token}`);
      }

      // Calculate extreme based on direction
      let extreme: OHLCVCandle;

      if (direction === PositionDirection.LONG) {
        // For LONG, find the LOWEST price (bottom)
        extreme = ohlcvData.candles.reduce((lowest, candle) =>
          candle.low_price < lowest.low_price ? candle : lowest,
        );

        this.logger.debug(
          `LONG extreme for ${token}: low=${extreme.low_price} at ${extreme.timestamp}`,
        );

        return {
          price: extreme.low_price,
          timestamp: extreme.timestamp,
          candleCount: ohlcvData.candles.length,
        };
      } else {
        // For SHORT, find the HIGHEST price (peak)
        extreme = ohlcvData.candles.reduce((highest, candle) =>
          candle.high_price > highest.high_price ? candle : highest,
        );

        this.logger.debug(
          `SHORT extreme for ${token}: high=${extreme.high_price} at ${extreme.timestamp}`,
        );

        return {
          price: extreme.high_price,
          timestamp: extreme.timestamp,
          candleCount: ohlcvData.candles.length,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to get price extreme for ${token}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Calculate the correction depth from a price extreme
   *
   * @param token Token symbol
   * @param direction Position direction
   * @param currentPrice Current token price
   * @param lookbackMinutes Number of minutes to look back for extreme
   * @returns Correction depth information
   */
  async calculateCorrectionDepth(
    token: string,
    direction: PositionDirection,
    currentPrice: number,
    lookbackMinutes: number = 60,
  ): Promise<CorrectionDepth> {
    const extreme = await this.getExtreme(token, direction, lookbackMinutes);

    let depthPercent: number;

    if (direction === PositionDirection.LONG) {
      // For LONG: correction is upward from low
      // Positive depth means price has moved UP from the low
      depthPercent = ((currentPrice - extreme.price) / extreme.price) * 100;
    } else {
      // For SHORT: correction is downward from high
      // Positive depth means price has moved DOWN from the high
      depthPercent = ((extreme.price - currentPrice) / extreme.price) * 100;
    }

    this.logger.debug(
      `Correction depth for ${token} ${direction}: ${depthPercent.toFixed(2)}% ` +
        `(current: ${currentPrice}, extreme: ${extreme.price})`,
    );

    return {
      currentPrice,
      extremePrice: extreme.price,
      depthPercent,
      direction,
    };
  }

  /**
   * Check if correction has reached minimum depth threshold
   *
   * @param correctionDepth Correction depth data
   * @param minDepthPercent Minimum depth threshold (e.g., 1.5%)
   * @returns True if correction is deep enough
   */
  isCorrectionDeepEnough(
    correctionDepth: CorrectionDepth,
    minDepthPercent: number,
  ): boolean {
    return Math.abs(correctionDepth.depthPercent) >= minDepthPercent;
  }
}
