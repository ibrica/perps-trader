/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule, Test } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { DashboardController } from './Dashboard.controller';
import { DashboardService } from './Dashboard.service';
import {
  createTestingModuleWithProviders,
  TradePositionStatus,
} from '../../shared';
import { TimePeriod } from './Dashboard.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UpdatePositionExitFlagDto,
  UpdateSettingsDto,
} from './dto';

describe('DashboardController', () => {
  let controller: DashboardController;
  let mockDashboardService: jest.Mocked<DashboardService>;
  let module: TestingModule;

  const mockAnalytics = {
    overview: {
      totalPnl: 1000,
      totalVolume: 5000,
      winRate: 60,
      openPositionsCount: 2,
      closedPositionsCount: 5,
      totalTrades: 7,
    },
    timeSeries: [
      { date: '2024-01-01', pnl: 100 },
      { date: '2024-01-02', pnl: 200 },
    ],
    tokenBreakdown: [
      {
        token: 'BTC',
        totalPnl: 500,
        totalVolume: 2000,
        winRate: 70,
        tradeCount: 3,
      },
    ],
  };

  const mockPosition = {
    id: '507f1f77bcf86cd799439011',
    platform: 'HYPERLIQUID',
    token: 'BTC',
    status: TradePositionStatus.OPEN,
    positionDirection: 'LONG',
    positionSize: 300,
    entryPrice: 50000,
    currentPrice: 51000,
    takeProfitPrice: 55000,
    stopLossPrice: 48000,
    realizedPnl: 0,
    leverage: 3,
    exitFlag: false,
    timeOpened: new Date('2024-01-01'),
    pnlPercent: 2,
  };

  const mockPaginatedPositions = {
    positions: [mockPosition],
    total: 1,
    limit: 50,
    offset: 0,
  };

  const mockPerp = {
    _id: '507f1f77bcf86cd799439013',
    name: 'BTC-PERP',
    token: 'BTC',
    currency: 'USDC',
    platform: 'HYPERLIQUID',
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
    mockDashboardService = {
      getAnalytics: jest.fn().mockResolvedValue(mockAnalytics),
      getPositions: jest.fn().mockResolvedValue(mockPaginatedPositions),
      updatePositionExitFlag: jest.fn().mockResolvedValue(mockPosition),
      getAllPerps: jest.fn().mockResolvedValue([mockPerp]),
      updatePerp: jest.fn().mockResolvedValue(mockPerp),
      getSettings: jest.fn().mockResolvedValue(mockSettings),
      updateSettings: jest.fn().mockResolvedValue(mockSettings),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        DashboardController,
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get(DashboardController);
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
    it('should return analytics data', async () => {
      const query = { period: TimePeriod.LAST_30_DAYS };
      const result = await controller.getAnalytics(query);

      expect(result).toEqual(mockAnalytics);
      expect(mockDashboardService.getAnalytics).toHaveBeenCalledWith(
        TimePeriod.LAST_30_DAYS,
        undefined,
        undefined,
        undefined,
      );
    });

    it('should pass all query parameters to service', async () => {
      const query = {
        period: TimePeriod.CUSTOM,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        token: 'BTC',
      };

      await controller.getAnalytics(query);

      expect(mockDashboardService.getAnalytics).toHaveBeenCalledWith(
        TimePeriod.CUSTOM,
        '2024-01-01',
        '2024-01-31',
        'BTC',
      );
    });
  });

  describe('getPositions', () => {
    it('should return paginated positions', async () => {
      const query = { status: TradePositionStatus.OPEN, limit: 50, offset: 0 };
      const result = await controller.getPositions(query);

      expect(result).toEqual(mockPaginatedPositions);
      expect(mockDashboardService.getPositions).toHaveBeenCalledWith(
        TradePositionStatus.OPEN,
        50,
        0,
      );
    });

    it('should use default limit and offset if not provided', async () => {
      const query = { status: TradePositionStatus.OPEN };
      await controller.getPositions(query as any);

      expect(mockDashboardService.getPositions).toHaveBeenCalledWith(
        TradePositionStatus.OPEN,
        undefined,
        undefined,
      );
    });
  });

  describe('updatePosition', () => {
    it('should update position exitFlag', async () => {
      const body = { exitFlag: true };
      const result = await controller.updatePosition(
        '507f1f77bcf86cd799439011',
        body,
      );

      expect(result).toEqual(mockPosition);
      expect(mockDashboardService.updatePositionExitFlag).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        true,
      );
    });

    it('should throw BadRequestException if exitFlag is not boolean', async () => {
      const body = { exitFlag: 'invalid' } as any;

      // Test DTO validation directly
      expect(() => {
        const dto = plainToInstance(UpdatePositionExitFlagDto, body);
      }).toThrow(BadRequestException);
    });

    it('should throw NotFoundException if position not found', async () => {
      mockDashboardService.updatePositionExitFlag.mockResolvedValue(null);
      const body = { exitFlag: true };

      await expect(
        controller.updatePosition('invalid-id', body),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPerps', () => {
    it('should return all perps', async () => {
      const result = await controller.getPerps();

      expect(result).toEqual([mockPerp]);
      expect(mockDashboardService.getAllPerps).toHaveBeenCalled();
    });
  });

  describe('updatePerp', () => {
    it('should update perp configuration', async () => {
      const body = { recommendedAmount: 200, defaultLeverage: 5 };
      const updatedPerp = { ...mockPerp, ...body };
      mockDashboardService.updatePerp.mockResolvedValue(updatedPerp as any);

      const result = await controller.updatePerp(
        '507f1f77bcf86cd799439013',
        body,
      );

      expect(result).toEqual(updatedPerp);
      expect(mockDashboardService.updatePerp).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
        body,
      );
    });

    it('should throw NotFoundException if perp not found', async () => {
      mockDashboardService.updatePerp.mockResolvedValue(null);
      const body = { recommendedAmount: 200 };

      await expect(controller.updatePerp('invalid-id', body)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSettings', () => {
    it('should return settings', async () => {
      const result = await controller.getSettings();

      expect(result).toEqual(mockSettings);
      expect(mockDashboardService.getSettings).toHaveBeenCalled();
    });

    it('should throw NotFoundException if settings not found', async () => {
      mockDashboardService.getSettings.mockResolvedValue(null);

      await expect(controller.getSettings()).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      const body = { closeAllPositions: true };
      const updatedSettings = { ...mockSettings, closeAllPositions: true };
      mockDashboardService.updateSettings.mockResolvedValue(
        updatedSettings as any,
      );

      const result = await controller.updateSettings(body);

      expect(result.closeAllPositions).toBe(true);
      expect(mockDashboardService.updateSettings).toHaveBeenCalledWith(true);
    });

    it('should throw BadRequestException if closeAllPositions is not boolean', async () => {
      const body = { closeAllPositions: 'invalid' } as any;

      // Test DTO validation directly
      expect(() => {
        const dto = plainToInstance(UpdateSettingsDto, body);
      }).toThrow(BadRequestException);
    });

    it('should throw NotFoundException if update fails', async () => {
      mockDashboardService.updateSettings.mockResolvedValue(null);
      const body = { closeAllPositions: true };

      await expect(controller.updateSettings(body)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
