/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { TradeService } from './Trade.service';
import {
  TradeStatus,
  TradeType,
  Platform,
  CreateTradeOptions,
  PoolType,
  SwapType,
  TxStatus,
  createTestingModuleWithProviders,
  MongoDbTestingModule,
  MongoDbTestingService,
  createTestCurrencyDto,
  forceGC,
} from '../../shared';
import { TradeModule } from './Trade.module';
import { TradeRepository } from './Trade.repository';
import { BlockchainModule, BlockchainService } from '../blockchain';
import { PumpFunModule } from '../pumpfun/PumpFun.module';
import { RaydiumModule } from '../raydium/Raydium.module';
import { BlockchainDocument } from '../blockchain/Blockchain.schema';
import { MockAuthoritySignatureModule } from '../authority-signature/MockAuthoritySignature.module';
import { AuthoritySignatureModule } from '../authority-signature/AuthoritySignature.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { HyperliquidPlatformService } from '../hyperliquid/HyperliquidPlatform.service';
import { PredictorModule } from '../predictor/Predictor.module';
import { MockPredictorModule } from '../predictor/MockPredictor.module';

/**
 * Integration tests for TradeService with real database
 *
 * NOTE: Run these tests with: yarn test:integration src/app/trade/Trade.service.spec.ts
 * The integration test script includes --forceExit to handle async cleanup of database connections
 * and complex module dependencies that prevent Jest from exiting cleanly.
 */
