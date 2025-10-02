/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { SettingsService } from './Settings.service';
import { createTestingModuleWithProviders } from '../../shared';
import { CacheService } from '../cache/Cache.service';
import { SettingsRepository } from './Settings.repository';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockSettingsRepository: jest.Mocked<SettingsRepository>;
  let module: TestingModule;

  // Mock data
  const mockSettingsData = {
    closeAllPositions: false,
    entryParams: {
      minConfidence: 0.65,
      minPriceIncrease: 8.0,
      maxBotSellRatio: 0.7,
      minBuyRatio: 0.6,
      minTotalTrades: 50,
      bearishSentimentThreshold: 0.6,
    },
    exitParams: {
      sellRecommendationConfidence: 0.7,
      majorPriceDropThreshold: -10.0,
      maxBotSellRatioForExit: 0.8,
      minExitVelocity: 1.5,
      bearishSentimentConfidence: 0.7,
      minBuyRatioForHold: 0.4,
      riskFactorConfidence: 0.6,
      minVolumeRatio: 0.3,
      minTradesForVolume: 20,
      negativeSignalsThreshold: 4,
      highRiskKeywords: [
        'dump',
        'rug',
        'exit',
        'scam',
        'manipulation',
        'whale selling',
      ],
    },
  };

  beforeEach(async () => {
    // Create mock objects
    mockSettingsRepository = {
      getSettings: jest.fn().mockResolvedValue(mockSettingsData),
    } as any;

    mockCacheService = {
      getOrSet: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        SettingsService,
        {
          provide: SettingsRepository,
          useValue: mockSettingsRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('getSettings', () => {
    it('should return settings from repository', async () => {
      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(result.closeAllPositions).toBe(false);
      expect(mockSettingsRepository.getSettings).toHaveBeenCalled();
    });
  });

  describe('getEntryParams', () => {
    it('should use cache service to get entry parameters', async () => {
      const mockEntryParams = mockSettingsData.entryParams;
      mockCacheService.getOrSet.mockResolvedValue(mockEntryParams);

      const result = await service.getEntryParams();

      expect(result).toEqual(mockEntryParams);
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'settings:entryParams',
        expect.any(Function),
        120000, // 2 minutes in milliseconds
      );
    });

    it('should call database when cache is empty', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, callback) => {
        return await callback();
      });

      const result = await service.getEntryParams();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'settings:entryParams',
        expect.any(Function),
        120000,
      );
      expect(mockSettingsRepository.getSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettingsData.entryParams);
    });
  });

  describe('getExitParams', () => {
    it('should use cache service to get exit parameters', async () => {
      const mockExitParams = mockSettingsData.exitParams;
      mockCacheService.getOrSet.mockResolvedValue(mockExitParams);

      const result = await service.getExitParams();

      expect(result).toEqual(mockExitParams);
      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'settings:exitParams',
        expect.any(Function),
        120000, // 2 minutes in milliseconds
      );
    });

    it('should call database when cache is empty', async () => {
      mockCacheService.getOrSet.mockImplementation(async (_key, callback) => {
        return await callback();
      });

      const result = await service.getExitParams();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        'settings:exitParams',
        expect.any(Function),
        120000,
      );
      expect(mockSettingsRepository.getSettings).toHaveBeenCalled();
      expect(result).toEqual(mockSettingsData.exitParams);
    });
  });

  describe('cache TTL validation', () => {
    it('should use 2-minute TTL for entry params cache', async () => {
      mockCacheService.getOrSet.mockResolvedValue({});

      await service.getEntryParams();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        120000, // 2 minutes = 2 * 60 * 1000 ms
      );
    });

    it('should use 2-minute TTL for exit params cache', async () => {
      mockCacheService.getOrSet.mockResolvedValue({});

      await service.getExitParams();

      expect(mockCacheService.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        120000, // 2 minutes = 2 * 60 * 1000 ms
      );
    });
  });
});
