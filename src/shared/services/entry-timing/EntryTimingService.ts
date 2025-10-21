import { Injectable, Logger } from '@nestjs/common';
import {
  TrendsResponse,
  TrendTimeframe,
  TrendStatus,
  isTrendDefined,
} from '../../models/predictor/types';
import { PositionDirection } from '../../constants/PositionDirection';

export interface EntryTimingConfig {
  /** Enable/disable entry timing optimization */
  enabled: boolean;
  /** Short timeframe for correction detection ('5m' or '15m') */
  shortTimeframe: '5m' | '15m';
  /** Minimum correction depth percentage (default: 1.5) */
  minCorrectionPct: number;
  /** Confidence threshold for reversal detection (default: 0.6) */
  reversalConfidence: number;
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
 * 3. Enter when correction reverses back toward primary trend
 *
 * Examples:
 * - LONG: 1hr UP → wait for 5m DOWN correction → enter when 5m turns UP
 * - SHORT: 1hr DOWN → wait for 5m UP correction → enter when 5m turns DOWN
 *
 * ⚠️ KNOWN LIMITATIONS:
 * 1. Correction Depth Measurement (lines 190-215)
 *    - Uses current MA deviation as proxy instead of tracking actual price extremes
 *    - May trigger entries before correction fully completes
 *    - Can result in suboptimal entry prices during deeper corrections
 *    - See inline TODO for implementation of proper extreme tracking
 *
 * 2. No Historical State
 *    - Each evaluation is stateless (no memory of previous price action)
 *    - Cannot distinguish between "correction starting" vs "correction ending"
 *    - Relies on trend direction change to infer reversal
 */
@Injectable()
export class EntryTimingService {
  private readonly logger = new Logger(EntryTimingService.name);

  constructor(private readonly config: EntryTimingConfig) {}

  /**
   * Evaluate entry timing for a token based on multi-timeframe trends
   */
  async evaluateEntryTiming(
    token: string,
    trends: TrendsResponse,
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
      return this.evaluateWithShortTrend(
        token,
        direction,
        primaryTrend.trend,
        TrendTimeframe.ONE_HOUR,
        fallbackTrend.trend,
        TrendTimeframe.FIFTEEN_MIN,
        fallbackTrend.change_pct,
      );
    }

    return this.evaluateWithShortTrend(
      token,
      direction,
      primaryTrend.trend,
      TrendTimeframe.ONE_HOUR,
      shortTrend.trend,
      shortTimeframe,
      shortTrend.change_pct,
    );
  }

  /**
   * Evaluate timing based on primary and short timeframe trends
   *
   * @param currentDeviationPct - Current price deviation from MA (from trend.change_pct)
   *                               This is NOT historical correction depth, but current snapshot
   */
  private evaluateWithShortTrend(
    token: string,
    direction: PositionDirection,
    primaryTrend: TrendStatus,
    primaryTimeframe: string,
    shortTrend: TrendStatus,
    shortTimeframe: string,
    currentDeviationPct: number,
  ): EntryTimingEvaluation {
    // Determine if trends are aligned (same direction)
    const trendsAligned = this.areTrendsAligned(primaryTrend, shortTrend);

    // Determine if there's a correction (opposite direction)
    const isCorrection = this.isCorrection(primaryTrend, shortTrend);

    // ⚠️ LIMITATION: Using current MA deviation as correction depth proxy
    // ──────────────────────────────────────────────────────────────────────
    // CURRENT APPROACH:
    //   - Uses trend.change_pct (current price deviation from MA)
    //   - Example: If price is 2% above MA, we assume 2% correction depth
    //
    // PROBLEM:
    //   - Doesn't track actual price extremes (peak-to-trough movement)
    //   - Can trigger entries too early during shallow pullbacks
    //   - Example:
    //       Price went from $100 → $110 (10% up) → $108 (2% pullback)
    //       Current approach: Sees 2% deviation, might enter if aligned
    //       Better approach: Sees 2% correction of a 10% move (not deep enough)
    //
    // IMPACT:
    //   - May enter before correction fully completes
    //   - Could result in suboptimal entry prices
    //   - Risk of entering during larger pullback continuation
    //
    // TODO: Implement proper correction depth tracking
    //   1. Track price extremes (highs for LONG, lows for SHORT) per token/timeframe
    //   2. Calculate: correctionDepth = (currentPrice - extremePrice) / extremePrice
    //   3. Store extremes with timestamps, reset on trend direction change
    //   4. Requires: New service/cache for price extreme tracking
    //   5. Benefit: More accurate correction measurement, better entry timing
    // ──────────────────────────────────────────────────────────────────────

    // Case 1: Trends aligned - potential reversal from correction
    if (trendsAligned) {
      // Current deviation from MA as proxy for correction magnitude
      // NOTE: This is a simplification - see limitation notes above
      const deviationFromMA = Math.abs(currentDeviationPct);

      if (deviationFromMA >= this.config.minCorrectionPct) {
        // Strong reversal signal - price deviated significantly and now aligns
        // ⚠️ May trigger before correction truly completes (see limitation above)
        return {
          shouldEnterNow: true,
          direction,
          timing: 'reversal_detected',
          confidence: 0.85,
          reason: `Reversal detected: ${shortTimeframe} turned ${shortTrend} with ${deviationFromMA.toFixed(1)}% deviation from MA, aligning with 1hr ${primaryTrend}`,
          metadata: {
            primaryTrend,
            primaryTimeframe,
            correctionTrend: shortTrend,
            correctionTimeframe: shortTimeframe,
            correctionDepthPct: deviationFromMA, // Renamed for clarity in metadata
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
          correctionDepthPct: Math.abs(currentDeviationPct),
          reversalDetected: true,
          trendAlignment: true,
        },
      };
    }

    // Case 2: Correction in progress - wait for reversal
    if (isCorrection) {
      const deviationFromMA = Math.abs(currentDeviationPct);

      return {
        shouldEnterNow: false,
        direction,
        timing: 'wait_correction',
        confidence: this.config.reversalConfidence,
        reason: `Correction in progress: ${shortTimeframe} ${shortTrend} (${deviationFromMA.toFixed(1)}% from MA) opposes 1hr ${primaryTrend}, waiting for reversal`,
        metadata: {
          primaryTrend,
          primaryTimeframe,
          correctionTrend: shortTrend,
          correctionTimeframe: shortTimeframe,
          correctionDepthPct: deviationFromMA,
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
          correctionDepthPct: Math.abs(currentDeviationPct),
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
        correctionDepthPct: Math.abs(currentDeviationPct),
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
