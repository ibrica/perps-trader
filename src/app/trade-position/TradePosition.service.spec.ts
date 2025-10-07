import { TestingModule } from '@nestjs/testing';
import { TradePositionService } from './TradePosition.service';
import {
  Platform,
  TradePositionStatus,
  CreateTradePositionOptions,
  UpdateTradePositionOptions,
  MongoDbTestingModule,
  MongoDbTestingService,
  createTestingModuleWithProviders,
  forceGC,
  Currency,
} from '../../shared';
import { Types } from 'mongoose';
import { TradePositionDocument } from './TradePosition.schema';
import { TradePositionModule } from './TradePosition.module';

describe('TradePositionService', () => {
  let service: TradePositionService;
  let mongoDbTestingService: MongoDbTestingService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [TradePositionModule, MongoDbTestingModule],
    }).compile();

    service = module.get(TradePositionService);
    mongoDbTestingService = await module.resolve(MongoDbTestingService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await mongoDbTestingService.clean();
  });

  afterAll(async () => {
    await mongoDbTestingService.close();
    await module.close();
    forceGC();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTradePosition', () => {
    const mockCreateOptions: CreateTradePositionOptions = {
      platform: Platform.HYPERLIQUID,
      status: TradePositionStatus.CREATED,
      token: 'BTC',
      currency: Currency.USDC,
      amountIn: 1000,
      entryPrice: 0.005,
      timeOpened: new Date('2024-03-20T10:00:00Z'),
    };

    it('should create a trade position with CREATED status', async () => {
      const result = await service.createTradePosition(mockCreateOptions);

      expect(result).toBeDefined();
      expect(result.platform).toBe(mockCreateOptions.platform);
      expect(result.status).toBe(TradePositionStatus.CREATED);
      expect(result.token).toBe(mockCreateOptions.token);
      expect(result.currency).toBe(mockCreateOptions.currency);
      expect(result.amountIn).toBe(mockCreateOptions.amountIn);
      expect(result.entryPrice).toBe(mockCreateOptions.entryPrice);
      expect(result.timeOpened).toEqual(mockCreateOptions.timeOpened);
    });
  });

  describe('updateTradePosition', () => {
    let createdPosition: TradePositionDocument;

    beforeEach(async () => {
      const createOptions: CreateTradePositionOptions = {
        platform: Platform.HYPERLIQUID,
        status: TradePositionStatus.CREATED,
        token: 'BTC',
        currency: Currency.USDC,
        amountIn: 1000,
        timeOpened: new Date('2024-03-20T10:00:00Z'),
      };

      createdPosition = await service.createTradePosition(createOptions);
    });

    it('should update a trade position', async () => {
      const mockUpdateOptions: UpdateTradePositionOptions = {
        status: TradePositionStatus.OPEN,
        amountOut: 900,
        timeOpened: new Date('2024-03-20T10:00:00Z'),
        timeClosed: new Date('2024-03-20T10:05:00Z'),
        currentPrice: 0.008,
        takeProfitPrice: 0.01,
      };

      const result = await service.updateTradePosition(
        String(createdPosition._id),
        mockUpdateOptions,
      );

      expect(result).toBeDefined();
      if (result) {
        expect(result.status).toBe(TradePositionStatus.OPEN);
        expect(result.amountOut).toBe(mockUpdateOptions.amountOut);
        expect(result.timeClosed).toEqual(mockUpdateOptions.timeClosed);
        expect(result.currentPrice).toBe(mockUpdateOptions.currentPrice);
        expect(result.takeProfitPrice).toBe(mockUpdateOptions.takeProfitPrice);
      }
    });

    it('should return null if trade position not found', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const mockUpdateOptions: UpdateTradePositionOptions = {
        status: TradePositionStatus.OPEN,
      };

      const result = await service.updateTradePosition(
        nonExistentId,
        mockUpdateOptions,
      );

      expect(result).toBeNull();
    });
  });

  describe('getOpenTradePositions', () => {
    beforeEach(async () => {
      // Create some test positions
      const positions = [
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.OPEN,
          token: 'BTC',
          currency: Currency.USDC,
          amountIn: 1000,
          timeOpened: new Date('2024-03-20T10:00:00Z'),
        },
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.OPEN,
          token: 'ETH',
          currency: Currency.USDC,
          amountIn: 2000,
          timeOpened: new Date('2024-03-20T11:00:00Z'),
        },
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.CLOSED,
          token: 'SOL',
          currency: Currency.USDC,
          amountIn: 3000,
          timeOpened: new Date('2024-03-20T12:00:00Z'),
        },
      ];

      for (const position of positions) {
        await service.createTradePosition(position);
      }
    });

    it('should return all trade positions with OPEN status', async () => {
      const result = await service.getOpenTradePositions();

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(
        result.every((pos) => pos.status === TradePositionStatus.OPEN),
      ).toBe(true);
    });

    it('should return empty array when no open positions exist', async () => {
      // Update all positions to CLOSED status
      const openPositions = await service.getOpenTradePositions();
      for (const position of openPositions) {
        await service.updateTradePosition(String(position._id), {
          status: TradePositionStatus.CLOSED,
        });
      }

      const result = await service.getOpenTradePositions();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('position status transitions', () => {
    let createdPosition: TradePositionDocument;

    beforeEach(async () => {
      const createOptions: CreateTradePositionOptions = {
        platform: Platform.HYPERLIQUID,
        status: TradePositionStatus.CREATED,
        token: 'BTC',
        currency: 'USDC',
        amountIn: 1000,
      };

      createdPosition = await service.createTradePosition(createOptions);
    });

    it('should transition from CREATED to OPEN when order is filled', async () => {
      const updateOptions: UpdateTradePositionOptions = {
        status: TradePositionStatus.OPEN,
        timeOpened: new Date(),
        entryPrice: 50000,
        currentPrice: 50000,
      };

      const result = await service.updateTradePosition(
        String(createdPosition._id),
        updateOptions,
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(TradePositionStatus.OPEN);
      expect(result?.timeOpened).toBeDefined();
      expect(result?.entryPrice).toBe(50000);
      expect(result?.currentPrice).toBe(50000);
    });

    it('should transition from OPEN to CLOSED when reduce order is filled', async () => {
      // First open the position
      await service.updateTradePosition(String(createdPosition._id), {
        status: TradePositionStatus.OPEN,
        timeOpened: new Date(),
        entryPrice: 50000,
        currentPrice: 50000,
      });

      // Then close it
      const closeTime = new Date();
      const updateOptions: UpdateTradePositionOptions = {
        status: TradePositionStatus.CLOSED,
        timeClosed: closeTime,
        currentPrice: 52000,
        realizedPnl: 200,
      };

      const result = await service.updateTradePosition(
        String(createdPosition._id),
        updateOptions,
      );

      expect(result).toBeDefined();
      expect(result?.status).toBe(TradePositionStatus.CLOSED);
      expect(result?.timeClosed).toEqual(closeTime);
      expect(result?.currentPrice).toBe(52000);
      expect(result?.realizedPnl).toBe(200);
    });

    it('should update position with positive PnL', async () => {
      await service.updateTradePosition(String(createdPosition._id), {
        status: TradePositionStatus.OPEN,
        entryPrice: 50000,
      });

      const result = await service.updateTradePosition(
        String(createdPosition._id),
        {
          status: TradePositionStatus.CLOSED,
          currentPrice: 55000,
          realizedPnl: 500, // Profit
        },
      );

      expect(result?.realizedPnl).toBe(500);
      expect(result?.currentPrice).toBeGreaterThan(result?.entryPrice || 0);
    });

    it('should update position with negative PnL', async () => {
      await service.updateTradePosition(String(createdPosition._id), {
        status: TradePositionStatus.OPEN,
        entryPrice: 50000,
      });

      const result = await service.updateTradePosition(
        String(createdPosition._id),
        {
          status: TradePositionStatus.CLOSED,
          currentPrice: 48000,
          realizedPnl: -200, // Loss
        },
      );

      expect(result?.realizedPnl).toBe(-200);
      expect(result?.currentPrice).toBeLessThan(result?.entryPrice || 0);
    });

    it('should maintain position data integrity during status transitions', async () => {
      const entryPrice = 50000;
      const entryTime = new Date();

      // Open position
      await service.updateTradePosition(String(createdPosition._id), {
        status: TradePositionStatus.OPEN,
        timeOpened: entryTime,
        entryPrice,
        currentPrice: entryPrice,
      });

      // Close position
      const closeTime = new Date();
      const result = await service.updateTradePosition(
        String(createdPosition._id),
        {
          status: TradePositionStatus.CLOSED,
          timeClosed: closeTime,
          currentPrice: 52000,
          realizedPnl: 200,
        },
      );

      // Verify all data is maintained
      expect(result?.status).toBe(TradePositionStatus.CLOSED);
      expect(result?.entryPrice).toBe(entryPrice);
      expect(result?.timeOpened).toEqual(entryTime);
      expect(result?.timeClosed).toEqual(closeTime);
      expect(result?.currentPrice).toBe(52000);
      expect(result?.realizedPnl).toBe(200);
    });
  });

  describe('getTradePositionByToken', () => {
    beforeEach(async () => {
      const positions = [
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.OPEN,
          token: 'BTC',
          currency: 'USDC',
          amountIn: 1000,
        },
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.CLOSED,
          token: 'BTC',
          currency: 'USDC',
          amountIn: 2000,
        },
        {
          platform: Platform.HYPERLIQUID,
          status: TradePositionStatus.OPEN,
          token: 'ETH',
          currency: 'USDC',
          amountIn: 500,
        },
      ];

      for (const position of positions) {
        await service.createTradePosition(position);
      }
    });

    it('should get position by token without status filter', async () => {
      const result = await service.getTradePositionByToken('BTC');

      expect(result).toBeDefined();
      expect(result?.token).toBe('BTC');
    });

    it('should get open position by token with status filter', async () => {
      const result = await service.getTradePositionByToken(
        'BTC',
        TradePositionStatus.OPEN,
      );

      expect(result).toBeDefined();
      expect(result?.token).toBe('BTC');
      expect(result?.status).toBe(TradePositionStatus.OPEN);
    });

    it('should get closed position by token with status filter', async () => {
      const result = await service.getTradePositionByToken(
        'BTC',
        TradePositionStatus.CLOSED,
      );

      expect(result).toBeDefined();
      expect(result?.token).toBe('BTC');
      expect(result?.status).toBe(TradePositionStatus.CLOSED);
    });

    it('should return null for non-existent token', async () => {
      const result = await service.getTradePositionByToken('DOGE');

      expect(result).toBeNull();
    });
  });
});
