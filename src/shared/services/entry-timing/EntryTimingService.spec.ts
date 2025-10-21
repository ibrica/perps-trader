import { EntryTimingService, EntryTimingConfig } from './EntryTimingService';
import {
  TrendsResponse,
  TrendTimeframe,
  TrendStatus,
  TrendInfo,
} from '../../models/predictor/types';
import { PositionDirection } from '../../constants/PositionDirection';

describe('EntryTimingService', () => {
  let service: EntryTimingService;
  let config: EntryTimingConfig;

  // Helper to create trend info
  const createTrendInfo = (
    trend: TrendStatus,
    change_pct: number | null = null,
    price: number | null = null,
    ma: number | null = null,
  ): TrendInfo => ({
    trend,
    change_pct,
    price,
    ma,
  });

  // Helper to create full trends response
  const createTrendsResponse = (
    onehour: TrendStatus,
    fivemin: TrendStatus,
    fifteenmin: TrendStatus,
    fiveMinChangePct = 2.0,
    fifteenMinChangePct = 1.5,
  ): TrendsResponse => ({
    token: 'BTC',
    timestamp: new Date().toISOString(),
    trends: {
      [TrendTimeframe.FIVE_MIN]: createTrendInfo(
        fivemin,
        fivemin === TrendStatus.UNDEFINED ? null : fiveMinChangePct,
        fivemin === TrendStatus.UNDEFINED ? null : 45000,
        fivemin === TrendStatus.UNDEFINED ? null : 44000,
      ),
      [TrendTimeframe.FIFTEEN_MIN]: createTrendInfo(
        fifteenmin,
        fifteenmin === TrendStatus.UNDEFINED ? null : fifteenMinChangePct,
        fifteenmin === TrendStatus.UNDEFINED ? null : 45000,
        fifteenmin === TrendStatus.UNDEFINED ? null : 44000,
      ),
      [TrendTimeframe.ONE_HOUR]: createTrendInfo(
        onehour,
        onehour === TrendStatus.UNDEFINED ? null : 3.0,
        onehour === TrendStatus.UNDEFINED ? null : 45000,
        onehour === TrendStatus.UNDEFINED ? null : 43000,
      ),
      [TrendTimeframe.EIGHT_HOUR]: createTrendInfo(
        TrendStatus.UP,
        4.0,
        45000,
        42000,
      ),
      [TrendTimeframe.ONE_DAY]: createTrendInfo(
        TrendStatus.UP,
        5.0,
        45000,
        41000,
      ),
    },
  });

  beforeEach(() => {
    // Default config for tests
    config = {
      enabled: true,
      shortTimeframe: '5m',
      minCorrectionPct: 1.5,
      reversalConfidence: 0.6,
      useRealExtremes: false, // Disabled for tests (no external dependency)
      extremeLookbackMinutes: 60,
    };
    service = new EntryTimingService(config);
  });

  describe('evaluateEntryTiming - LONG scenarios', () => {
    it('should detect reversal for LONG entry (1hr UP, 5m UP after correction)', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UP,
        TrendStatus.UP,
        2.5, // 5m correction depth
        1.8,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.timing).toBe('reversal_detected');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('Reversal detected');
      expect(result.metadata.reversalDetected).toBe(true);
      expect(result.metadata.trendAlignment).toBe(true);
    });

    it('should wait during correction for LONG entry (1hr UP, 5m DOWN)', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.DOWN,
        TrendStatus.UP,
        -2.0, // Negative for DOWN correction
        1.5,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(false);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.timing).toBe('wait_correction');
      expect(result.confidence).toBe(0.6);
      expect(result.reason).toContain('Correction in progress');
      expect(result.metadata.reversalDetected).toBe(false);
      expect(result.metadata.trendAlignment).toBe(false);
    });

    it('should enter on NEUTRAL short term for LONG (1hr UP, 5m NEUTRAL)', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.NEUTRAL,
        TrendStatus.UP,
        0.5,
        1.5,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.timing).toBe('immediate');
      expect(result.confidence).toBe(0.65);
      expect(result.reason).toContain('NEUTRAL');
    });
  });

  describe('evaluateEntryTiming - SHORT scenarios', () => {
    it('should detect reversal for SHORT entry (1hr DOWN, 5m DOWN after correction)', async () => {
      const trends = createTrendsResponse(
        TrendStatus.DOWN,
        TrendStatus.DOWN,
        TrendStatus.DOWN,
        -2.5, // 5m correction depth (negative for DOWN)
        -1.8,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.SHORT);
      expect(result.timing).toBe('reversal_detected');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.metadata.reversalDetected).toBe(true);
    });

    it('should wait during correction for SHORT entry (1hr DOWN, 5m UP)', async () => {
      const trends = createTrendsResponse(
        TrendStatus.DOWN,
        TrendStatus.UP,
        TrendStatus.DOWN,
        2.0, // Positive for UP correction
        -1.5,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(false);
      expect(result.direction).toBe(PositionDirection.SHORT);
      expect(result.timing).toBe('wait_correction');
      expect(result.reason).toContain('Correction in progress');
    });
  });

  describe('evaluateEntryTiming - Edge cases', () => {
    it('should reject when 1hr trend is UNDEFINED', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UNDEFINED,
        TrendStatus.UP,
        TrendStatus.UP,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(false);
      expect(result.direction).toBe(null);
      expect(result.timing).toBe('no_signal');
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('UNDEFINED');
    });

    it('should reject when 1hr trend is NEUTRAL', async () => {
      const trends = createTrendsResponse(
        TrendStatus.NEUTRAL,
        TrendStatus.UP,
        TrendStatus.UP,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(false);
      expect(result.direction).toBe(null);
      expect(result.timing).toBe('no_signal');
      expect(result.reason).toContain('NEUTRAL');
    });

    it('should fallback to 15m when 5m is UNDEFINED', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UNDEFINED,
        TrendStatus.UP,
        0,
        2.0, // 15m has good correction
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.metadata.correctionTimeframe).toBe('15m');
    });

    it('should enter immediately when both 5m and 15m are UNDEFINED', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UNDEFINED,
        TrendStatus.UNDEFINED,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.timing).toBe('immediate');
      expect(result.confidence).toBe(0.6);
      expect(result.reason).toContain('short timeframes unavailable');
    });
  });

  describe('evaluateEntryTiming - Configuration', () => {
    it('should use immediate entry when timing optimization is disabled', async () => {
      config.enabled = false;
      service = new EntryTimingService(config);

      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.DOWN, // Even with correction
        TrendStatus.UP,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(true);
      expect(result.direction).toBe(PositionDirection.LONG);
      expect(result.timing).toBe('immediate');
      expect(result.reason).toContain('timing disabled');
    });

    it('should use 15m when configured as short timeframe', async () => {
      config.shortTimeframe = '15m';
      service = new EntryTimingService(config);

      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UP,
        TrendStatus.DOWN, // 15m has correction
        2.0,
        -1.8,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.shouldEnterNow).toBe(false);
      expect(result.timing).toBe('wait_correction');
      expect(result.metadata.correctionTimeframe).toBe('15m');
    });

    it('should respect custom minimum correction percentage', async () => {
      config.minCorrectionPct = 3.0; // High threshold
      service = new EntryTimingService(config);

      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UP, // Aligned
        TrendStatus.UP,
        2.0, // Below 3.0 threshold
        1.5,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      // Should enter but with lower confidence (mild reversal)
      expect(result.shouldEnterNow).toBe(true);
      expect(result.confidence).toBe(0.7); // Not 0.85 (strong reversal)
      expect(result.reason).toContain('aligns');
    });
  });

  describe('evaluateEntryTiming - Confidence scoring', () => {
    it('should give high confidence for strong reversal after deep correction', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UP,
        TrendStatus.UP,
        3.5, // Deep correction
        2.0,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.confidence).toBe(0.85);
      expect(result.reason).toContain('Reversal detected');
      expect(result.reason).toContain('3.5%');
    });

    it('should give medium confidence for alignment without deep correction', async () => {
      const trends = createTrendsResponse(
        TrendStatus.UP,
        TrendStatus.UP,
        TrendStatus.UP,
        1.0, // Shallow correction
        0.8,
      );

      const result = await service.evaluateEntryTiming('BTC', trends);

      expect(result.confidence).toBe(0.7);
      expect(result.reason).toContain('aligns');
    });
  });
});
