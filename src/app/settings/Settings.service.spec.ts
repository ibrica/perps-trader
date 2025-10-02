/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { SettingsService } from './Settings.service';
import { createTestingModuleWithProviders } from '../../shared';
import { SettingsRepository } from './Settings.repository';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockSettingsRepository: jest.Mocked<SettingsRepository>;
  let module: TestingModule;

  // Mock data
  const mockSettingsData = {
    closeAllPositions: false,
  };

  beforeEach(async () => {
    // Create mock objects
    mockSettingsRepository = {
      getSettings: jest.fn().mockResolvedValue(mockSettingsData),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        SettingsService,
        {
          provide: SettingsRepository,
          useValue: mockSettingsRepository,
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

    it('should return settings with closeAllPositions true', async () => {
      const mockSettingsWithCloseAll = {
        closeAllPositions: true,
      } as any;
      mockSettingsRepository.getSettings.mockResolvedValueOnce(
        mockSettingsWithCloseAll,
      );

      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(result.closeAllPositions).toBe(true);
      expect(mockSettingsRepository.getSettings).toHaveBeenCalled();
    });
  });
});
