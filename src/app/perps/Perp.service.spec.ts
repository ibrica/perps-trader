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
  createTestCurrencyDto,
  forceGC,
  Platform,
} from '../../shared';
import { BlockchainModule, BlockchainService } from '../blockchain';
import { CurrencyModule, CurrencyService } from '../currency';
import { BlockchainDocument } from '../blockchain/Blockchain.schema';
import { CurrencyDocument } from '../currency/Currency.schema';

// Test helper function to create a test perp DTO
const createTestPerpDto = (
  baseCurrency: string,
  quoteCurrency: string,
  options?: Partial<CreatePerpDto>,
): CreatePerpDto => ({
  name: options?.name || 'SOL-USDC Perpetual',
  baseCurrency,
  quoteCurrency,
  platform: options?.platform || Platform.DRIFT,
  buyFlag: options?.buyFlag ?? false,
  marketDirection: options?.marketDirection ?? MarketDirection.NEUTRAL,
  marketIndex: options?.marketIndex,
  baseAssetSymbol: options?.baseAssetSymbol || 'SOL',
  isActive: options?.isActive ?? true,
});

describe('PerpService', () => {
  let service: PerpService;
  let mongoDbTestingService: MongoDbTestingService;
  let blockchainService: BlockchainService;
  let currencyService: CurrencyService;

  let module: TestingModule;
  let blockchain: BlockchainDocument;
  let baseCurrency: CurrencyDocument;
  let quoteCurrency: CurrencyDocument;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [
        MongooseModule.forFeature([{ name: Perp.name, schema: PerpSchema }]),
        TestingModule,
        MongoDbTestingModule,
        BlockchainModule,
        CurrencyModule,
      ],
      providers: [PerpService, PerpRepository],
    }).compile();

    service = module.get(PerpService);
    blockchainService = module.get(BlockchainService);
    currencyService = module.get(CurrencyService);

    mongoDbTestingService = await module.resolve(MongoDbTestingService);

    // Set up test data
    blockchain = await blockchainService.getDefaultBlockChain();
    baseCurrency = await currencyService.create(
      createTestCurrencyDto(String(blockchain._id), 'solMint', 9, 'SOL'),
    );
    quoteCurrency = await currencyService.create(
      createTestCurrencyDto(String(blockchain._id), 'usdcMint', 6, 'USDC'),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongoDbTestingService.clean();
    await module.close();
    forceGC();
  });

  describe('create', () => {
    it('should create a perp with default values', async () => {
      const createDto = createTestPerpDto(
        String(baseCurrency._id),
        String(quoteCurrency._id),
      );

      const perp = await service.create(createDto);

      expect(perp).toBeDefined();
      expect(perp.name).toBe('SOL-USDC Perpetual');
      expect(perp.platform).toBe(Platform.DRIFT);
      expect(perp.buyFlag).toBe(false);
      expect(perp.marketDirection).toBe(MarketDirection.NEUTRAL);
      expect(perp.isActive).toBe(true);
      expect(perp.baseAssetSymbol).toBe('SOL');
    });

    it('should create a perp with custom values', async () => {
      const createDto = createTestPerpDto(
        String(baseCurrency._id),
        String(quoteCurrency._id),
        {
          name: 'BTC-USDC Perpetual',
          buyFlag: true,
          marketDirection: MarketDirection.UP,
          marketIndex: 1,
          baseAssetSymbol: 'BTC',
          isActive: false,
        },
      );

      const perp = await service.create(createDto);

      expect(perp.name).toBe('BTC-USDC Perpetual');
      expect(perp.buyFlag).toBe(true);
      expect(perp.marketDirection).toBe(MarketDirection.UP);
      expect(perp.marketIndex).toBe(1);
      expect(perp.baseAssetSymbol).toBe('BTC');
      expect(perp.isActive).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return all perps', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          name: 'SOL-USDC Perpetual',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          name: 'BTC-USDC Perpetual',
          baseAssetSymbol: 'BTC',
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
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: true,
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: false,
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.PUMP_FUN,
          buyFlag: true,
        }),
      );

      const driftBuyPerps = await service.findByPlatformAndBuyFlag(
        Platform.DRIFT,
        true,
      );
      const driftNoBuyPerps = await service.findByPlatformAndBuyFlag(
        Platform.DRIFT,
        false,
      );
      const pumpfunBuyPerps = await service.findByPlatformAndBuyFlag(
        Platform.PUMP_FUN,
        true,
      );

      expect(driftBuyPerps).toHaveLength(1);
      expect(driftNoBuyPerps).toHaveLength(1);
      expect(pumpfunBuyPerps).toHaveLength(1);
    });
  });

  describe('findByMarketIndex', () => {
    it('should find perp by market index', async () => {
      const perp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          marketIndex: 42,
        }),
      );

      const foundPerp = await service.findByMarketIndex(42);
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp!._id)).toBe(String(perp._id));
    });

    it('should return null for non-existent market index', async () => {
      const foundPerp = await service.findByMarketIndex(999);
      expect(foundPerp).toBeNull();
    });

    it('should not find inactive perp', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          marketIndex: 42,
          isActive: false,
        }),
      );

      const foundPerp = await service.findByMarketIndex(42);
      expect(foundPerp).toBeNull();
    });
  });

  describe('findByBaseAssetSymbol', () => {
    it('should find perp by base asset symbol', async () => {
      const perp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          baseAssetSymbol: 'ETH',
        }),
      );

      const foundPerp = await service.findByBaseAssetSymbol('ETH');
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp!._id)).toBe(String(perp._id));
    });

    it('should return null for non-existent base asset symbol', async () => {
      const foundPerp = await service.findByBaseAssetSymbol('UNKNOWN');
      expect(foundPerp).toBeNull();
    });
  });

  describe('findByBaseCurrencyMint', () => {
    it('should find perp by base currency mint address', async () => {
      const perp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          baseAssetSymbol: 'SOL',
        }),
      );

      const foundPerp = await service.findByBaseCurrencyMint('solMint');
      expect(foundPerp).toBeDefined();
      expect(String(foundPerp!._id)).toBe(String(perp._id));
      expect(foundPerp!.baseAssetSymbol).toBe('SOL');
    });

    it('should return null for non-existent mint address', async () => {
      const foundPerp = await service.findByBaseCurrencyMint('nonExistentMint');
      expect(foundPerp).toBeNull();
    });

    it('should not find inactive perp', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          baseAssetSymbol: 'SOL',
          isActive: false,
        }),
      );

      const foundPerp = await service.findByBaseCurrencyMint('solMint');
      expect(foundPerp).toBeNull();
    });

    it('should find correct perp when multiple perps exist with different base currencies', async () => {
      // Create another currency for testing
      const ethCurrency = await currencyService.create(
        createTestCurrencyDto(String(blockchain._id), 'ethMint', 18, 'ETH'),
      );

      // Create perp with SOL as base currency
      const solPerp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          baseAssetSymbol: 'SOL',
          name: 'SOL-USDC Perpetual',
        }),
      );

      // Create perp with ETH as base currency
      const ethPerp = await service.create(
        createTestPerpDto(String(ethCurrency._id), String(quoteCurrency._id), {
          baseAssetSymbol: 'ETH',
          name: 'ETH-USDC Perpetual',
        }),
      );

      // Find by SOL mint address
      const foundSolPerp = await service.findByBaseCurrencyMint('solMint');
      expect(foundSolPerp).toBeDefined();
      expect(String(foundSolPerp!._id)).toBe(String(solPerp._id));
      expect(foundSolPerp!.baseAssetSymbol).toBe('SOL');

      // Find by ETH mint address
      const foundEthPerp = await service.findByBaseCurrencyMint('ethMint');
      expect(foundEthPerp).toBeDefined();
      expect(String(foundEthPerp!._id)).toBe(String(ethPerp._id));
      expect(foundEthPerp!.baseAssetSymbol).toBe('ETH');
    });
  });

  describe('findById', () => {
    it('should find perp by id', async () => {
      const perp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id)),
      );

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
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          buyFlag: false,
          marketDirection: MarketDirection.NEUTRAL,
        }),
      );

      const updateDto: UpdatePerpDto = {
        buyFlag: true,
        marketDirection: MarketDirection.UP,
        name: 'Updated Perp Name',
      };

      const updatedPerp = await service.update(String(perp._id), updateDto);

      expect(updatedPerp.buyFlag).toBe(true);
      expect(updatedPerp.marketDirection).toBe(MarketDirection.UP);
      expect(updatedPerp.name).toBe('Updated Perp Name');
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
      const perp = await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id)),
      );

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
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: true,
          name: 'SOL-USDC Trading',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: false,
          name: 'BTC-USDC No Trading',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.PUMP_FUN,
          buyFlag: true,
          name: 'ETH-USDC Pumpfun Trading',
        }),
      );

      const driftTradingPerps = await service.getPerpsForTrading(
        Platform.DRIFT,
      );
      const pumpfunTradingPerps = await service.getPerpsForTrading(
        Platform.PUMP_FUN,
      );

      expect(driftTradingPerps).toHaveLength(1);
      expect(driftTradingPerps[0].name).toBe('SOL-USDC Trading');
      expect(driftTradingPerps[0].buyFlag).toBe(true);

      expect(pumpfunTradingPerps).toHaveLength(1);
      expect(pumpfunTradingPerps[0].name).toBe('ETH-USDC Pumpfun Trading');
    });

    it('should return empty array when no perps are marked for trading', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: false,
        }),
      );

      const tradingPerps = await service.getPerpsForTrading(Platform.DRIFT);
      expect(tradingPerps).toEqual([]);
    });
  });

  describe('getAllPerpsForTrading', () => {
    it('should return all perps marked for trading across all platforms', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: true,
          name: 'SOL-USDC Drift Trading',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
          buyFlag: false,
          name: 'BTC-USDC No Trading',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.PUMP_FUN,
          buyFlag: true,
          name: 'ETH-USDC Pumpfun Trading',
        }),
      );
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.RAYDIUM,
          buyFlag: true,
          name: 'AVAX-USDC Raydium Trading',
        }),
      );

      const allTradingPerps = await service.getAllPerpsForTrading();

      expect(allTradingPerps).toHaveLength(3); // Only buyFlag: true perps
      const names = allTradingPerps.map((p) => p.name);
      expect(names).toContain('SOL-USDC Drift Trading');
      expect(names).toContain('ETH-USDC Pumpfun Trading');
      expect(names).toContain('AVAX-USDC Raydium Trading');
      expect(names).not.toContain('BTC-USDC No Trading'); // buyFlag: false
    });

    it('should return empty array when no perps are marked for trading', async () => {
      await service.create(
        createTestPerpDto(String(baseCurrency._id), String(quoteCurrency._id), {
          platform: Platform.DRIFT,
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
      const createDto = createTestPerpDto(
        String(baseCurrency._id),
        String(quoteCurrency._id),
        {
          name: 'Lifecycle Test Perp',
          buyFlag: false,
          marketDirection: MarketDirection.NEUTRAL,
          marketIndex: 100,
        },
      );

      const createdPerp = await service.create(createDto);
      expect(createdPerp.name).toBe('Lifecycle Test Perp');

      // Read
      const foundPerp = await service.findById(String(createdPerp._id));
      expect(foundPerp.name).toBe('Lifecycle Test Perp');

      // Update
      const updatedPerp = await service.update(String(createdPerp._id), {
        buyFlag: true,
        marketDirection: MarketDirection.UP,
      });
      expect(updatedPerp.buyFlag).toBe(true);
      expect(updatedPerp.marketDirection).toBe(MarketDirection.UP);

      // Verify it appears in trading perps
      const tradingPerps = await service.getPerpsForTrading(Platform.DRIFT);
      expect(tradingPerps).toHaveLength(1);
      expect(String(tradingPerps[0]._id)).toBe(String(createdPerp._id));

      // Delete
      await service.delete(String(createdPerp._id));
      await expect(service.findById(String(createdPerp._id))).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