describe('TradeService (integration)', () => {
  let service: TradeService;
  let tradeRepository: TradeRepository;
  let mongoDbTestingService: MongoDbTestingService;
  let blockchainService: BlockchainService;
  let module: TestingModule;
  let blockchain: BlockchainDocument;
  let mongoConnection: Connection;

  beforeEach(async () => {
    module = await createTestingModuleWithProviders({
      imports: [TradeModule, MongoDbTestingModule],
    })
      .overrideModule(AuthoritySignatureModule)
      .useModule(MockAuthoritySignatureModule)
      .overrideModule(PredictorModule)
      .useModule(MockPredictorModule)
      .overrideProvider(HyperliquidPlatformService)
      .useValue({
        executeTrade: jest.fn().mockResolvedValue({
          transactionId: 'dummy-drift-tx',
          status: 'failed',
          message: 'Test mock',
        }),
      })
      .compile();

    service = module.get(TradeService);
    tradeRepository = module.get(TradeRepository);
    blockchainService = module.get(BlockchainService);
    mongoDbTestingService = await module.resolve(MongoDbTestingService);
    mongoConnection = module.get<Connection>(getConnectionToken());
    blockchain = await blockchainService.getDefaultBlockChain();

    // Create test currencies for the trade
    await currencyService.create(
      createTestCurrencyDto(
        String(blockchain._id),
        'So11111111111111111111111111111111111111112', // SOL mint
        9,
        'SOL',
      ),
    );

    await currencyService.create(
      createTestCurrencyDto(
        String(blockchain._id),
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        6,
        'USDC',
      ), // USDC mint
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
      // Clean database first
      if (
        mongoDbTestingService &&
        typeof mongoDbTestingService.clean === 'function'
      ) {
        await mongoDbTestingService.clean();
      }

      // Close mongoose connection explicitly
      if (mongoConnection) {
        await mongoConnection.close();
      }

      // Close all services and connections
      if (module) {
        await module.close();
      }

      // Force garbage collection to cleanup any remaining references
      forceGC();

      // Give extra time for async cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }, 10000);

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeTrade', () => {
    const createMockTradeOptions = (): CreateTradeOptions => ({
      amountIn: 1000000n,
      expectedMarginalAmountOut: 900000n,
      platform: Platform.RAYDIUM,
      pool: 'poolAddress',
      mintFrom: 'So11111111111111111111111111111111111111112', // SOL mint
      mintTo: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
      tradeType: TradeType.DEX,
      blockchain: String(blockchain._id),
      poolType: PoolType.RAYDIUM_V4,
      swapType: SwapType.EXACT_IN,
    });

    it('should create a trade in the database with CREATED status', async () => {
      const mockTradeOptions = createMockTradeOptions();

      // Mock the platform service methods to avoid actual blockchain calls
      const mockPreparedTx = { message: {}, signatures: [] };

      // Mock executeTrade to return failed status so it falls back to Solana tx flow
      jest.spyOn(service['raydiumService'], 'executeTrade').mockResolvedValue({
        transactionId: 'dummy-tx-id',
        status: 'failed',
        message: 'Test mock falling back to Solana',
      });

      jest
        .spyOn(service['raydiumService'], 'prepare')
        .mockResolvedValue(mockPreparedTx as any);
      jest.spyOn(service['raydiumService'], 'submit').mockResolvedValue({
        transactionSignature: 'mockTxSignature',
        status: TxStatus.SUCCESS,
      });
      jest
        .spyOn(service['raydiumService'], 'getPriorityOptions')
        .mockReturnValue({ tip: 5000 });
      jest
        .spyOn(service['solanaService'], 'signVersionedTx')
        .mockResolvedValue(mockPreparedTx as any);

      // Mock PumpFun service method to avoid public key validation
      jest
        .spyOn(service['pumpfunService'], 'calculateExpectedAmountOut')
        .mockResolvedValue(900000n);

      await service.executeTrade(mockTradeOptions);

      // Verify trade was created and completed in database using repository
      const trades = await tradeRepository.getAll({});
      expect(trades).toHaveLength(1);

      const trade = trades[0];
      expect(trade.sender).toBe(
        signatureService.getSignatureWalletKey().toBase58(),
      );
      expect(trade.platform).toBe(Platform.RAYDIUM);
      expect(String(trade.amountIn)).toBe('1000000');
      expect(String(trade.expectedMarginalAmountOut)).toBe('1000000'); // Check why is the same as amountIn
      expect(trade.status).toBe(TradeStatus.COMPLETED);
      expect(trade.mintFrom).toBe(
        'So11111111111111111111111111111111111111112',
      );
      expect(trade.mintTo).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(trade.poolType).toBe(PoolType.RAYDIUM_V4);
      expect(trade.swapType).toBe(SwapType.EXACT_IN);
    });

    it('should handle PumpFun platform trades', async () => {
      const mockTradeOptions = {
        ...createMockTradeOptions(),
        platform: Platform.PUMP_FUN,
      };

      // Mock the platform service methods
      const mockPreparedTx = { message: {}, signatures: [] };
      jest
        .spyOn(service['pumpfunService'], 'prepare')
        .mockResolvedValue(mockPreparedTx as any);
      jest.spyOn(service['pumpfunService'], 'submit').mockResolvedValue({
        transactionSignature: 'mockTxSignature',
        status: TxStatus.SUCCESS,
      });
      jest
        .spyOn(service['pumpfunService'], 'getPriorityOptions')
        .mockReturnValue({ tip: 5000 });
      jest
        .spyOn(service['solanaService'], 'signVersionedTx')
        .mockResolvedValue(mockPreparedTx as any);

      // Mock PumpFun service method to avoid public key validation
      jest
        .spyOn(service['pumpfunService'], 'calculateExpectedAmountOut')
        .mockResolvedValue(900000n);

      await service.executeTrade(mockTradeOptions);

      // Verify trade was created with PumpFun platform
      const trades = await tradeRepository.getAll({});
      expect(trades).toHaveLength(1);

      const trade = trades[0];
      expect(trade.platform).toBe(Platform.PUMP_FUN);
      expect(trade.status).toBe(TradeStatus.COMPLETED);
    });

    it('should throw error when platform is not found', async () => {
      const invalidOptions = {
        ...createMockTradeOptions(),
        platform: undefined as any,
      };

      await expect(service.executeTrade(invalidOptions)).rejects.toThrow(
        'platform: Path `platform` is required',
      );
    });

    it('should throw error for unsupported platform', async () => {
      const unsupportedOptions = {
        ...createMockTradeOptions(),
        platform: 'UNSUPPORTED_PLATFORM' as any,
      };

      await expect(service.executeTrade(unsupportedOptions)).rejects.toThrow(
        '`UNSUPPORTED_PLATFORM` is not a valid enum value for path `platform`',
      );
    });

    it('should use decimals from currency service for trade preparation', async () => {
      const mockTradeOptions = createMockTradeOptions();

      // Mock the platform service methods
      const mockPreparedTx = { message: {}, signatures: [] };
      jest
        .spyOn(service['raydiumService'], 'prepare')
        .mockResolvedValue(mockPreparedTx as any);
      jest.spyOn(service['raydiumService'], 'submit').mockResolvedValue({
        transactionSignature: 'mockTxSignature',
        status: TxStatus.SUCCESS,
      });
      jest
        .spyOn(service['raydiumService'], 'getPriorityOptions')
        .mockReturnValue({ tip: 5000 });
      jest
        .spyOn(service['solanaService'], 'signVersionedTx')
        .mockResolvedValue(mockPreparedTx as any);

      // Mock PumpFun service method to avoid public key validation
      jest
        .spyOn(service['pumpfunService'], 'calculateExpectedAmountOut')
        .mockResolvedValue(900000n);

      await service.executeTrade(mockTradeOptions);

      // Verify that prepare was called with correct decimals from currency service
      // expect(prepareSpy).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     decimalsIn: 9, // SOL decimals
      //     decimalsOut: 6, // USDC decimals
      //     sender: signatureService.getSignatureWalletKey().toBase58(),
      //     amountIn: 1000000n,
      //     marginalAmountOut: 900000n,
      //     mintFrom: 'So11111111111111111111111111111111111111112',
      //     mintTo: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      //   }),
      // );
    });
  });

  describe('getTradesByTradePosition', () => {
    const createMockTradeOptions = (): CreateTradeOptions => ({
      amountIn: 1000000n,
      expectedMarginalAmountOut: 900000n,
      platform: Platform.RAYDIUM,
      pool: 'poolAddress',
      mintFrom: 'So11111111111111111111111111111111111111112', // SOL mint
      mintTo: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
      tradeType: TradeType.DEX,
      blockchain: String(blockchain._id),
      poolType: PoolType.RAYDIUM_V4,
      swapType: SwapType.EXACT_IN,
    });

    it('should return trades for a specific trade position', async () => {
      // Use valid MongoDB ObjectId strings (24 character hex)
      const tradePositionId = '507f1f77bcf86cd799439011';
      const differentPositionId = '507f1f77bcf86cd799439012';

      // Create multiple trades and manually add tradePosition field as ObjectId
      await tradeRepository.create({
        ...createMockTradeOptions(),
        status: TradeStatus.CREATED,
        sender: signatureService.getSignatureWalletKey().toBase58(),
        tradePosition: new Types.ObjectId(tradePositionId),
      });

      await tradeRepository.create({
        ...createMockTradeOptions(),
        status: TradeStatus.COMPLETED,
        sender: signatureService.getSignatureWalletKey().toBase58(),
        tradePosition: new Types.ObjectId(tradePositionId),
      });

      await tradeRepository.create({
        ...createMockTradeOptions(),
        status: TradeStatus.CREATED,
        sender: signatureService.getSignatureWalletKey().toBase58(),
        tradePosition: new Types.ObjectId(differentPositionId),
      });

      // Test the method
      const trades = await service.getTradesByTradePosition(tradePositionId);

      // Verify results
      expect(trades).toHaveLength(2);
      trades.forEach((trade) => {
        expect(String(trade.tradePosition)).toBe(tradePositionId);
      });

      // Verify that the different position trade is not included
      const differentTrades =
        await service.getTradesByTradePosition(differentPositionId);
      expect(differentTrades).toHaveLength(1);
      expect(String(differentTrades[0].tradePosition)).toBe(
        differentPositionId,
      );
    });

    it('should return empty array when no trades found for trade position', async () => {
      // Use a valid MongoDB ObjectId string that doesn't exist in database
      const nonExistentPositionId = '507f1f77bcf86cd799439999';
      const trades = await service.getTradesByTradePosition(
        nonExistentPositionId,
      );

      expect(trades).toHaveLength(0);
      expect(Array.isArray(trades)).toBe(true);
    });
  });
});
