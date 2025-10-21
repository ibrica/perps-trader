import { Test, TestingModule } from '@nestjs/testing';
import { ExtremeTrackingService } from './ExtremeTrackingService';
import { IndexerAdapter } from '@perps-infra/indexer/IndexerAdapter';
import { OHLCVResponse, OHLCVCandle } from '@perps-infra/indexer/types';
import { PositionDirection } from '../../constants/PositionDirection';

describe('ExtremeTrackingService', () => {
  let service: ExtremeTrackingService;
  let indexerAdapter: jest.Mocked<IndexerAdapter>;

  // Sample OHLCV data for testing
  const createMockCandles = (count: number = 5): OHLCVCandle[] => {
    const candles: OHLCVCandle[] = [];
    const baseTime = new Date('2025-10-21T12:00:00Z');

    for (let i = 0; i < count; i++) {
      candles.push({
        timestamp: new Date(baseTime.getTime() + i * 60000).toISOString(),
        open_price: 50000 + i * 100,
        high_price: 50500 + i * 100,
        low_price: 49500 + i * 100,
        close_price: 50200 + i * 100,
        volume: 1000 + i * 10,
        trade_count: 100 + i,
      });
    }
    return candles;
  };

  const createMockOHLCVResponse = (candles: OHLCVCandle[]): OHLCVResponse => ({
    token_symbol: 'BTC',
    type: 'main',
    interval: '1m',
    candles,
  });

  beforeEach(async () => {
    // Create mock indexer adapter
    indexerAdapter = {
      getOHLCV: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtremeTrackingService,
        {
          provide: IndexerAdapter,
          useValue: indexerAdapter,
        },
      ],
    }).compile();

    service = module.get<ExtremeTrackingService>(ExtremeTrackingService);
  });

  describe('getExtreme', () => {
    describe('LONG direction (finds lowest price)', () => {
      it('should find the lowest price across all candles', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 49800, // Lowest
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50200,
            high_price: 50600,
            low_price: 50000,
            close_price: 50300,
            volume: 1100,
            trade_count: 110,
          },
          {
            timestamp: '2025-10-21T12:02:00Z',
            open_price: 50300,
            high_price: 50700,
            low_price: 50100,
            close_price: 50400,
            volume: 1200,
            trade_count: 120,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const result = await service.getExtreme('BTC', PositionDirection.LONG);

        expect(result).toEqual({
          price: 49800,
          timestamp: '2025-10-21T12:00:00Z',
          candleCount: 3,
        });
        expect(indexerAdapter.getOHLCV).toHaveBeenCalledWith('BTC', 60);
      });

      it('should use custom lookback period', async () => {
        const candles = createMockCandles(120);
        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        await service.getExtreme('ETH', PositionDirection.LONG, 120);

        expect(indexerAdapter.getOHLCV).toHaveBeenCalledWith('ETH', 120);
      });
    });

    describe('SHORT direction (finds highest price)', () => {
      it('should find the highest price across all candles', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 49800,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50200,
            high_price: 51000, // Highest
            low_price: 50000,
            close_price: 50300,
            volume: 1100,
            trade_count: 110,
          },
          {
            timestamp: '2025-10-21T12:02:00Z',
            open_price: 50300,
            high_price: 50700,
            low_price: 50100,
            close_price: 50400,
            volume: 1200,
            trade_count: 120,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const result = await service.getExtreme('BTC', PositionDirection.SHORT);

        expect(result).toEqual({
          price: 51000,
          timestamp: '2025-10-21T12:01:00Z',
          candleCount: 3,
        });
      });
    });

    describe('error handling', () => {
      it('should throw error when no candles are available', async () => {
        indexerAdapter.getOHLCV.mockResolvedValue(createMockOHLCVResponse([]));

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow('No OHLCV data available for BTC');
      });

      it('should throw error when indexer fails', async () => {
        indexerAdapter.getOHLCV.mockRejectedValue(
          new Error('Indexer service unavailable'),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow('Indexer service unavailable');
      });

      it('should handle null candles array', async () => {
        indexerAdapter.getOHLCV.mockResolvedValue({
          token_symbol: 'BTC',
          type: 'main',
          interval: '1m',
          candles: null as any,
        });

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow('No OHLCV data available for BTC');
      });
    });
  });

  describe('calculateCorrectionDepth', () => {
    describe('LONG direction (upward from low)', () => {
      it('should calculate positive correction when price moved up from low', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 49000, // Extreme low
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50200,
            high_price: 50600,
            low_price: 50000,
            close_price: 50300,
            volume: 1100,
            trade_count: 110,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const currentPrice = 50470; // Price has moved up from low
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.LONG,
          currentPrice,
        );

        // (50470 - 49000) / 49000 * 100 = 3.0%
        expect(result.currentPrice).toBe(50470);
        expect(result.extremePrice).toBe(49000);
        expect(result.depthPercent).toBeCloseTo(3.0, 1);
        expect(result.direction).toBe(PositionDirection.LONG);
      });

      it('should calculate zero correction when current price equals low', async () => {
        const candles = createMockCandles(3);
        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const lowestPrice = Math.min(...candles.map((c) => c.low_price));
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.LONG,
          lowestPrice,
        );

        expect(result.depthPercent).toBeCloseTo(0, 5);
      });

      it('should calculate negative correction when price below low', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 50000, // Previous low
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const currentPrice = 49500; // Below the low
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.LONG,
          currentPrice,
        );

        // (49500 - 50000) / 50000 * 100 = -1.0%
        expect(result.depthPercent).toBeCloseTo(-1.0, 1);
      });
    });

    describe('SHORT direction (downward from high)', () => {
      it('should calculate positive correction when price moved down from high', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 51000, // Extreme high
            low_price: 49500,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50200,
            high_price: 50600,
            low_price: 50000,
            close_price: 50300,
            volume: 1100,
            trade_count: 110,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const currentPrice = 49980; // Price has moved down from high
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.SHORT,
          currentPrice,
        );

        // (51000 - 49980) / 51000 * 100 = 2.0%
        expect(result.currentPrice).toBe(49980);
        expect(result.extremePrice).toBe(51000);
        expect(result.depthPercent).toBeCloseTo(2.0, 1);
        expect(result.direction).toBe(PositionDirection.SHORT);
      });

      it('should calculate zero correction when current price equals high', async () => {
        const candles = createMockCandles(3);
        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const highestPrice = Math.max(...candles.map((c) => c.high_price));
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.SHORT,
          highestPrice,
        );

        expect(result.depthPercent).toBeCloseTo(0, 5);
      });

      it('should calculate negative correction when price above high', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 49800,
            high_price: 50000, // Previous high
            low_price: 49500,
            close_price: 49900,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const currentPrice = 50500; // Above the high
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.SHORT,
          currentPrice,
        );

        // (50000 - 50500) / 50000 * 100 = -1.0%
        expect(result.depthPercent).toBeCloseTo(-1.0, 1);
      });
    });

    describe('edge cases', () => {
      it('should handle very large correction depths', async () => {
        const candles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 10000, // Extreme low (major drop)
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const currentPrice = 50000;
        const result = await service.calculateCorrectionDepth(
          'BTC',
          PositionDirection.LONG,
          currentPrice,
        );

        // (50000 - 10000) / 10000 * 100 = 400%
        expect(result.depthPercent).toBeCloseTo(400, 0);
      });

      it('should propagate errors from getExtreme', async () => {
        indexerAdapter.getOHLCV.mockRejectedValue(new Error('Network error'));

        await expect(
          service.calculateCorrectionDepth(
            'BTC',
            PositionDirection.LONG,
            50000,
          ),
        ).rejects.toThrow('Network error');
      });
    });
  });

  describe('isCorrectionDeepEnough', () => {
    it('should return true when correction depth exceeds threshold', () => {
      const correctionDepth = {
        currentPrice: 50500,
        extremePrice: 49000,
        depthPercent: 3.06, // Above 1.5% threshold
        direction: PositionDirection.LONG,
      };

      const result = service.isCorrectionDeepEnough(correctionDepth, 1.5);
      expect(result).toBe(true);
    });

    it('should return true when correction depth equals threshold', () => {
      const correctionDepth = {
        currentPrice: 50750,
        extremePrice: 50000,
        depthPercent: 1.5, // Exactly 1.5%
        direction: PositionDirection.LONG,
      };

      const result = service.isCorrectionDeepEnough(correctionDepth, 1.5);
      expect(result).toBe(true);
    });

    it('should return false when correction depth below threshold', () => {
      const correctionDepth = {
        currentPrice: 50500,
        extremePrice: 50000,
        depthPercent: 1.0, // Below 1.5% threshold
        direction: PositionDirection.LONG,
      };

      const result = service.isCorrectionDeepEnough(correctionDepth, 1.5);
      expect(result).toBe(false);
    });

    it('should handle negative correction depths correctly', () => {
      const correctionDepth = {
        currentPrice: 49500,
        extremePrice: 50000,
        depthPercent: -1.0, // Negative (price moving wrong direction)
        direction: PositionDirection.LONG,
      };

      // abs(-1.0) = 1.0, which is below 1.5 threshold
      const result = service.isCorrectionDeepEnough(correctionDepth, 1.5);
      expect(result).toBe(false);
    });

    it('should work with different threshold values', () => {
      const correctionDepth = {
        currentPrice: 50500,
        extremePrice: 50000,
        depthPercent: 1.0,
        direction: PositionDirection.LONG,
      };

      expect(service.isCorrectionDeepEnough(correctionDepth, 0.5)).toBe(true);
      expect(service.isCorrectionDeepEnough(correctionDepth, 1.0)).toBe(true);
      expect(service.isCorrectionDeepEnough(correctionDepth, 1.5)).toBe(false);
      expect(service.isCorrectionDeepEnough(correctionDepth, 2.0)).toBe(false);
    });

    it('should handle very small correction depths', () => {
      const correctionDepth = {
        currentPrice: 50000.5,
        extremePrice: 50000,
        depthPercent: 0.001, // Very small correction
        direction: PositionDirection.LONG,
      };

      const result = service.isCorrectionDeepEnough(correctionDepth, 1.5);
      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete LONG entry scenario', async () => {
      // Scenario: Price dropped from 51000 to 49000, now at 50470
      const candles = [
        {
          timestamp: '2025-10-21T12:00:00Z',
          open_price: 51000,
          high_price: 51200,
          low_price: 49000, // The bottom
          close_price: 49500,
          volume: 5000,
          trade_count: 500,
        },
        {
          timestamp: '2025-10-21T12:01:00Z',
          open_price: 49500,
          high_price: 50500,
          low_price: 49200,
          close_price: 50470, // Current price
          volume: 4000,
          trade_count: 400,
        },
      ];

      indexerAdapter.getOHLCV.mockResolvedValue(
        createMockOHLCVResponse(candles),
      );

      const currentPrice = 50470;
      const depth = await service.calculateCorrectionDepth(
        'BTC',
        PositionDirection.LONG,
        currentPrice,
      );

      expect(depth.extremePrice).toBe(49000);
      expect(depth.currentPrice).toBe(50470);
      expect(depth.depthPercent).toBeCloseTo(3.0, 1); // ~3% up from low

      const isDeepEnough = service.isCorrectionDeepEnough(depth, 1.5);
      expect(isDeepEnough).toBe(true); // Should enter LONG
    });

    it('should handle complete SHORT entry scenario', async () => {
      // Scenario: Price rose from 49000 to 51000, now at 49980
      const candles = [
        {
          timestamp: '2025-10-21T12:00:00Z',
          open_price: 49000,
          high_price: 51000, // The peak
          low_price: 48800,
          close_price: 50500,
          volume: 5000,
          trade_count: 500,
        },
        {
          timestamp: '2025-10-21T12:01:00Z',
          open_price: 50500,
          high_price: 50800,
          low_price: 49800,
          close_price: 49980, // Current price
          volume: 4000,
          trade_count: 400,
        },
      ];

      indexerAdapter.getOHLCV.mockResolvedValue(
        createMockOHLCVResponse(candles),
      );

      const currentPrice = 49980;
      const depth = await service.calculateCorrectionDepth(
        'BTC',
        PositionDirection.SHORT,
        currentPrice,
      );

      expect(depth.extremePrice).toBe(51000);
      expect(depth.currentPrice).toBe(49980);
      expect(depth.depthPercent).toBeCloseTo(2.0, 1); // ~2% down from high

      const isDeepEnough = service.isCorrectionDeepEnough(depth, 1.5);
      expect(isDeepEnough).toBe(true); // Should enter SHORT
    });
  });

  describe('OHLCV data validation', () => {
    describe('insufficient candle count', () => {
      it('should warn when fewer than 50% of expected candles received', async () => {
        const candles = createMockCandles(20); // Only 20 out of 60 requested
        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.getExtreme('BTC', PositionDirection.LONG, 60);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Insufficient OHLCV data for BTC: got 20 candles, expected at least 30',
          ),
        );
      });

      it('should not warn when candle count is sufficient', async () => {
        const candles = createMockCandles(50); // 50 out of 60 = 83%
        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.getExtreme('BTC', PositionDirection.LONG, 60);

        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Insufficient OHLCV data'),
        );
      });
    });

    describe('price integrity validation', () => {
      it('should throw error when high < low', async () => {
        const invalidCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 49000, // HIGH LOWER THAN LOW - INVALID!
            low_price: 50000,
            close_price: 49500,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(invalidCandles),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow(/Invalid OHLCV data.*high.*49000.*<.*low.*50000/);
      });

      it('should throw error when open price outside [low, high] range', async () => {
        const invalidCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 51000, // OPEN ABOVE HIGH - INVALID!
            high_price: 50500,
            low_price: 49500,
            close_price: 50000,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(invalidCandles),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow(/Invalid OHLCV data.*open.*51000.*outside/);
      });

      it('should throw error when close price outside [low, high] range', async () => {
        const invalidCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 49500,
            close_price: 49000, // CLOSE BELOW LOW - INVALID!
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(invalidCandles),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow(/Invalid OHLCV data.*close.*49000.*outside/);
      });

      it('should throw error when prices are non-positive', async () => {
        const invalidCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 0, // ZERO PRICE - INVALID!
            close_price: 50000,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(invalidCandles),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow(/Invalid OHLCV data.*contains non-positive prices/);
      });

      it('should report multiple validation errors (up to 3)', async () => {
        const invalidCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 60000, // Outside range
            high_price: 49000, // Less than low
            low_price: 50000,
            close_price: 45000, // Outside range
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50000,
            high_price: 50000,
            low_price: -100, // Negative price
            close_price: 50000,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(invalidCandles),
        );

        await expect(
          service.getExtreme('BTC', PositionDirection.LONG),
        ).rejects.toThrow(/Invalid OHLCV data for BTC:.*(high|open|close)/);
      });

      it('should accept valid OHLCV data', async () => {
        const validCandles = [
          {
            timestamp: '2025-10-21T12:00:00Z',
            open_price: 50000,
            high_price: 50500,
            low_price: 49500,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: '2025-10-21T12:01:00Z',
            open_price: 50200,
            high_price: 50600,
            low_price: 50000,
            close_price: 50400,
            volume: 1100,
            trade_count: 110,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(validCandles),
        );

        // Should not throw
        const result = await service.getExtreme('BTC', PositionDirection.LONG);
        expect(result).toBeDefined();
        expect(result.price).toBe(49500); // Lowest low
      });
    });

    describe('timestamp freshness validation', () => {
      it('should warn when most recent candle is older than 5 minutes', async () => {
        const staleTime = new Date(Date.now() - 10 * 60000); // 10 minutes ago
        const staleCandles = [
          {
            timestamp: staleTime.toISOString(),
            open_price: 50000,
            high_price: 50500,
            low_price: 49500,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(staleCandles),
        );

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.getExtreme('BTC', PositionDirection.LONG);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /OHLCV data for BTC may be stale.*10\.\d minutes old/,
          ),
        );
      });

      it('should not warn when data is fresh (within 5 minutes)', async () => {
        const recentTime = new Date(Date.now() - 2 * 60000); // 2 minutes ago
        const freshCandles = [
          {
            timestamp: recentTime.toISOString(),
            open_price: 50000,
            high_price: 50500,
            low_price: 49500,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(freshCandles),
        );

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.getExtreme('BTC', PositionDirection.LONG);

        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('may be stale'),
        );
      });

      it('should find most recent candle from unsorted data', async () => {
        const now = Date.now();
        const candles = [
          {
            timestamp: new Date(now - 10 * 60000).toISOString(), // 10m ago
            open_price: 50000,
            high_price: 50500,
            low_price: 49500,
            close_price: 50200,
            volume: 1000,
            trade_count: 100,
          },
          {
            timestamp: new Date(now - 1 * 60000).toISOString(), // 1m ago (most recent)
            open_price: 50200,
            high_price: 50600,
            low_price: 50000,
            close_price: 50400,
            volume: 1100,
            trade_count: 110,
          },
          {
            timestamp: new Date(now - 5 * 60000).toISOString(), // 5m ago
            open_price: 50100,
            high_price: 50550,
            low_price: 49900,
            close_price: 50300,
            volume: 1050,
            trade_count: 105,
          },
        ];

        indexerAdapter.getOHLCV.mockResolvedValue(
          createMockOHLCVResponse(candles),
        );

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.getExtreme('BTC', PositionDirection.LONG);

        // Should not warn because most recent is only 1 minute old
        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('may be stale'),
        );
      });
    });
  });
});
