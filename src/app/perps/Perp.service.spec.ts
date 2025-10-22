import { TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PerpService, CreatePerpDto, UpdatePerpDto } from './Perp.service';
import { PerpRepository } from './Perp.repository';
import { Perp, PerpSchema, MarketDirection } from './Perp.schema';
import {
  createTestingModuleWithProviders,
  MongoDbTestingModule,
  MongoDbTestingService,
  forceGC,
  Platform,
  Currency,
} from '../../shared';

// Test helper function to create a test perp DTO
const createTestPerpDto = (
  options?: Partial<CreatePerpDto>,
): CreatePerpDto => ({
  name: options?.name || 'SOL-USDC Perpetual',
  token: options?.token || 'SOL',
  currency: options?.currency || Currency.USDC,
  platform: options?.platform || Platform.HYPERLIQUID,
  buyFlag: options?.buyFlag ?? false,
  marketDirection: options?.marketDirection ?? MarketDirection.NEUTRAL,
  isActive: options?.isActive ?? true,
  defaultLeverage: options?.defaultLeverage,
  recommendedAmount: options?.recommendedAmount,
});

describe('PerpService', () => {
  let service: PerpService;
  let mongoDbTestingService: MongoDbTestingService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [
        MongooseModule.forFeature([{ name: Perp.name, schema: PerpSchema }]),
        TestingModule,
        MongoDbTestingModule,
      ],
      providers: [PerpService, PerpRepository],
    }).compile();

    service = module.get(PerpService);
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

  describe('create', () => {
    it('should create a perp with default values', async () => {
      const createDto = createTestPerpDto();

      const perp = await service.create(createDto);

      expect(perp).toBeDefined();
      expect(perp.name).toBe('SOL-USDC Perpetual');
      expect(perp.platform).toBe(Platform.HYPERLIQUID);
      expect(perp.buyFlag).toBe(false);
      expect(perp.marketDirection).toBe(MarketDirection.NEUTRAL);
      expect(perp.isActive).toBe(true);
      expect(perp.token).toBe('SOL');
      expect(perp.currency).toBe(Currency.USDC);
      expect(perp.defaultLeverage).toBe(1);
    });

    it('should create a perp with custom values', async () => {
      const createDto = createTestPerpDto({
        name: 'BTC-USDT Perpetual',
        token: 'BTC',
        currency: Currency.USDT,
        buyFlag: true,
        marketDirection: MarketDirection.UP,
        isActive: false,
        defaultLeverage: 5,
        recommendedAmount: 1000,
      });

      const perp = await service.create(createDto);

      expect(perp.name).toBe('BTC-USDT Perpetual');
      expect(perp.token).toBe('BTC');
      expect(perp.currency).toBe(Currency.USDT);
      expect(perp.buyFlag).toBe(true);
      expect(perp.marketDirection).toBe(MarketDirection.UP);
      expect(perp.isActive).toBe(false);
      expect(perp.defaultLeverage).toBe(5);
      expect(perp.recommendedAmount).toBe(1000);
    });
  });

  describe('findAll', () => {
    it('should return all perps', async () => {
      await service.create(
        createTestPerpDto({
          name: 'SOL-USDC Perpetual',
          token: 'SOL',
        }),
      );
      await service.create(
        createTestPerpDto({
          name: 'BTC-USDC Perpetual',
          token: 'BTC',
        }),
      );

      const perps = await service.findAll();

      expect(perps).toHaveLength(2);
      expect(perps.map((p) => p.name)).toContain('SOL-USDC Perpetual');
      expect(perps.map((p) => p.name)).toContain('BTC-USDC Perpetual');
    });

    it('should return empty array when no perps exist', async () => {
      const perps = await service.findAll();
      expect(perps).toEqual([]);
    });
  });

  describe('findByPlatformAndBuyFlag', () => {
    it('should find perps by platform and buy flag', async () => {
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: true,
        }),
      );
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: false,
        }),
      );

      const hyperliquidBuyPerps = await service.findByPlatformAndBuyFlag(
        Platform.HYPERLIQUID,
        true,
      );
      const hyperliquidNoBuyPerps = await service.findByPlatformAndBuyFlag(
        Platform.HYPERLIQUID,
        false,
      );

      expect(hyperliquidBuyPerps).toHaveLength(1);
      expect(hyperliquidNoBuyPerps).toHaveLength(1);
    });
  });

  describe('findByToken', () => {
    it('should find perp by token', async () => {
      const perp = await service.create(
        createTestPerpDto({
          token: 'ETH',
        }),
      );

      const foundPerp = await service.findByToken('ETH');
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp!._id)).toBe(String(perp._id));
      expect(foundPerp!.token).toBe('ETH');
    });

    it('should return null for non-existent token', async () => {
      const foundPerp = await service.findByToken('UNKNOWN');
      expect(foundPerp).toBeNull();
    });
  });

  describe('findByCurrency', () => {
    it('should find perp by currency', async () => {
      const perp = await service.create(
        createTestPerpDto({
          currency: Currency.SOL,
          token: 'SOL',
        }),
      );

      const foundPerp = await service.findByCurrency(Currency.SOL);
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp!._id)).toBe(String(perp._id));
      expect(foundPerp!.currency).toBe(Currency.SOL);
    });

    it('should return null for non-existent currency', async () => {
      const foundPerp = await service.findByCurrency(Currency.BTC);
      expect(foundPerp).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find perp by id', async () => {
      const perp = await service.create(createTestPerpDto());

      const foundPerp = await service.findById(String(perp._id));
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp._id)).toBe(String(perp._id));
    });

    it('should throw NotFoundException for non-existent id', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';

      await expect(service.findById(nonExistentId)).rejects.toThrow(
        new NotFoundException(`Perp with id ${nonExistentId} not found`),
      );
    });
  });

  describe('update', () => {
    it('should update perp successfully', async () => {
      const perp = await service.create(
        createTestPerpDto({
          buyFlag: false,
          marketDirection: MarketDirection.NEUTRAL,
          defaultLeverage: 1,
        }),
      );

      const updateDto: UpdatePerpDto = {
        buyFlag: true,
        marketDirection: MarketDirection.UP,
        name: 'Updated Perp Name',
        defaultLeverage: 3,
        recommendedAmount: 500,
      };

      const updatedPerp = await service.update(String(perp._id), updateDto);

      expect(updatedPerp.buyFlag).toBe(true);
      expect(updatedPerp.marketDirection).toBe(MarketDirection.UP);
      expect(updatedPerp.name).toBe('Updated Perp Name');
      expect(updatedPerp.defaultLeverage).toBe(3);
      expect(updatedPerp.recommendedAmount).toBe(500);
    });

    it('should throw NotFoundException for non-existent id', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const updateDto: UpdatePerpDto = { buyFlag: true };

      await expect(service.update(nonExistentId, updateDto)).rejects.toThrow(
        new NotFoundException(`Perp with id ${nonExistentId} not found`),
      );
    });
  });

  describe('delete', () => {
    it('should delete perp successfully', async () => {
      const perp = await service.create(createTestPerpDto());

      await service.delete(String(perp._id));

      // Verify perp is deleted by trying to find it
      await expect(service.findById(String(perp._id))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPerpsForTrading', () => {
    it('should return only perps marked for trading on specified platform', async () => {
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: true,
          name: 'SOL-USDC Trading',
        }),
      );
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: false,
          name: 'BTC-USDC No Trading',
        }),
      );

      const hyperliquidTradingPerps = await service.getPerpsForTrading(
        Platform.HYPERLIQUID,
      );

      expect(hyperliquidTradingPerps).toHaveLength(1);
      expect(hyperliquidTradingPerps[0].name).toBe('SOL-USDC Trading');
      expect(hyperliquidTradingPerps[0].buyFlag).toBe(true);
    });

    it('should return empty array when no perps are marked for trading', async () => {
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: false,
        }),
      );

      const tradingPerps = await service.getPerpsForTrading(
        Platform.HYPERLIQUID,
      );
      expect(tradingPerps).toEqual([]);
    });
  });

  describe('getAllPerpsForTrading', () => {
    it('should return all perps marked for trading', async () => {
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: true,
          isActive: true,
          name: 'SOL-USDC Trading',
        }),
      );
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: false,
          isActive: true,
          name: 'BTC-USDC No Trading',
        }),
      );
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: true,
          isActive: true,
          name: 'ETH-USDC Trading',
        }),
      );
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: true,
          isActive: false,
          name: 'AVAX-USDC Inactive',
        }),
      );

      const allTradingPerps = await service.getAllPerpsForTrading();

      expect(allTradingPerps).toHaveLength(2); // Only buyFlag: true and isActive: true perps
      const names = allTradingPerps.map((p) => p.name);
      expect(names).toContain('SOL-USDC Trading');
      expect(names).toContain('ETH-USDC Trading');
      expect(names).not.toContain('BTC-USDC No Trading'); // buyFlag: false
      expect(names).not.toContain('AVAX-USDC Inactive'); // isActive: false
    });

    it('should return empty array when no perps are marked for trading', async () => {
      await service.create(
        createTestPerpDto({
          platform: Platform.HYPERLIQUID,
          buyFlag: false,
        }),
      );

      const allTradingPerps = await service.getAllPerpsForTrading();
      expect(allTradingPerps).toEqual([]);
    });
  });

  describe('integration tests', () => {
    it('should handle complete CRUD lifecycle', async () => {
      // Create
      const createDto = createTestPerpDto({
        name: 'Lifecycle Test Perp',
        buyFlag: false,
        marketDirection: MarketDirection.NEUTRAL,
        defaultLeverage: 2,
      });

      const createdPerp = await service.create(createDto);
      expect(createdPerp.name).toBe('Lifecycle Test Perp');
      expect(createdPerp.defaultLeverage).toBe(2);

      // Read
      const foundPerp = await service.findById(String(createdPerp._id));
      expect(foundPerp.name).toBe('Lifecycle Test Perp');

      // Update
      const updatedPerp = await service.update(String(createdPerp._id), {
        buyFlag: true,
        marketDirection: MarketDirection.UP,
        defaultLeverage: 5,
      });
      expect(updatedPerp.buyFlag).toBe(true);
      expect(updatedPerp.marketDirection).toBe(MarketDirection.UP);
      expect(updatedPerp.defaultLeverage).toBe(5);

      // Verify it appears in trading perps
      const tradingPerps = await service.getPerpsForTrading(
        Platform.HYPERLIQUID,
      );
      expect(tradingPerps).toHaveLength(1);
      expect(String(tradingPerps[0]._id)).toBe(String(createdPerp._id));

      // Delete
      await service.delete(String(createdPerp._id));
      await expect(service.findById(String(createdPerp._id))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('determinePositionDirection', () => {
    it('should return LONG for UP market direction', async () => {
      const perp = await service.create(
        createTestPerpDto({
          marketDirection: MarketDirection.UP,
        }),
      );

      const direction = service.determinePositionDirection(perp);
      expect(direction).toBe('LONG');
    });

    it('should return SHORT for DOWN market direction', async () => {
      const perp = await service.create(
        createTestPerpDto({
          marketDirection: MarketDirection.DOWN,
        }),
      );

      const direction = service.determinePositionDirection(perp);
      expect(direction).toBe('SHORT');
    });

    it('should return LONG for NEUTRAL market direction', async () => {
      const perp = await service.create(
        createTestPerpDto({
          marketDirection: MarketDirection.NEUTRAL,
        }),
      );

      const direction = service.determinePositionDirection(perp);
      expect(direction).toBe('LONG');
    });
  });
});
