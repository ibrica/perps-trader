import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TrailingService } from './Trailing.service';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';
import { PositionDirection } from '../../shared';
import {
  PredictionHorizon,
  Recommendation,
  TokenCategory,
} from '../../shared/models/predictor/types';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

describe('TrailingService', () => {
  let service: TrailingService;
  let configService: jest.Mocked<ConfigService>;
  let predictorAdapter: jest.Mocked<PredictorAdapter>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'hyperliquid.trailingActivationRatio': 0.8,
          'hyperliquid.trailingMinIntervalMs': 300000, // 5 minutes
          'hyperliquid.trailingTpOffsetPercent': 10,
          'hyperliquid.trailingStopOffsetPercent': 2,
          'hyperliquid.predictorMinConfidence': 0.6,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const mockPredictorAdapter = {
      predictToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrailingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PredictorAdapter,
          useValue: mockPredictorAdapter,
        },
      ],
    }).compile();

    service = module.get<TrailingService>(TrailingService);
    configService = module.get(ConfigService);
    predictorAdapter = module.get(PredictorAdapter);
  });

  describe('calculateProgressToTp', () => {
    it('should calculate 0% progress at entry price for LONG position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        100, // currentPrice = entry
        100, // entryPrice
        110, // takeProfitPrice
      );
      expect(result).toBe(0);
    });

    it('should calculate 100% progress at TP price for LONG position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        110, // currentPrice = TP
        100, // entryPrice
        110, // takeProfitPrice
      );
      expect(result).toBe(1);
    });

    it('should calculate 50% progress midway for LONG position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        105, // currentPrice = midway
        100, // entryPrice
        110, // takeProfitPrice
      );
      expect(result).toBe(0.5);
    });

    it('should calculate >100% progress beyond TP for LONG position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        120, // currentPrice > TP
        100, // entryPrice
        110, // takeProfitPrice
      );
      expect(result).toBe(2); // 200% of target move
    });

    it('should calculate negative progress below entry for LONG position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        95, // currentPrice < entry
        100, // entryPrice
        110, // takeProfitPrice
      );
      expect(result).toBe(-0.5); // Moving against position
    });

    it('should calculate 0% progress at entry price for SHORT position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.SHORT,
        100, // currentPrice = entry
        100, // entryPrice
        90, // takeProfitPrice (lower for SHORT)
      );
      expect(result).toBe(0);
    });

    it('should calculate 100% progress at TP price for SHORT position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.SHORT,
        90, // currentPrice = TP
        100, // entryPrice
        90, // takeProfitPrice
      );
      expect(result).toBe(1);
    });

    it('should calculate 50% progress midway for SHORT position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.SHORT,
        95, // currentPrice = midway
        100, // entryPrice
        90, // takeProfitPrice
      );
      expect(result).toBe(0.5);
    });

    it('should calculate >100% progress beyond TP for SHORT position', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.SHORT,
        80, // currentPrice < TP (good for SHORT)
        100, // entryPrice
        90, // takeProfitPrice
      );
      expect(result).toBe(2); // 200% of target move
    });

    it('should handle division by zero when entry equals TP for LONG', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.LONG,
        100, // currentPrice
        100, // entryPrice
        100, // takeProfitPrice (same as entry - invalid)
      );
      expect(result).toBe(0);
    });

    it('should handle division by zero when entry equals TP for SHORT', () => {
      const result = service['calculateProgressToTp'](
        PositionDirection.SHORT,
        100, // currentPrice
        100, // entryPrice
        100, // takeProfitPrice (same as entry - invalid)
      );
      expect(result).toBe(0);
    });
  });

  describe('evaluateTrailing', () => {
    let mockPosition: TradePositionDocument;

    beforeEach(() => {
      mockPosition = {
        token: 'ETH',
        positionDirection: PositionDirection.LONG,
        entryPrice: 2000,
        takeProfitPrice: 2500,
        lastTrailAt: null,
      } as TradePositionDocument;

      // Default AI prediction to support trailing
      predictorAdapter.predictToken.mockResolvedValue({
        token_address: 'ETH',
        recommendation: Recommendation.BUY,
        confidence: 0.8,
        percentage_change: 5,
        predicted_curve_position_change: 'up',
        timestamp: new Date().toISOString(),
        model_version: 'v1.0',
      });
    });

    describe('validation checks', () => {
      it('should not trail when entry price is missing', async () => {
        mockPosition.entryPrice = undefined;
        const result = await service.evaluateTrailing(mockPosition, 2400);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe('Missing entry or take profit price');
      });

      it('should not trail when take profit price is missing', async () => {
        mockPosition.takeProfitPrice = undefined;
        const result = await service.evaluateTrailing(mockPosition, 2400);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe('Missing entry or take profit price');
      });

      it('should not trail when current price is invalid (zero)', async () => {
        const result = await service.evaluateTrailing(mockPosition, 0);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe('Invalid current price');
      });

      it('should not trail when current price is invalid (negative)', async () => {
        const result = await service.evaluateTrailing(mockPosition, -100);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe('Invalid current price');
      });

      it('should not trail when current price is invalid (null)', async () => {
        const result = await service.evaluateTrailing(mockPosition, null);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe('Invalid current price');
      });
    });

    describe('progress threshold', () => {
      it('should not trail when progress < 80% (activation threshold)', async () => {
        // Current price at 70% progress: 2000 + (500 * 0.7) = 2350
        const result = await service.evaluateTrailing(mockPosition, 2350);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('Progress to TP');
        expect(result.reason).toContain('70.0%');
        expect(result.reason).toContain('80.0%');
        expect(result.progressToTp).toBeCloseTo(0.7, 2);
      });

      it('should check progress when at exactly 80%', async () => {
        // Current price at 80% progress: 2000 + (500 * 0.8) = 2400
        const result = await service.evaluateTrailing(mockPosition, 2400);

        expect(result.progressToTp).toBeCloseTo(0.8, 2);
        // Will pass progress check but may fail other checks
      });

      it('should pass progress check when > 80%', async () => {
        // Current price at 90% progress: 2000 + (500 * 0.9) = 2450
        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.progressToTp).toBeCloseTo(0.9, 2);
        // Should pass progress check (may fail other checks in full evaluation)
      });

      it('should calculate progress correctly for SHORT positions', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.entryPrice = 2000;
        mockPosition.takeProfitPrice = 1500; // TP is lower for SHORT

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.8,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Current price at 70% progress: 2000 - (500 * 0.7) = 1650
        const result = await service.evaluateTrailing(mockPosition, 1650);

        expect(result.shouldTrail).toBe(false);
        expect(result.progressToTp).toBeCloseTo(0.7, 2);
      });
    });

    describe('rate limiting', () => {
      it('should not trail when rate limited (last trail < 5 minutes ago)', async () => {
        // Set last trail to 2 minutes ago
        mockPosition.lastTrailAt = new Date(Date.now() - 2 * 60 * 1000);

        // Current price at 90% progress
        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('Rate limited');
        expect(result.reason).toContain('120s since last trail');
        expect(result.reason).toContain('min: 300s');
      });

      it('should pass rate limit when last trail > 5 minutes ago', async () => {
        // Set last trail to 6 minutes ago
        mockPosition.lastTrailAt = new Date(Date.now() - 6 * 60 * 1000);

        // Current price at 90% progress
        const result = await service.evaluateTrailing(mockPosition, 2450);

        // Should pass rate limit check (may fail other checks)
        expect(result.reason).not.toContain('Rate limited');
      });

      it('should pass rate limit when never trailed before', async () => {
        mockPosition.lastTrailAt = null;

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.reason).not.toContain('Rate limited');
      });
    });

    describe('TP movement guard', () => {
      it('should not trail when TP movement < 0.5%', async () => {
        // This test needs:
        // 1. Progress > 80%
        // 2. TP change < 0.5%
        // 3. No rate limiting
        // 4. Pass AI check

        // Working backwards from constraint #2:
        // New TP offset is 10%, so if current = C, new TP = C * 1.10
        // For change < 0.5%: |C * 1.10 - oldTP| / oldTP < 0.005
        // This means oldTP must be very close to C * 1.10

        // Let's use: Entry = 100, Current = 180, Old TP = 198
        // Progress: (180 - 100) / (198 - 100) = 80 / 98 = 81.6% ✓
        // New TP: 180 * 1.10 = 198
        // Change: |198 - 198| / 198 = 0% < 0.5% ✓

        mockPosition.entryPrice = 100;
        mockPosition.takeProfitPrice = 198;
        mockPosition.lastTrailAt = null;

        const result = await service.evaluateTrailing(mockPosition, 180);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('TP movement too small');
        expect(result.reason).toContain('< 0.5%');
      });

      it('should pass TP movement check when change >= 0.5%', async () => {
        // Current at 2450, new TP = 2695, old TP = 2500
        // Change: 7.8% which is >= 0.5%
        mockPosition.takeProfitPrice = 2500;

        const result = await service.evaluateTrailing(mockPosition, 2450);

        // Should pass TP movement check
        expect(result.reason).not.toContain('TP movement too small');
      });
    });

    describe('AI signal interpretation', () => {
      beforeEach(() => {
        // Set position at 90% progress, no rate limit
        mockPosition.entryPrice = 2000;
        mockPosition.takeProfitPrice = 2500;
        mockPosition.lastTrailAt = null;
      });

      it('should not trail when AI confidence is too low', async () => {
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.5, // Below 0.6 threshold
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('AI confidence');
        expect(result.reason).toContain('0.50');
        expect(result.reason).toContain('0.6');
      });

      it('should not trail for LONG when AI recommends SELL', async () => {
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.8,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('AI SELL does not align with LONG');
      });

      it('should trail for LONG when AI recommends BUY with high confidence', async () => {
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.85,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('AI BUY with 0.85 confidence');
        expect(result.newStopLossPrice).toBeDefined();
        expect(result.newTakeProfitPrice).toBeDefined();
      });

      it('should trail for LONG when AI shows positive percentage_change', async () => {
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.HOLD,
          confidence: 0.7,
          percentage_change: 3,
          predicted_curve_position_change: 'stable',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('AI HOLD with 0.70 confidence');
      });

      it('should not trail for SHORT when AI recommends BUY', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.takeProfitPrice = 1500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Price at 90% progress for SHORT: 2000 - (500 * 0.9) = 1550
        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('AI BUY does not align with SHORT');
      });

      it('should trail for SHORT when AI recommends SELL with high confidence', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.takeProfitPrice = 1500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.85,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Price at 90% progress for SHORT: 2000 - (500 * 0.9) = 1550
        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('AI SELL with 0.85 confidence');
      });

      it('should trail for SHORT when AI shows negative percentage_change', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.takeProfitPrice = 1500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.HOLD,
          confidence: 0.7,
          percentage_change: -3,
          predicted_curve_position_change: 'stable',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Price at 90% progress for SHORT
        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('AI HOLD with 0.70 confidence');
      });

      it('should not trail when AI prediction is unavailable', async () => {
        predictorAdapter.predictToken.mockResolvedValue(null);

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toBe(
          'AI does not support continuation: No AI prediction available',
        );
      });

      it('should not trail when AI prediction throws error', async () => {
        predictorAdapter.predictToken.mockRejectedValue(
          new Error('API timeout'),
        );

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(false);
        expect(result.reason).toContain('AI check failed: API timeout');
      });

      it('should call predictToken with correct parameters', async () => {
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        await service.evaluateTrailing(mockPosition, 2450);

        expect(predictorAdapter.predictToken).toHaveBeenCalledWith(
          'ETH',
          TokenCategory.MAIN_COINS, // ETH is a main coin
          PredictionHorizon.ONE_HOUR,
          true,
        );
      });

      it('should categorize alt coins correctly', async () => {
        mockPosition.token = 'DOGE';

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        await service.evaluateTrailing(mockPosition, 2450);

        expect(predictorAdapter.predictToken).toHaveBeenCalledWith(
          'DOGE',
          TokenCategory.ALT_COINS,
          PredictionHorizon.ONE_HOUR,
          true,
        );
      });
    });

    describe('price validation', () => {
      beforeEach(() => {
        mockPosition.lastTrailAt = null;
        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });
      });

      it('should calculate new prices correctly for LONG position', async () => {
        // Current at 2450
        // New TP = 2450 * 1.10 = 2695
        // New SL = 2450 * 0.98 = 2401

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(true);
        expect(result.newTakeProfitPrice).toBeCloseTo(2695, 0);
        expect(result.newStopLossPrice).toBeCloseTo(2401, 0);
      });

      it('should calculate new prices correctly for SHORT position', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.takeProfitPrice = 1500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.8,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Current at 1550
        // New TP = 1550 * 0.90 = 1395
        // New SL = 1550 * 1.02 = 1581

        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(true);
        expect(result.newTakeProfitPrice).toBeCloseTo(1395, 0);
        expect(result.newStopLossPrice).toBeCloseTo(1581, 0);
      });

      it('should validate LONG prices correctly (SL < current < TP)', async () => {
        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(true);
        expect(result.newStopLossPrice).toBeLessThan(2450);
        expect(result.newTakeProfitPrice).toBeGreaterThan(2450);
      });

      it('should validate SHORT prices correctly (TP < current < SL)', async () => {
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.takeProfitPrice = 1500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.8,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(true);
        expect(result.newTakeProfitPrice).toBeLessThan(1550);
        expect(result.newStopLossPrice).toBeGreaterThan(1550);
      });
    });

    describe('full integration scenarios', () => {
      it('should trail successfully when all conditions are met for LONG', async () => {
        mockPosition.entryPrice = 2000;
        mockPosition.takeProfitPrice = 2500;
        mockPosition.positionDirection = PositionDirection.LONG;
        mockPosition.lastTrailAt = null;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.85,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2450);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('Trailing activated');
        expect(result.reason).toContain('progress=90.0%');
        expect(result.reason).toContain('AI=AI BUY with 0.85 confidence');
        expect(result.progressToTp).toBeCloseTo(0.9, 2);
        expect(result.newStopLossPrice).toBeCloseTo(2401, 0);
        expect(result.newTakeProfitPrice).toBeCloseTo(2695, 0);
      });

      it('should trail successfully when all conditions are met for SHORT', async () => {
        mockPosition.entryPrice = 2000;
        mockPosition.takeProfitPrice = 1500;
        mockPosition.positionDirection = PositionDirection.SHORT;
        mockPosition.lastTrailAt = null;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.SELL,
          confidence: 0.85,
          percentage_change: -5,
          predicted_curve_position_change: 'down',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 1550);

        expect(result.shouldTrail).toBe(true);
        expect(result.reason).toContain('Trailing activated');
        expect(result.progressToTp).toBeCloseTo(0.9, 2);
        expect(result.newStopLossPrice).toBeCloseTo(1581, 0);
        expect(result.newTakeProfitPrice).toBeCloseTo(1395, 0);
      });

      it('should not trail when multiple conditions fail', async () => {
        // Low progress + rate limited
        mockPosition.lastTrailAt = new Date(Date.now() - 1 * 60 * 1000);

        const result = await service.evaluateTrailing(mockPosition, 2100);

        expect(result.shouldTrail).toBe(false);
        // Should fail on first check (progress)
        expect(result.reason).toContain('Progress to TP');
      });

      it('should handle edge case: price exactly at TP', async () => {
        mockPosition.takeProfitPrice = 2500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        const result = await service.evaluateTrailing(mockPosition, 2500);

        // Progress = 100%
        expect(result.progressToTp).toBe(1);
        // Should pass progress check and may succeed if other checks pass
      });

      it('should handle edge case: price beyond TP (>100% progress)', async () => {
        mockPosition.takeProfitPrice = 2500;

        predictorAdapter.predictToken.mockResolvedValue({
          token_address: 'ETH',
          recommendation: Recommendation.BUY,
          confidence: 0.8,
          percentage_change: 5,
          predicted_curve_position_change: 'up',
          timestamp: new Date().toISOString(),
          model_version: 'v1.0',
        });

        // Price way beyond TP
        const result = await service.evaluateTrailing(mockPosition, 2600);

        // Progress > 100%
        expect(result.progressToTp).toBeGreaterThan(1);
      });

      it('should handle edge case: price below entry (negative progress)', async () => {
        const result = await service.evaluateTrailing(mockPosition, 1900);

        expect(result.shouldTrail).toBe(false);
        expect(result.progressToTp).toBeLessThan(0);
        expect(result.reason).toContain('Progress to TP');
      });
    });
  });
});
