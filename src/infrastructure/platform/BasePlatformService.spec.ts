import { Test, TestingModule } from '@nestjs/testing';
import { BasePlatformService } from './BasePlatformService';
import { PredictorAdapter } from '../predictor/PredictorAdapter';
import {
  TrendTimeframe,
  TrendStatus,
  TrendsResponse,
} from '../../shared/models/predictor/types';
import { TradeOrderResult } from '../../shared/models/trade-order/TradeOrderResult';
import { PositionDirection } from '../../shared/constants/PositionDirection';

// Create a concrete implementation for testing
class TestPlatformService extends BasePlatformService {
  async enterPosition(): Promise<TradeOrderResult> {
    throw new Error('Not implemented');
  }

  async exitPosition(): Promise<TradeOrderResult> {
    throw new Error('Not implemented');
  }

  async createStopLossAndTakeProfitOrders(): Promise<void> {
    throw new Error('Not implemented');
  }

  // Expose protected method for testing
  public async testDetermineDirection(
    token: string,
  ): Promise<PositionDirection | undefined> {
    return this.determineDirection(token);
  }
}

describe('BasePlatformService', () => {
  let service: TestPlatformService;
  let predictorAdapter: jest.Mocked<PredictorAdapter>;

  const mockTrendsResponse = (
    oneHourTrend: TrendStatus,
    fifteenMinTrend: TrendStatus,
  ): TrendsResponse => ({
    token: 'BTC',
    timestamp: '2024-01-15T10:30:45.123Z',
    trends: {
      [TrendTimeframe.FIVE_MIN]: {
        trend: TrendStatus.UP,
        change_pct: 2.5,
        price: 45000,
        ma: 43875,
      },
      [TrendTimeframe.FIFTEEN_MIN]: {
        trend: fifteenMinTrend,
        change_pct: 3.2,
        price: 45000,
        ma: 43600,
      },
      [TrendTimeframe.ONE_HOUR]: {
        trend: oneHourTrend,
        change_pct: 0.5,
        price: 45000,
        ma: 44775,
      },
      [TrendTimeframe.EIGHT_HOUR]: {
        trend: TrendStatus.DOWN,
        change_pct: -1.8,
        price: 45000,
        ma: 45810,
      },
      [TrendTimeframe.ONE_DAY]: {
        trend: TrendStatus.UNDEFINED,
        change_pct: null,
        price: null,
        ma: null,
      },
    },
  });

  beforeEach(async () => {
    const mockPredictorAdapter = {
      getTrendsForToken: jest.fn(),
      predictToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TestPlatformService,
          useFactory: () =>
            new TestPlatformService(mockPredictorAdapter as any),
        },
        {
          provide: PredictorAdapter,
          useValue: mockPredictorAdapter,
        },
      ],
    }).compile();

    service = module.get<TestPlatformService>(TestPlatformService);
    predictorAdapter = module.get(
      PredictorAdapter,
    ) as jest.Mocked<PredictorAdapter>;
  });

  describe('determineDirection', () => {
    it('should return LONG when both 1h and 15m trends are UP', async () => {
      // Arrange
      const token = 'BTC';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UP, TrendStatus.UP),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBe(PositionDirection.LONG);
    });

    it('should return SHORT when both 1h and 15m trends are DOWN', async () => {
      // Arrange
      const token = 'ETH';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.DOWN, TrendStatus.DOWN),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBe(PositionDirection.SHORT);
    });

    it('should return undefined when 1h is UP but 15m is DOWN (trends do not match)', async () => {
      // Arrange
      const token = 'SOL';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UP, TrendStatus.DOWN),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when 1h is DOWN but 15m is UP (trends do not match)', async () => {
      // Arrange
      const token = 'MATIC';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.DOWN, TrendStatus.UP),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when 1h trend is UNDEFINED', async () => {
      // Arrange
      const token = 'AVAX';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UNDEFINED, TrendStatus.UP),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when 15m trend is UNDEFINED', async () => {
      // Arrange
      const token = 'DOT';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UP, TrendStatus.UNDEFINED),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when both trends are UNDEFINED', async () => {
      // Arrange
      const token = 'ADA';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UNDEFINED, TrendStatus.UNDEFINED),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when both trends are NEUTRAL', async () => {
      // Arrange
      const token = 'LINK';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.NEUTRAL, TrendStatus.NEUTRAL),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should return undefined when 1h is UP but 15m is NEUTRAL', async () => {
      // Arrange
      const token = 'UNI';
      predictorAdapter.getTrendsForToken.mockResolvedValue(
        mockTrendsResponse(TrendStatus.UP, TrendStatus.NEUTRAL),
      );

      // Act
      const result = await service.testDetermineDirection(token);

      // Assert
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
      expect(result).toBeUndefined();
    });

    it('should throw error when predictor adapter returns no response', async () => {
      // Arrange
      const token = 'BTC';
      predictorAdapter.getTrendsForToken.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.testDetermineDirection(token)).rejects.toThrow(
        'No trends response from predictor adapter',
      );
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
    });

    it('should throw error when predictor adapter returns null', async () => {
      // Arrange
      const token = 'ETH';
      predictorAdapter.getTrendsForToken.mockResolvedValue(null as any);

      // Act & Assert
      await expect(service.testDetermineDirection(token)).rejects.toThrow(
        'No trends response from predictor adapter',
      );
      expect(predictorAdapter.getTrendsForToken).toHaveBeenCalledWith(token);
    });
  });
});
