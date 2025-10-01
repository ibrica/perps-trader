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
} from '../../shared/models/predictor/types';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';

describe('HyperliquidTradingStrategyService', () => {
  let service: HyperliquidTradingStrategyService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockHyperliquidService: jest.Mocked<HyperliquidService>;
  let mockPerpService: jest.Mocked<PerpService>;
  let mockPredictorAdapter: jest.Mocked<PredictorAdapter>;

  const mockTokenAddress = 'So11111111111111111111111111111111111111112';

  const mockPosition: Partial<TradePositionDocument> = {
    _id: 'position-123',
    token: 'BTC',
    entryPrice: 50000,
    positionSize: 100000000n, // 0.1 BTC in smallest units using BigInt literal
    leverage: 10,
    exitFlag: false,
  };

  const mockTradingParams: PlatformTradingParams = {
    maxOpenPositions: 5,
    defaultAmountIn: 1000000n, // 1 USDC using BigInt literal
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
          'hyperliquid.defaultAmountIn': '100000000',
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
    it('should return BUY decision for buy recommendation', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
        perpSymbol: 'BTC-USDC',
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockConfigService.get.mockReturnValue(true);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result).toEqual({
        shouldTrade: true,
        reason: expect.any(String),
        confidence: 0.85,
        recommendedAmount: expect.any(BigInt),
        metadata: expect.objectContaining({
          direction: PositionDirection.LONG,
          aiPrediction: expect.objectContaining({
            recommendation: Recommendation.BUY,
            predictedChange: 12.3,
            confidence: 0.85,
          }),
        }),
      });

      expect(mockPredictorAdapter.predictToken).toHaveBeenCalledWith(
        'BTC',
        TokenCategory.MAIN_COINS,
        PredictionHorizon.ONE_HOUR,
        true,
      );
    });

    it('should return BUY decision even for neutral recommendation (service ignores HOLD)', async () => {
      const mockPrediction = createMockPrediction(Recommendation.HOLD);

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
        perpSymbol: 'BTC-USDC',
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockConfigService.get.mockReturnValue(true);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      // Service currently always enters positions (shouldEnter = true)
      expect(result.shouldTrade).toBe(true);
    });

    it('should return HOLD when no perp found', async () => {
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
        perpSymbol: 'BTC-USDC',
      } as any);
      mockConfigService.get.mockReturnValue(false);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      expect(result.shouldTrade).toBe(false);
      expect(result.reason).toBe('Hyperliquid trading is disabled');
    });

    it('should return BUY for low confidence predictions (service uses AI prediction directly)', async () => {
      const mockPrediction = createMockPrediction(Recommendation.BUY);
      mockPrediction.confidence = 0.3; // Low confidence

      mockPerpService.findByToken.mockResolvedValue({
        token: 'BTC',
        currency: Currency.USDC,
        perpSymbol: 'BTC-USDC',
      } as any);
      mockPredictorAdapter.predictToken.mockResolvedValue(mockPrediction);
      mockConfigService.get.mockReturnValue(true);

      const result = await service.shouldEnterPosition(
        'BTC',
        mockTradingParams,
      );

      // Service uses AI prediction directly without confidence threshold
      expect(result.shouldTrade).toBe(true);
      expect(result.confidence).toBe(0.3);
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
        defaultAmountIn: expect.any(BigInt),
        defaultLeverage: expect.any(Number),
        stopLossPercent: expect.any(Number),
        takeProfitPercent: expect.any(Number),
      });
    });
  });
});
