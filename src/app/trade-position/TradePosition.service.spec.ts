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
    await module.close();
    forceGC();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTradePosition', () => {
    const mockCreateOptions: CreateTradePositionOptions = {
      platform: Platform.RAYDIUM,
      status: TradePositionStatus.PLAN,
      tokenMint: 'tokenMintAddress',
      currencyMint: 'currencyMintAddress',
      amountIn: 1000000n,
      entryPrice: 0.005,
      timeOpened: new Date('2024-03-20T10:00:00Z'),
    };

    it('should create a trade position with PLAN status', async () => {
      const result = await service.createTradePosition(mockCreateOptions);

      expect(result).toBeDefined();
      expect(result.platform).toBe(mockCreateOptions.platform);
      expect(result.status).toBe(TradePositionStatus.PLAN);
      expect(result.tokenMint).toBe(mockCreateOptions.tokenMint);
      expect(result.currencyMint).toBe(mockCreateOptions.currencyMint);
      expect(result.amountIn).toBe(mockCreateOptions.amountIn);
      expect(result.entryPrice).toBe(mockCreateOptions.entryPrice);
      expect(result.timeOpened).toEqual(mockCreateOptions.timeOpened);
    });
  });

  describe('updateTradePosition', () => {
    let createdPosition: TradePositionDocument;

    beforeEach(async () => {
      const createOptions: CreateTradePositionOptions = {
        platform: Platform.RAYDIUM,
        status: TradePositionStatus.PLAN,
        tokenMint: 'tokenMintAddress',
        currencyMint: 'currencyMintAddress',
        amountIn: 1000000n,
        timeOpened: new Date('2024-03-20T10:00:00Z'),
      };

      createdPosition = await service.createTradePosition(createOptions);
    });

    it('should update a trade position', async () => {
      const mockUpdateOptions: UpdateTradePositionOptions = {
        status: TradePositionStatus.OPEN,
        amountOut: 900000n,
        timeOpened: new Date('2024-03-20T10:00:00Z'),
        timeClosed: new Date('2024-03-20T10:05:00Z'),
        currentPrice: 0.008,
        takeProfitPrice: 0.01,
        timeLastPriceUpdate: new Date('2024-03-20T10:05:00Z'),
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
        expect(result.timeLastPriceUpdate).toEqual(
          mockUpdateOptions.timeLastPriceUpdate,
        );
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
          platform: Platform.RAYDIUM,
          status: TradePositionStatus.OPEN,
          tokenMint: 'tokenMintAddress1',
          currencyMint: 'currencyMintAddress1',
          amountIn: 1000000n,
          timeOpened: new Date('2024-03-20T10:00:00Z'),
        },
        {
          platform: Platform.RAYDIUM,
          status: TradePositionStatus.OPEN,
          tokenMint: 'tokenMintAddress2',
          currencyMint: 'currencyMintAddress2',
          amountIn: 2000000n,
          timeOpened: new Date('2024-03-20T11:00:00Z'),
        },
        {
          platform: Platform.RAYDIUM,
          status: TradePositionStatus.CLOSED,
          tokenMint: 'tokenMintAddress3',
          currencyMint: 'currencyMintAddress3',
          amountIn: 3000000n,
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
});
