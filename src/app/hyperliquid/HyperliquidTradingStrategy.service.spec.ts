import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HyperliquidTradingStrategyService } from './HyperliquidTradingStrategy.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PerpService } from '../perps/Perp.service';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';
import { PlatformTradingParams } from '../../shared/ports/trading/PlatformTradingStrategyPort';
import { PositionDirection, Currency } from '../../shared';
import {
  TokenCategory,
  PredictionHorizon,
  Recommendation,
  TrendStatus,
} from '../../shared/models/predictor/types';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { EntryTimingService } from '../../shared/services/entry-timing';

describe('HyperliquidTradingStrategyService', () => {
  let service: HyperliquidTradingStrategyService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockHyperliquidService: jest.Mocked<HyperliquidService>;
  let mockPerpService: jest.Mocked<PerpService>;
  let mockPredictorAdapter: jest.Mocked<PredictorAdapter>;
  let mockEntryTimingService: jest.Mocked<EntryTimingService>;

  const mockTokenAddress = 'So11111111111111111111111111111111111111112';

  const mockPosition: Partial<TradePositionDocument> = {
    _id: 'position-123',
    token: 'BTC',
    entryPrice: 50000,
    positionSize: 0.1, // 0.1 BTC
    leverage: 10,
    exitFlag: false,
  };

  const mockTradingParams: PlatformTradingParams = {
    maxOpenPositions: 5,
    defaultAmountIn: 1000, // 1000 USDC
    stopLossPercent: 0.05, // 5%
    takeProfitPercent: 0.1, // 10%
  };

  const createMockPrediction = (recommendation: Recommendation) => ({
    token_address: mockTokenAddress,
    category: TokenCategory.MAIN_COINS,
    recommendation,
    confidence:
      recommendation === Recommendation.BUY
        ? 0.85
        : recommendation === Recommendation.SELL
          ? 0.9
          : 0.5,
    predicted_curve_position_change: '+12.3% curve position (over 1h)',
    percentage_change: 12.3,
    reasoning: {
      key_factors: ['Strong buying pressure'],
      risk_factors: ['Market volatility'],
      bot_activity: {
        bot_addresses_count: 5,
        recent_bot_trades: 23,
        sell_ratio: 0.82,
        exit_velocity: 2.1,
        is_exiting: false,
      },
      market_conditions: {
        sentiment: 'bullish' as any,
        confidence: 0.85,
        buy_ratio: 0.72,
        volume_ratio: 1.45,
        total_trades: 156,
      },
      technical_indicators: {
        rsi: 65.5,
        macd: 0.002,
        bb_position: 0.75,
        volume_trend: 'increasing',
        curve_position_momentum: 'upward',
      },
    },
    timestamp: '2024-01-15T10:30:45.123Z',
    model_version: 'v0.1.0',
  });

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockHyperliquidService = {
      getTicker: jest.fn(),
      getPositions: jest.fn().mockResolvedValue([]), // Mock empty positions array
      placePerpOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getMarkets: jest.fn(),
    } as any;

    mockPerpService = {
      findActivePositionBySymbol: jest.fn(),
      createPosition: jest.fn(),
      updatePosition: jest.fn(),
      closePosition: jest.fn(),
      findByToken: jest.fn(),
    } as any;

    mockPredictorAdapter = {
      predictToken: jest.fn(),
      getTrendsForToken: jest.fn(),
    } as any;

    mockEntryTimingService = {
      evaluateEntryTiming: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperliquidTradingStrategyService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HyperliquidService,
          useValue: mockHyperliquidService,
        },
        {
          provide: PerpService,
          useValue: mockPerpService,
        },
        {
          provide: PredictorAdapter,
          useValue: mockPredictorAdapter,
        },
        {
          provide: EntryTimingService,
          useValue: mockEntryTimingService,
        },
      ],
    }).compile();

    service = module.get<HyperliquidTradingStrategyService>(
      HyperliquidTradingStrategyService,
    );

    // Setup default config values
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        const mockValues = {
          'hyperliquid.trading.enabled': true,
          'hyperliquid.defaultAmountIn': 100,
          'hyperliquid.maxOpenPositions': 5,
          'hyperliquid.stopLossPercent': 0.05,
          'hyperliquid.takeProfitPercent': 0.1,
        };
        return mockValues[key] || defaultValue;
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('determineTokenCategory', () => {
    it('should return MAIN_COINS for main coins', () => {
      const mainCoins = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT'];

      mainCoins.forEach((coin) => {
        const category = (service as any).determineTokenCategory(coin);
        expect(category).toBe(TokenCategory.MAIN_COINS);
      });
    });

    it('should return ALT_COINS for other tokens', () => {
      const altCoins = ['DOGE', 'ADA', 'DOT', 'LINK'];

      altCoins.forEach((coin) => {
        const category = (service as any).determineTokenCategory(coin);
        expect(category).toBe(TokenCategory.ALT_COINS);
      });
    });
  });

  describe('shouldEnterPosition', () => {
    it('should return BUY decision for buy recommendation with good timing', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
        token: 'BTC',
        timestamp: new Date().toISOString(),
        trends: {} as any,
      });
      mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
        shouldEnterNow: true,
        direction: PositionDirection.LONG,
        timing: 'reversal_detected',
        confidence: 0.85,
        reason: 'Reversal detected',
        metadata: {
          primaryTrend: TrendStatus.UP,
          primaryTimeframe: '1h',
          correctionTrend: TrendStatus.UP,
          correctionTimeframe: '5m',
          reversalDetected: true,
          trendAlignment: true,
        },
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        if (key === 'hyperliquid.defaultLeverage') return 3;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8); // Combined confidence
      expect(result.metadata).toMatchObject({
        direction: PositionDirection.LONG,
        aiPrediction: expect.objectContaining({
          recommendation: Recommendation.BUY,
          predictedChange: 12.3,
          confidence: 0.85,
        }),
        entryTiming: expect.objectContaining({
          timing: 'reversal_detected',
          timingConfidence: 0.85,
        }),
      });

      expect(mockPredictorAdapter.predictToken).toHaveBeenCalledWith(
        'BTC',
        TokenCategory.MAIN_COINS,
        PredictionHorizon.ONE_HOUR,
        true,
      );
      expect(mockPredictorAdapter.getTrendsForToken).toHaveBeenCalledWith(
        'BTC',
      );
      expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalled();
    });

    it('should return HOLD when no perp found', async () => {
      mockConfigService.get.mockReturnValue(true); // Enable trading first
      mockPerpService.findByToken.mockResolvedValue(null);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(false);
      expect(result.reason).toContain('No perp definition found');
    });

    it('should return HOLD when trading is disabled', async () => {
      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockConfigService.get.mockReturnValue(false);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(false);
      expect(result.reason).toBe('Hyperliquid trading is disabled');
    });

    it('should reject low confidence predictions below threshold', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.3; // Low confidence (below default 0.6)

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      // Service now enforces confidence threshold
      expect(result.shouldTrade).toBe(false);
      expect(result.confidence).toBe(0.3);
      expect(result.reason).toContain('confidence');
      expect(result.reason).toContain('threshold');
    });

    it('should accept predictions above confidence threshold with good timing', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.75; // Above threshold

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
        token: 'BTC',
        timestamp: new Date().toISOString(),
        trends: {} as any,
      });
      mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
        shouldEnterNow: true,
        direction: PositionDirection.LONG,
        timing: 'immediate',
        confidence: 0.7,
        reason: 'Good timing',
        metadata: {
          primaryTrend: TrendStatus.UP,
          primaryTimeframe: '1h',
          correctionTrend: TrendStatus.UP,
          correctionTimeframe: '5m',
          reversalDetected: false,
          trendAlignment: true,
        },
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        if (key === 'hyperliquid.defaultLeverage') return 3;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(true);
      // Confidence capped by minimum (0.7), not weighted average (0.735)
      expect(result.confidence).toBe(0.7);
      expect(result.reason).toContain('AI');
    });

    it('should reject when AI confidence is barely above threshold despite good timing', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.61; // Just above 0.6 threshold

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
        token: 'BTC',
        timestamp: new Date().toISOString(),
        trends: {} as any,
      });
      mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
        shouldEnterNow: true,
        direction: PositionDirection.LONG,
        timing: 'reversal_detected',
        confidence: 0.85, // High timing confidence
        reason: 'Strong reversal',
        metadata: {
          primaryTrend: TrendStatus.UP,
          primaryTimeframe: '1h',
          correctionTrend: TrendStatus.UP,
          correctionTimeframe: '5m',
          reversalDetected: true,
          trendAlignment: true,
        },
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        if (key === 'hyperliquid.defaultLeverage') return 3;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      // Should reject because AI buffer (0.61 - 0.6 = 0.01) is < 0.05
      expect(result.shouldTrade).toBe(false);
      expect(result.reason).toContain('too close to threshold');
      expect(result.reason).toContain('0.05 buffer');
    });

    it('should reject early when AI and timing directions conflict (before waiting)', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.85; // High AI confidence

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
        token: 'BTC',
        timestamp: new Date().toISOString(),
        trends: {} as any,
      });
      // Timing says wait_correction BUT direction conflicts
      mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
        shouldEnterNow: false, // Would normally wait
        direction: PositionDirection.SHORT, // Conflicts with BUY (LONG)
        timing: 'wait_correction',
        confidence: 0.8,
        reason: 'Waiting for correction',
        metadata: {
          primaryTrend: TrendStatus.DOWN,
          primaryTimeframe: '1h',
          correctionTrend: TrendStatus.UP,
          correctionTimeframe: '5m',
          reversalDetected: false,
          trendAlignment: false,
        },
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        if (key === 'hyperliquid.defaultLeverage') return 3;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      // Should reject immediately due to direction mismatch, not wait
      expect(result.shouldTrade).toBe(false);
      expect(result.reason).toContain('Direction mismatch');
      expect(result.reason).toContain('LONG');
      expect(result.reason).toContain('SHORT');
    });

    it('should use minimum confidence when combining AI and timing', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.7; // Moderate AI confidence

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
        token: 'BTC',
        timestamp: new Date().toISOString(),
        trends: {} as any,
      });
      mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
        shouldEnterNow: true,
        direction: PositionDirection.LONG,
        timing: 'reversal_detected',
        confidence: 0.9, // Higher timing confidence
        reason: 'Strong reversal',
        metadata: {
          primaryTrend: TrendStatus.UP,
          primaryTimeframe: '1h',
          correctionTrend: TrendStatus.UP,
          correctionTimeframe: '5m',
          reversalDetected: true,
          trendAlignment: true,
        },
      });
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'hyperliquid.enabled') return true;
        if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
        if (key === 'hyperliquid.defaultLeverage') return 3;
        return undefined;
      });

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(true);
      // Combined should be capped by minimum (0.7), not weighted average (0.76)
      expect(result.confidence).toBeLessThanOrEqual(0.7);
      expect(result.confidence).toBeGreaterThan(0.65);
    });

    describe('ticker validation for extreme tracking', () => {
      const setupTest = () => {
        mockPerpService.findByToken.mockResolvedValue({
          token: 'BTC',
          currency: Currency.USDC,
        } as any);
        mockPredictorAdapter.predictToken.mockResolvedValue(
          createMockPrediction(Recommendation.BUY),
        );
        mockPredictorAdapter.getTrendsForToken.mockResolvedValue({
          token: 'BTC',
          timestamp: new Date().toISOString(),
          trends: {} as any,
        });
        mockEntryTimingService.evaluateEntryTiming.mockResolvedValue({
          shouldEnterNow: true,
          direction: PositionDirection.LONG,
          timing: 'reversal_detected',
          confidence: 0.85,
          reason: 'Reversal detected',
          metadata: {
            primaryTrend: TrendStatus.UP,
            primaryTimeframe: '1h',
            correctionTrend: TrendStatus.UP,
            correctionTimeframe: '5m',
            reversalDetected: true,
            trendAlignment: true,
          },
        });
        mockConfigService.get.mockImplementation((key: string) => {
          if (key === 'hyperliquid.enabled') return true;
          if (key === 'hyperliquid.predictorMinConfidence') return 0.6;
          if (key === 'hyperliquid.defaultLeverage') return 3;
          return undefined;
        });
      };

      it('should handle null ticker gracefully', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue(null as any);

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should still work, falling back to MA deviation
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          undefined, // No current price passed
        );
      });

      it('should handle ticker with undefined last price', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          mark: '50000',
          bid: '49999',
          ask: '50001',
          last: undefined as any, // Undefined last price
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should still work, falling back to MA deviation
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          undefined, // No current price passed
        );
      });

      it('should handle NaN from parseFloat', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          mark: '50000',
          bid: '49999',
          ask: '50001',
          last: 'invalid-number', // Will parse to NaN
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should still work, falling back to MA deviation
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          undefined, // No current price passed
        );
      });

      it('should handle negative price', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          mark: '50000',
          bid: '49999',
          ask: '50001',
          last: '-50000', // Negative price (invalid)
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should still work, falling back to MA deviation
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          undefined, // No current price passed
        );
      });

      it('should handle zero price', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          mark: '50000',
          bid: '49999',
          ask: '50001',
          last: '0', // Zero price (invalid)
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should still work, falling back to MA deviation
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          undefined, // No current price passed
        );
      });

      it('should pass valid price to entry timing', async () => {
        setupTest();
        mockHyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          mark: '50000',
          bid: '49999',
          ask: '50001',
          last: '50000', // Valid price
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const result = await service.shouldEnterPosition(
          'BTC',
          mockTradingParams,
        );

        // Should work with valid current price
        expect(result.shouldTrade).toBe(true);
        expect(mockEntryTimingService.evaluateEntryTiming).toHaveBeenCalledWith(
          'BTC',
          expect.anything(),
          50000, // Valid price passed
        );
      });
    });
  });

  describe('shouldExitPosition', () => {
    it('should return CLOSE decision for sell recommendation', async () => {
      const mockPrediction = createMockPrediction(Recommendation.SELL);

      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockHyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        mark: '50000',
        bid: '49999',
        ask: '50001',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
        last: '50000',
      });

      const result = await service.shouldExitPosition(
        mockPosition as TradePositionDocument,
        mockTradingParams,
      );

      expect(result).toEqual({
        shouldExit: true,
        reason: expect.any(String),
        confidence: 0.9,
        urgency: expect.any(String),
        metadata: expect.any(Object),
      });
    });

    it('should return HOLD decision for buy recommendation', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.8;

      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);

      const result = await service.shouldExitPosition(
        mockPosition as TradePositionDocument,
        mockTradingParams,
      );

      expect(result.shouldExit).toBe(false);
    });

    it('should return HOLD decision for hold recommendation', async () => {
      const mockPrediction = createMockPrediction(Recommendation.HOLD);

      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);

      const result = await service.shouldExitPosition(
        mockPosition as TradePositionDocument,
        mockTradingParams,
      );

      expect(result.shouldExit).toBe(false);
    });
  });

  describe('getTakeProfitPrice', () => {
    it('should calculate take profit price', () => {
      const result = service.getTakeProfitPrice(
        mockPosition as TradePositionDocument,
        mockTradingParams,
      );

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });
  });

  describe('getStopLossPrice', () => {
    it('should calculate stop loss price', () => {
      const result = service.getStopLossPrice(
        mockPosition as TradePositionDocument,
        mockTradingParams,
      );

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });
  });

  describe('getDefaultTradingParams', () => {
    it('should return default trading parameters', () => {
      const result = service.getDefaultTradingParams();

      expect(result).toEqual({
        maxOpenPositions: expect.any(Number),
        defaultAmountIn: expect.any(Number),
        defaultLeverage: expect.any(Number),
        stopLossPercent: expect.any(Number),
        takeProfitPercent: expect.any(Number),
      });
    });
  });
});
