/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { VersionedTransaction } from '@solana/web3.js';
import { BasePlatformService } from './BasePlatformService';
import { TxStatus } from '../../constants';
import { TxPriority } from '../../models';
import { SolanaService } from '../../../infrastructure';

// Create a concrete implementation for testing
class TestPlatformService extends BasePlatformService {
  async prepare(): Promise<VersionedTransaction> {
    return {} as VersionedTransaction;
  }
}

describe('BasePlatformService', () => {
  let service: TestPlatformService;
  let mockLogger: jest.Mocked<Logger>;
  let mockSolanaService: jest.Mocked<SolanaService>;

  beforeEach(async () => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockSolanaService = {
      sendAndConfirmTransaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [TestPlatformService],
    }).compile();

    service = module.get<TestPlatformService>(TestPlatformService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submit', () => {
    const mockTransaction = {} as unknown as VersionedTransaction;
    const mockPriority: TxPriority = { tip: 5000 };

    it('should submit transaction successfully', async () => {
      mockSolanaService.sendAndConfirmTransaction.mockResolvedValue({
        txSignature: 'mockTxSignature',
        txStatus: TxStatus.SUCCESS,
        timedOut: false,
      });

      const result = await service.submit(
        mockTransaction,
        mockPriority,
        mockLogger,
        mockSolanaService,
      );

      expect(result).toEqual({
        transactionSignature: 'mockTxSignature',
        status: TxStatus.SUCCESS,
      });
      expect(mockSolanaService.sendAndConfirmTransaction).toHaveBeenCalledWith(
        mockTransaction,
        {
          signWithBackendAuthWallet: false,
          submitOptions: { priority: mockPriority },
        },
      );
      expect(mockLogger.log).toHaveBeenCalledWith('Swap submit request');
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Swap successful mockTxSignature',
      );
    });

    it('should handle pending transaction status', async () => {
      mockSolanaService.sendAndConfirmTransaction.mockResolvedValue({
        txSignature: 'mockTxSignature',
        txStatus: TxStatus.PENDING,
        timedOut: false,
      });

      const result = await service.submit(
        mockTransaction,
        mockPriority,
        mockLogger,
        mockSolanaService,
      );

      expect(result.status).toBe(TxStatus.PENDING);
      expect(mockLogger.log).toHaveBeenCalledWith('Swap submit request');
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Swap is pending mockTxSignature',
      );
    });

    it('should handle failed transaction status', async () => {
      mockSolanaService.sendAndConfirmTransaction.mockResolvedValue({
        txSignature: 'mockTxSignature',
        txStatus: TxStatus.FAILED,
        timedOut: true,
      });

      const result = await service.submit(
        mockTransaction,
        mockPriority,
        mockLogger,
        mockSolanaService,
      );

      expect(result.status).toBe(TxStatus.FAILED);
      expect(mockLogger.log).toHaveBeenCalledWith('Swap submit request');
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Swap failed mockTxSignature, swap timedout - true',
      );
    });

    it('should handle failed transaction without timeout info', async () => {
      mockSolanaService.sendAndConfirmTransaction.mockResolvedValue({
        txSignature: 'mockTxSignature',
        txStatus: TxStatus.FAILED,
        timedOut: undefined,
      });

      const result = await service.submit(
        mockTransaction,
        mockPriority,
        mockLogger,
        mockSolanaService,
      );

      expect(result.status).toBe(TxStatus.FAILED);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Swap failed mockTxSignature, swap timedout - false',
      );
    });
  });
});
