import { Injectable, Logger } from '@nestjs/common';
import {
  TrendsResponse,
  TrendTimeframe,
  TrendStatus,
  isTrendDefined,
} from '../../models/predictor/types';
import { PositionDirection } from '../../constants/PositionDirection';
import { ExtremeTrackingService } from './ExtremeTrackingService';

export interface EntryTimingConfig {
  /** Enable/disable entry timing optimization */
  enabled: boolean;
  /** Short timeframe for correction detection ('5m' or '15m') */
  shortTimeframe: '5m' | '15m';
  /** Minimum correction depth percentage (default: 1.5) */
  minCorrectionPct: number;
  /** Confidence threshold for reversal detection (default: 0.6) */
  reversalConfidence: number;
  /** Enable real OHLCV-based extreme tracking (default: true) */
  useRealExtremes: boolean;
  /** Lookback period in minutes for extreme tracking (default: 60) */
  extremeLookbackMinutes: number;
}

export interface EntryTimingEvaluation {
  shouldEnterNow: boolean;
  direction: PositionDirection | null;
  timing: 'immediate' | 'wait_correction' | 'reversal_detected' | 'no_signal';
  confidence: number;
  reason: string;
  metadata: {
    primaryTrend: TrendStatus;
    primaryTimeframe: string;
    correctionTrend: TrendStatus;
    correctionTimeframe: string;
    correctionDepthPct?: number;
    reversalDetected: boolean;
    trendAlignment: boolean;
  };
}

/**
 * Platform-agnostic service for evaluating optimal entry timing based on multi-timeframe trend analysis
 *
 * Strategy:
 * 1. Identify primary trend (1hr) for position direction
 * 2. Monitor shorter timeframes (5m, 15m) for corrective movements
 * 3. Track actual price extremes (highs/lows) from OHLCV data
 * 4. Calculate real correction depth from extremes
 * 5. Enter when correction reverses back toward primary trend with sufficient depth
 *
 * Examples:
 * - LONG: 1hr UP → wait for price to drop from recent high → enter when 5m turns UP
 * - SHORT: 1hr DOWN → wait for price to rise from recent low → enter when 5m turns DOWN
 *
 * ✅ IMPROVEMENTS (v2):
 * 1. Real Extreme Tracking
 *    - Uses actual OHLCV highs/lows instead of MA deviation proxy
 *    - Tracks peak/bottom prices from 1-minute candles
 *    - Accurate correction depth measurement
 *
 * 2. Configurable Lookback Period
 *    - Adjustable time window for extreme detection (default: 60 minutes)
 *    - Prevents false entries from stale extremes
 */
@Injectable()
export class EntryTimingService {
  private readonly logger = new Logger(EntryTimingService.name);

  constructor(
    private readonly config: EntryTimingConfig,
    private readonly extremeTracker?: ExtremeTrackingService,
  ) {}

