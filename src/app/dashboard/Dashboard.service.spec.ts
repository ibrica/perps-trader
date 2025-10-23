/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { DashboardService } from './Dashboard.service';
import {
  createTestingModuleWithProviders,
  TradePositionStatus,
} from '../../shared';
import { TradePositionRepository } from '../trade-position/TradePosition.repository';
import { PerpRepository } from '../perps/Perp.repository';
import { SettingsRepository } from '../settings/Settings.repository';
import { TimePeriod } from './Dashboard.dto';
import { Platform, PositionDirection, Currency } from '../../shared';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockTradePositionRepository: jest.Mocked<TradePositionRepository>;
  let mockPerpRepository: jest.Mocked<PerpRepository>;
  let mockSettingsRepository: jest.Mocked<SettingsRepository>;
  let module: TestingModule;

  const mockPosition = {
    _id: '507f1f77bcf86cd799439011',
    platform: Platform.HYPERLIQUID,
    status: TradePositionStatus.OPEN,
    token: 'BTC',
    currency: Currency.USDC,
    amountIn: 100,
    positionDirection: PositionDirection.LONG,
    leverage: 3,
    positionSize: 300,
    entryPrice: 50000,
    currentPrice: 51000,
    takeProfitPrice: 55000,
    stopLossPrice: 48000,
    realizedPnl: 0,
    totalRealizedPnl: 0,
    exitFlag: false,
    timeOpened: new Date('2024-01-01'),
    timeClosed: null,
  };

  const mockClosedPosition = {
    ...mockPosition,
    _id: '507f1f77bcf86cd799439012',
    status: TradePositionStatus.CLOSED,
    realizedPnl: 100,
    totalRealizedPnl: 100,
    timeClosed: new Date('2024-01-02'),
  };

  const mockPerp = {
    _id: '507f1f77bcf86cd799439013',
    name: 'BTC-PERP',
    token: 'BTC',
    currency: Currency.USDC,
    platform: Platform.HYPERLIQUID,
    buyFlag: true,
    marketDirection: 'UP',
    isActive: true,
    defaultLeverage: 3,
    recommendedAmount: 100,
  };

  const mockSettings = {
    _id: '507f1f77bcf86cd799439014',
    closeAllPositions: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockTradePositionRepository = {
      getAll: jest.fn().mockResolvedValue([mockPosition, mockClosedPosition]),
      count: jest.fn().mockResolvedValue(2),
      updateById: jest.fn(),
    } as any;

    mockPerpRepository = {
      getAll: jest.fn().mockResolvedValue([mockPerp]),
      updateById: jest.fn(),
    } as any;

    mockSettingsRepository = {
      getAll: jest.fn().mockResolvedValue([mockSettings]),
      updateById: jest.fn(),
      create: jest.fn(),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        DashboardService,
        {
          provide: TradePositionRepository,
          useValue: mockTradePositionRepository,
        },
        {
          provide: PerpRepository,
          useValue: mockPerpRepository,
        },
        {
          provide: SettingsRepository,
          useValue: mockSettingsRepository,
        },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('getAnalytics', () => {
    it('should return analytics with overview, timeSeries, and tokenBreakdown', async () => {
      const result = await service.getAnalytics(TimePeriod.LAST_30_DAYS);

      expect(result).toBeDefined();
      expect(result.overview).toBeDefined();
      expect(result.timeSeries).toBeDefined();
      expect(result.tokenBreakdown).toBeDefined();
      expect(mockTradePositionRepository.getAll).toHaveBeenCalled();
    });

    it('should calculate correct overview metrics', async () => {
      const result = await service.getAnalytics(TimePeriod.LAST_30_DAYS);

      expect(result.overview.totalPnl).toBe(100); // Only closed position has realized PnL
      expect(result.overview.totalVolume).toBe(200); // 100 + 100
      expect(result.overview.openPositionsCount).toBe(1);
      expect(result.overview.closedPositionsCount).toBe(1);
      expect(result.overview.totalTrades).toBe(2);
      expect(result.overview.winRate).toBe(50); // 1 winning trade out of 2
    });

    it('should filter by token when provided', async () => {
      await service.getAnalytics(
        TimePeriod.LAST_30_DAYS,
        undefined,
        undefined,
        'BTC',
      );

      expect(mockTradePositionRepository.getAll).toHaveBeenCalledWith({
        filter: expect.objectContaining({
          token: 'BTC',
        }),
      });
    });

    it('should use custom date range when period is CUSTOM', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await service.getAnalytics(TimePeriod.CUSTOM, startDate, endDate);

      expect(mockTradePositionRepository.getAll).toHaveBeenCalledWith({
        filter: expect.objectContaining({
          timeOpened: expect.any(Object),
        }),
      });
    });
  });

  describe('getPositions', () => {
    it('should return paginated positions', async () => {
      const result = await service.getPositions(
        TradePositionStatus.OPEN,
        50,
        0,
      );

      expect(result).toBeDefined();
      expect(result.positions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(mockTradePositionRepository.getAll).toHaveBeenCalled();
      expect(mockTradePositionRepository.count).toHaveBeenCalled();
    });

    it('should filter positions by status', async () => {
      await service.getPositions(TradePositionStatus.OPEN, 50, 0);

      expect(mockTradePositionRepository.getAll).toHaveBeenCalledWith({
        filter: { status: TradePositionStatus.OPEN },
        queryOptions: expect.any(Object),
      });
    });

    it('should calculate PnL percentage correctly', async () => {
      const result = await service.getPositions(undefined, 50, 0);
      const position = result.positions[0];

      expect(position.pnlPercent).toBeDefined();
      // LONG position: (51000 - 50000) / 50000 * 100 = 2%
      expect(position.pnlPercent).toBe(2);
    });
  });

  describe('updatePositionExitFlag', () => {
    it('should update position exitFlag to true', async () => {
      const updatedPosition = { ...mockPosition, exitFlag: true };
      mockTradePositionRepository.updateById.mockResolvedValue(
        updatedPosition as any,
      );

      const result = await service.updatePositionExitFlag(
        '507f1f77bcf86cd799439011',
        true,
      );

      expect(result).toBeDefined();
      expect(result?.exitFlag).toBe(true);
      expect(mockTradePositionRepository.updateById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { exitFlag: true },
      );
    });

    it('should return null if position not found', async () => {
      mockTradePositionRepository.updateById.mockResolvedValue(null);

      const result = await service.updatePositionExitFlag('invalid-id', true);

      expect(result).toBeNull();
    });
  });

  describe('getAllPerps', () => {
    it('should return all perps', async () => {
      const result = await service.getAllPerps();

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('BTC-PERP');
      expect(mockPerpRepository.getAll).toHaveBeenCalled();
    });
  });

  describe('updatePerp', () => {
    it('should update perp configuration', async () => {
      const updates = { recommendedAmount: 200, defaultLeverage: 5 };
      const updatedPerp = { ...mockPerp, ...updates };
      mockPerpRepository.updateById.mockResolvedValue(updatedPerp as any);

      const result = await service.updatePerp(
        '507f1f77bcf86cd799439013',
        updates,
      );

      expect(result).toBeDefined();
      expect(result?.recommendedAmount).toBe(200);
      expect(result?.defaultLeverage).toBe(5);
      expect(mockPerpRepository.updateById).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
        updates,
      );
    });
  });

  describe('getSettings', () => {
    it('should return settings', async () => {
      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(result?.closeAllPositions).toBe(false);
      expect(mockSettingsRepository.getAll).toHaveBeenCalled();
    });

    it('should return null if no settings exist', async () => {
      mockSettingsRepository.getAll.mockResolvedValue([]);

      const result = await service.getSettings();

      expect(result).toBeNull();
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const updatedSettings = { ...mockSettings, closeAllPositions: true };
      mockSettingsRepository.updateById.mockResolvedValue(
        updatedSettings as any,
      );

      const result = await service.updateSettings(true);

      expect(result).toBeDefined();
      expect(result?.closeAllPositions).toBe(true);
      expect(mockSettingsRepository.updateById).toHaveBeenCalledWith(
        mockSettings._id.toString(),
        { closeAllPositions: true },
      );
    });

    it('should create new settings if none exist', async () => {
      mockSettingsRepository.getAll.mockResolvedValue([]);
      const newSettings = { ...mockSettings, closeAllPositions: true };
      mockSettingsRepository.create.mockResolvedValue(newSettings as any);

      const result = await service.updateSettings(true);

      expect(result).toBeDefined();
      expect(mockSettingsRepository.create).toHaveBeenCalledWith({
        closeAllPositions: true,
      });
    });
  });
});
