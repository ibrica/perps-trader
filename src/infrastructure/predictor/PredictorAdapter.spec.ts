import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { PredictorAdapter } from './PredictorAdapter';
import {
  PredictionResponse,
  Recommendation,
  MarketSentiment,
  PredictionHorizon,
  CoinCategory,
  TrendsResponse,
  TrendStatus,
} from '../../shared';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PredictorAdapter', () => {
  let adapter: PredictorAdapter;
  const testUrl = 'http://localhost';
  const testPort = 3000;
  const testTokenMint = 'AWcvL1GSNX8VDLm1nFWzB9u2o4guAmXM341imLaHpump';

  const mockPredictionResponse: PredictionResponse = {
    token_address: 'AWcvL1GSNX8VDLm1nFWzB9u2o4guAmXM341imLaHpump',
    category: CoinCategory.MEME_TOKENS,
    recommendation: Recommendation.BUY,
    confidence: 0.78,
    predicted_curve_position_change: '+12.3% curve position (over 5m)',
    percentage_change: 12.3,
    reasoning: {
      key_factors: [
        'Bot addresses are exiting positions',
        'RSI indicates oversold conditions',
        'Increasing volume trend',
      ],
      risk_factors: ['High volatility detected'],
      bot_activity: {
        bot_addresses_count: 5,
        recent_bot_trades: 23,
        sell_ratio: 0.82,
        exit_velocity: 2.1,
        is_exiting: true,
      },
      market_conditions: {
        sentiment: MarketSentiment.BULLISH,
        confidence: 0.65,
        buy_ratio: 0.72,
        volume_ratio: 1.45,
        total_trades: 156,
      },
      technical_indicators: {
        rsi: 45.5,
        macd: 0.002,
        bb_position: 0.25,
        volume_trend: 'increasing',
        curve_position_momentum: 'upward',
      },
    },
    timestamp: '2024-01-15T10:30:45.123Z',
    model_version: 'v0.1.0',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PredictorAdapter,
          useFactory: () => new PredictorAdapter(testUrl, testPort),
        },
      ],
    }).compile();

    adapter = module.get<PredictorAdapter>(PredictorAdapter);
  });

  describe('predictToken', () => {
    it('should successfully predict token and return PredictionResponse', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValue({
        data: mockPredictionResponse,
      });

      // Act
      const result = await adapter.predictToken(testTokenMint);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/predict`,
        {
          token_address: testTokenMint,
          category: CoinCategory.MEME_TOKENS,
          prediction_horizon: PredictionHorizon.THIRTY_MIN,
          include_reasoning: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result).toEqual(mockPredictionResponse);
      expect(result?.recommendation).toBe('BUY');
      expect(result?.confidence).toBe(0.78);
      expect(result?.token_address).toBe(testTokenMint);
    });

    it('should successfully predict token with custom parameters', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValue({
        data: mockPredictionResponse,
      });

      // Act
      const result = await adapter.predictToken(
        testTokenMint,
        CoinCategory.MEME_TOKENS,
        '2h',
        false,
      );

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/predict`,
        {
          token_address: testTokenMint,
          category: CoinCategory.MEME_TOKENS,
          prediction_horizon: '2h',
          include_reasoning: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result).toEqual(mockPredictionResponse);
    });

    it('should return PredictionResponse with SELL recommendation', async () => {
      // Arrange
      const sellResponse: PredictionResponse = {
        ...mockPredictionResponse,
        recommendation: Recommendation.SELL,
        confidence: 0.65,
        predicted_curve_position_change: '-8.5% curve position (over 5m)',
        percentage_change: -8.5,
        reasoning: {
          ...mockPredictionResponse.reasoning!,
          key_factors: [
            'High bot activity detected',
            'RSI indicates overbought conditions',
            'Decreasing volume trend',
          ],
          risk_factors: ['Market downturn', 'High selling pressure'],
          market_conditions: {
            ...mockPredictionResponse.reasoning!.market_conditions,
            sentiment: MarketSentiment.BEARISH,
          },
        },
      };

      mockedAxios.post.mockResolvedValue({
        data: sellResponse,
      });

      // Act
      const result = await adapter.predictToken(testTokenMint);

      // Assert
      expect(result?.recommendation).toBe('SELL');
      expect(result?.predicted_curve_position_change).toBe(
        '-8.5% curve position (over 5m)',
      );
      expect(result?.reasoning?.market_conditions.sentiment).toBe('BEARISH');
    });

    it('should validate response structure matches PredictionResponse interface', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValue({
        data: mockPredictionResponse,
      });

      // Act
      const result = await adapter.predictToken(testTokenMint);

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty('token_address');
      expect(result).toHaveProperty('recommendation');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('predicted_curve_position_change');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('model_version');

      // Validate reasoning structure
      expect(result?.reasoning).toHaveProperty('key_factors');
      expect(result?.reasoning).toHaveProperty('risk_factors');
      expect(result?.reasoning).toHaveProperty('bot_activity');
      expect(result?.reasoning).toHaveProperty('market_conditions');

      // Validate bot_activity structure
      expect(result?.reasoning?.bot_activity).toHaveProperty(
        'bot_addresses_count',
      );
      expect(result?.reasoning?.bot_activity).toHaveProperty(
        'recent_bot_trades',
      );
      expect(result?.reasoning?.bot_activity).toHaveProperty('sell_ratio');
      expect(result?.reasoning?.bot_activity).toHaveProperty('exit_velocity');
      expect(result?.reasoning?.bot_activity).toHaveProperty('is_exiting');

      // Validate market_conditions structure
      expect(result?.reasoning?.market_conditions).toHaveProperty('sentiment');
      expect(result?.reasoning?.market_conditions).toHaveProperty('confidence');
      expect(result?.reasoning?.market_conditions).toHaveProperty('buy_ratio');
      expect(result?.reasoning?.market_conditions).toHaveProperty(
        'volume_ratio',
      );
      expect(result?.reasoning?.market_conditions).toHaveProperty(
        'total_trades',
      );
    });

    it('should return undefined when axios request fails', async () => {
      // Arrange
      const errorMessage = 'Network Error';
      mockedAxios.post.mockRejectedValue(new Error(errorMessage));

      // Act
      const result = await adapter.predictToken(testTokenMint);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/predict`,
        {
          token_address: testTokenMint,
          category: CoinCategory.MEME_TOKENS,
          prediction_horizon: PredictionHorizon.THIRTY_MIN,
          include_reasoning: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result).toBeUndefined();
    });

    it('should handle different token mints correctly', async () => {
      // Arrange
      const differentTokenMint = 'DifferentTokenMintAddress123';
      const responseForDifferentToken: PredictionResponse = {
        ...mockPredictionResponse,
        token_address: differentTokenMint,
      };

      mockedAxios.post.mockResolvedValue({
        data: responseForDifferentToken,
      });

      // Act
      const result = await adapter.predictToken(differentTokenMint);

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/predict`,
        {
          token_address: differentTokenMint,
          category: CoinCategory.MEME_TOKENS,
          prediction_horizon: PredictionHorizon.THIRTY_MIN,
          include_reasoning: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result?.token_address).toBe(differentTokenMint);
    });

    it('should validate array properties in reasoning', async () => {
      // Arrange
      mockedAxios.post.mockResolvedValue({
        data: mockPredictionResponse,
      });

      // Act
      const result = await adapter.predictToken(testTokenMint);

      // Assert
      expect(Array.isArray(result?.reasoning?.key_factors)).toBe(true);
      expect(Array.isArray(result?.reasoning?.risk_factors)).toBe(true);
      expect(result?.reasoning?.key_factors.length).toBeGreaterThan(0);
      expect(result?.reasoning?.risk_factors.length).toBeGreaterThan(0);
    });
  });

  describe('getTrendsForToken', () => {
    const mockTrendsResponse: TrendsResponse = {
      token: 'BTC',
      timestamp: '2024-01-15T10:30:45.123Z',
      trends: {
        '5m': {
          trend: TrendStatus.UP,
          change_pct: 2.5,
          price: 45000,
          ma: 43875,
        },
        '15m': {
          trend: TrendStatus.UP,
          change_pct: 3.2,
          price: 45000,
          ma: 43600,
        },
        '1h': {
          trend: TrendStatus.NEUTRAL,
          change_pct: 0.5,
          price: 45000,
          ma: 44775,
        },
        '8h': {
          trend: TrendStatus.DOWN,
          change_pct: -1.8,
          price: 45000,
          ma: 45810,
        },
        '1d': {
          trend: TrendStatus.UNDEFINED,
          change_pct: null,
          price: null,
          ma: null,
        },
      },
    };

    it('should successfully fetch trends for token', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({
        data: mockTrendsResponse,
      });

      // Act
      const result = await adapter.getTrendsForToken('BTC');

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/trends`,
        {
          params: { token: 'BTC' },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result).toEqual(mockTrendsResponse);
      expect(result?.token).toBe('BTC');
      expect(result?.trends['5m'].trend).toBe(TrendStatus.UP);
      expect(result?.trends['5m'].change_pct).toBe(2.5);
    });

    it('should validate trends response structure', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({
        data: mockTrendsResponse,
      });

      // Act
      const result = await adapter.getTrendsForToken('BTC');

      // Assert
      expect(result).toBeDefined();
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('trends');

      // Validate all timeframes exist
      expect(result?.trends).toHaveProperty('5m');
      expect(result?.trends).toHaveProperty('15m');
      expect(result?.trends).toHaveProperty('1h');
      expect(result?.trends).toHaveProperty('8h');
      expect(result?.trends).toHaveProperty('1d');

      // Validate trend structure
      const trend5m = result?.trends['5m'];
      expect(trend5m).toHaveProperty('trend');
      expect(trend5m).toHaveProperty('change_pct');
      expect(trend5m).toHaveProperty('price');
      expect(trend5m).toHaveProperty('ma');
    });

    it('should handle different trend statuses correctly', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({
        data: mockTrendsResponse,
      });

      // Act
      const result = await adapter.getTrendsForToken('ETH');

      // Assert
      expect(result?.trends['5m'].trend).toBe(TrendStatus.UP);
      expect(result?.trends['15m'].trend).toBe(TrendStatus.UP);
      expect(result?.trends['1h'].trend).toBe(TrendStatus.NEUTRAL);
      expect(result?.trends['8h'].trend).toBe(TrendStatus.DOWN);
      expect(result?.trends['1d'].trend).toBe(TrendStatus.UNDEFINED);
    });

    it('should handle UNDEFINED trends with null values', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({
        data: mockTrendsResponse,
      });

      // Act
      const result = await adapter.getTrendsForToken('SOL');

      // Assert
      const undefinedTrend = result?.trends['1d'];
      expect(undefinedTrend?.trend).toBe(TrendStatus.UNDEFINED);
      expect(undefinedTrend?.change_pct).toBeNull();
      expect(undefinedTrend?.price).toBeNull();
      expect(undefinedTrend?.ma).toBeNull();
    });

    it('should return undefined when request fails', async () => {
      // Arrange
      const errorMessage = 'Network Error';
      mockedAxios.get.mockRejectedValue(new Error(errorMessage));

      // Act
      const result = await adapter.getTrendsForToken('BTC');

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/trends`,
        {
          params: { token: 'BTC' },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result).toBeUndefined();
    });

    it('should handle different token symbols correctly', async () => {
      // Arrange
      const ethResponse: TrendsResponse = {
        ...mockTrendsResponse,
        token: 'ETH',
      };

      mockedAxios.get.mockResolvedValue({
        data: ethResponse,
      });

      // Act
      const result = await adapter.getTrendsForToken('ETH');

      // Assert
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${testUrl}:${testPort}/trends`,
        {
          params: { token: 'ETH' },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );
      expect(result?.token).toBe('ETH');
    });
  });
});