  /**
   * Evaluate entry timing for a token based on multi-timeframe trends
   * @param token Token symbol
   * @param trends Trend data from predictor
   * @param currentPrice Current token price (required for extreme-based correction depth)
   */
  async evaluateEntryTiming(
    token: string,
    trends: TrendsResponse,
    currentPrice?: number,
  ): Promise<EntryTimingEvaluation> {
    if (!this.config.enabled) {
      this.logger.debug(
        `Entry timing optimization disabled for ${token}, using immediate entry`,
      );
      return this.createImmediateEntry(trends);
    }

    // Get primary trend (1hr) for direction
    const primaryTrend = trends.trends[TrendTimeframe.ONE_HOUR];

    if (!isTrendDefined(primaryTrend)) {
      return {
        shouldEnterNow: false,
        direction: null,
        timing: 'no_signal',
        confidence: 0,
        reason: '1hr trend is UNDEFINED, insufficient data',
        metadata: {
          primaryTrend: TrendStatus.UNDEFINED,
          primaryTimeframe: TrendTimeframe.ONE_HOUR,
          correctionTrend: TrendStatus.UNDEFINED,
          correctionTimeframe: 'N/A',
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    // Skip NEUTRAL trends
    if (primaryTrend.trend === TrendStatus.NEUTRAL) {
      return {
        shouldEnterNow: false,
        direction: null,
        timing: 'no_signal',
        confidence: 0,
        reason: '1hr trend is NEUTRAL, no clear direction',
        metadata: {
          primaryTrend: TrendStatus.NEUTRAL,
          primaryTimeframe: TrendTimeframe.ONE_HOUR,
          correctionTrend: TrendStatus.UNDEFINED,
          correctionTimeframe: 'N/A',
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    // Determine position direction from primary trend
    const direction =
      primaryTrend.trend === TrendStatus.UP
        ? PositionDirection.LONG
        : PositionDirection.SHORT;

    // Get short timeframe for correction detection
    const shortTimeframe = this.getShortTimeframe();
    const shortTrend = trends.trends[shortTimeframe];

    if (!isTrendDefined(shortTrend)) {
      // If short timeframe undefined, use 15m as fallback
      const fallbackTrend = trends.trends[TrendTimeframe.FIFTEEN_MIN];
      if (!isTrendDefined(fallbackTrend)) {
        // No valid short timeframe data, enter immediately based on primary trend
        return {
          shouldEnterNow: true,
          direction,
          timing: 'immediate',
          confidence: 0.6,
          reason: `1hr trend ${primaryTrend.trend}, short timeframes unavailable, entering immediately`,
          metadata: {
            primaryTrend: primaryTrend.trend,
            primaryTimeframe: TrendTimeframe.ONE_HOUR,
            correctionTrend: TrendStatus.UNDEFINED,
            correctionTimeframe: shortTimeframe,
            reversalDetected: false,
            trendAlignment: false,
          },
        };
      }

      // Use 15m as short timeframe
      return await this.evaluateWithShortTrend(
        token,
        direction,
        primaryTrend.trend,
        TrendTimeframe.ONE_HOUR,
        fallbackTrend.trend,
        TrendTimeframe.FIFTEEN_MIN,
        fallbackTrend.change_pct,
        currentPrice,
      );
    }

    return await this.evaluateWithShortTrend(
      token,
      direction,
      primaryTrend.trend,
      TrendTimeframe.ONE_HOUR,
      shortTrend.trend,
      shortTimeframe,
      shortTrend.change_pct,
      currentPrice,
    );
  }

  /**
   * Evaluate timing based on primary and short timeframe trends
   *
   * @param currentDeviationPct - Current price deviation from MA (fallback if real extremes unavailable)
   * @param currentPrice - Current token price (for real extreme-based depth calculation)
   */
  private async evaluateWithShortTrend(
    token: string,
    direction: PositionDirection,
    primaryTrend: TrendStatus,
    primaryTimeframe: string,
    shortTrend: TrendStatus,
    shortTimeframe: string,
    currentDeviationPct: number,
    currentPrice?: number,
  ): Promise<EntryTimingEvaluation> {
    // Determine if trends are aligned (same direction)
    const trendsAligned = this.areTrendsAligned(primaryTrend, shortTrend);

    // Determine if there's a correction (opposite direction)
    const isCorrection = this.isCorrection(primaryTrend, shortTrend);

    // ✅ IMPROVED: Calculate correction depth from real OHLCV extremes
    // ──────────────────────────────────────────────────────────────────────
    // NEW APPROACH (when useRealExtremes=true && extremeTracker available):
    //   - Fetches 1-minute OHLCV candles from indexer
    //   - Finds actual price extremes (highs for SHORT, lows for LONG)
    //   - Calculates precise correction depth from peak/bottom
    //
    // FALLBACK (when disabled or unavailable):
    //   - Uses trend.change_pct (MA deviation) as proxy
    //
    // EXAMPLE (LONG):
    //   Price: $100 → $95 (low) → $98 (current)
    //   Real extreme: 3.16% correction from $95 low
    //   MA deviation: May show different value based on current MA
    // ──────────────────────────────────────────────────────────────────────
    let correctionDepth: number;

    if (
      this.config.useRealExtremes &&
      this.extremeTracker &&
      currentPrice !== undefined
    ) {
      try {
        const extremeData = await this.extremeTracker.calculateCorrectionDepth(
          token,
          direction,
          currentPrice,
          this.config.extremeLookbackMinutes,
        );
        correctionDepth = Math.abs(extremeData.depthPercent);
        this.logger.debug(
          `Using real extreme depth for ${token}: ${correctionDepth.toFixed(2)}% ` +
            `(extreme: ${extremeData.extremePrice}, current: ${currentPrice})`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to get real extreme for ${token}, falling back to MA deviation: ${error instanceof Error ? error.message : error}`,
        );
        correctionDepth = Math.abs(currentDeviationPct);
      }
    } else {
      // Fallback to MA deviation
      correctionDepth = Math.abs(currentDeviationPct);
      if (!this.config.useRealExtremes) {
        this.logger.debug(
          `Using MA deviation depth for ${token}: ${correctionDepth.toFixed(2)}% (real extremes disabled)`,
        );
      }
    }

    // Case 1: Trends aligned - potential reversal from correction
    if (trendsAligned) {
      if (correctionDepth >= this.config.minCorrectionPct) {
        // Strong reversal signal - price moved significantly and now trends align
        return {
          shouldEnterNow: true,
          direction,
          timing: 'reversal_detected',
          confidence: 0.85,
          reason: `Reversal detected: ${shortTimeframe} turned ${shortTrend} with ${correctionDepth.toFixed(1)}% correction depth, aligning with 1hr ${primaryTrend}`,
          metadata: {
            primaryTrend,
            primaryTimeframe,
            correctionTrend: shortTrend,
            correctionTimeframe: shortTimeframe,
            correctionDepthPct: correctionDepth,
            reversalDetected: true,
            trendAlignment: true,
          },
        };
      }

      // Mild reversal, enter with medium confidence
      return {
        shouldEnterNow: true,
        direction,
        timing: 'reversal_detected',
        confidence: 0.7,
        reason: `${shortTimeframe} aligns with 1hr ${primaryTrend}, entering on alignment`,
        metadata: {
          primaryTrend,
          primaryTimeframe,
          correctionTrend: shortTrend,
          correctionTimeframe: shortTimeframe,
          correctionDepthPct: correctionDepth,
          reversalDetected: true,
          trendAlignment: true,
        },
      };
    }

    // Case 2: Correction in progress - wait for reversal
    if (isCorrection) {
      return {
        shouldEnterNow: false,
        direction,
        timing: 'wait_correction',
        confidence: this.config.reversalConfidence,
        reason: `Correction in progress: ${shortTimeframe} ${shortTrend} (${correctionDepth.toFixed(1)}% depth) opposes 1hr ${primaryTrend}, waiting for reversal`,
        metadata: {
          primaryTrend,
          primaryTimeframe,
          correctionTrend: shortTrend,
          correctionTimeframe: shortTimeframe,
          correctionDepthPct: correctionDepth,
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    // Case 3: NEUTRAL short trend - enter with lower confidence
    if (shortTrend === TrendStatus.NEUTRAL) {
      return {
        shouldEnterNow: true,
        direction,
        timing: 'immediate',
        confidence: 0.65,
        reason: `${shortTimeframe} NEUTRAL, entering based on 1hr ${primaryTrend}`,
        metadata: {
          primaryTrend,
          primaryTimeframe,
          correctionTrend: TrendStatus.NEUTRAL,
          correctionTimeframe: shortTimeframe,
          correctionDepthPct: correctionDepth,
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    // Default: enter immediately
    return {
      shouldEnterNow: true,
      direction,
      timing: 'immediate',
      confidence: 0.6,
      reason: `Entering based on 1hr ${primaryTrend}`,
      metadata: {
        primaryTrend,
        primaryTimeframe,
        correctionTrend: shortTrend,
        correctionTimeframe: shortTimeframe,
        correctionDepthPct: correctionDepth,
        reversalDetected: false,
        trendAlignment: false,
      },
    };
  }

  /**
   * Check if trends are aligned (same direction)
   */
  private areTrendsAligned(
    primaryTrend: TrendStatus,
    shortTrend: TrendStatus,
  ): boolean {
    if (
      primaryTrend === TrendStatus.NEUTRAL ||
      shortTrend === TrendStatus.NEUTRAL
    ) {
      return false;
    }
    return primaryTrend === shortTrend;
  }

  /**
   * Check if short trend is a correction (opposite of primary trend)
   */
  private isCorrection(
    primaryTrend: TrendStatus,
    shortTrend: TrendStatus,
  ): boolean {
    if (
      primaryTrend === TrendStatus.NEUTRAL ||
      shortTrend === TrendStatus.NEUTRAL
    ) {
      return false;
    }

    return (
      (primaryTrend === TrendStatus.UP && shortTrend === TrendStatus.DOWN) ||
      (primaryTrend === TrendStatus.DOWN && shortTrend === TrendStatus.UP)
    );
  }

  /**
   * Get configured short timeframe for correction detection
   */
  private getShortTimeframe(): TrendTimeframe {
    switch (this.config.shortTimeframe) {
      case '5m':
        return TrendTimeframe.FIVE_MIN;
      case '15m':
        return TrendTimeframe.FIFTEEN_MIN;
      default:
        this.logger.warn(
          `Invalid short timeframe configuration: ${this.config.shortTimeframe}, using 5m`,
        );
        return TrendTimeframe.FIVE_MIN;
    }
  }

  /**
   * Create immediate entry evaluation (when timing optimization is disabled)
   */
  private createImmediateEntry(trends: TrendsResponse): EntryTimingEvaluation {
    const primaryTrend = trends.trends[TrendTimeframe.ONE_HOUR];

    if (!isTrendDefined(primaryTrend)) {
      return {
        shouldEnterNow: false,
        direction: null,
        timing: 'no_signal',
        confidence: 0,
        reason: '1hr trend UNDEFINED',
        metadata: {
          primaryTrend: TrendStatus.UNDEFINED,
          primaryTimeframe: TrendTimeframe.ONE_HOUR,
          correctionTrend: TrendStatus.UNDEFINED,
          correctionTimeframe: 'N/A',
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    if (primaryTrend.trend === TrendStatus.NEUTRAL) {
      return {
        shouldEnterNow: false,
        direction: null,
        timing: 'no_signal',
        confidence: 0,
        reason: '1hr trend NEUTRAL',
        metadata: {
          primaryTrend: TrendStatus.NEUTRAL,
          primaryTimeframe: TrendTimeframe.ONE_HOUR,
          correctionTrend: TrendStatus.UNDEFINED,
          correctionTimeframe: 'N/A',
          reversalDetected: false,
          trendAlignment: false,
        },
      };
    }

    const direction =
      primaryTrend.trend === TrendStatus.UP
        ? PositionDirection.LONG
        : PositionDirection.SHORT;

    return {
      shouldEnterNow: true,
      direction,
      timing: 'immediate',
      confidence: 0.6,
      reason: `Entry timing disabled, entering on 1hr ${primaryTrend.trend}`,
      metadata: {
        primaryTrend: primaryTrend.trend,
        primaryTimeframe: TrendTimeframe.ONE_HOUR,
        correctionTrend: TrendStatus.UNDEFINED,
        correctionTimeframe: 'N/A',
        reversalDetected: false,
        trendAlignment: false,
      },
    };
  }
}
