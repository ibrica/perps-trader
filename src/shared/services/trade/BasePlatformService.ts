import { VersionedTransaction } from '@solana/web3.js';
import {
  TradePrepareOptions,
  TxPriority,
  TxSubmitResponse,
  CreateTradeOptions,
} from '../../models';
import { TxStatus } from '../../constants';
import { Logger } from '@nestjs/common';
import { SolanaService } from '../../../infrastructure';

export interface TradeExecutionResult {
  transactionId: string;
  status: 'success' | 'pending' | 'failed';
  message?: string;
}

export abstract class BasePlatformService {
  abstract prepare(options: TradePrepareOptions): Promise<VersionedTransaction>;

  public async submit(
    transaction: VersionedTransaction,
    priority: TxPriority | undefined,
    logger: Logger,
    solanaService: SolanaService,
  ): Promise<TxSubmitResponse> {
    logger.log(`Swap submit request`);

    const { txSignature, txStatus, timedOut } =
      await solanaService.sendAndConfirmTransaction(transaction, {
        signWithBackendAuthWallet: false,
        submitOptions: { priority: priority },
      });

    if (txStatus === TxStatus.SUCCESS) {
      logger.log(`Swap successful ${txSignature}`);
    } else if (txStatus === TxStatus.PENDING) {
      logger.log(`Swap is pending ${txSignature}`);
    } else if (txStatus === TxStatus.FAILED) {
      logger.log(
        `Swap failed ${txSignature}, swap timedout - ${timedOut ?? false}`,
      );
    }

    return {
      transactionSignature: txSignature,
      status: txStatus,
    };
  }

  // New method for direct trade execution (non-Solana platforms)
  public async executeTrade(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: CreateTradeOptions,
  ): Promise<TradeExecutionResult> {
    throw new Error('Direct trade execution not implemented for this platform');
  }

  // Override if the platform wants to set different priority from the default
  public getPriorityOptions(): TxPriority | undefined {
    return undefined;
  }
}
