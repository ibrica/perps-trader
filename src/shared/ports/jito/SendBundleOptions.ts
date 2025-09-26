import { VersionedTransaction } from '@solana/web3.js';
import { Logger } from '@nestjs/common';

export interface SendBundleOptions {
  txs: VersionedTransaction[]; // max size 4
  tipLamports: bigint; // Min amount 1_000 lamports
}

export const validateSendBundleOptions = (
  options: SendBundleOptions,
  logger: Logger,
): void => {
  if (options.txs.length > 4) {
    const message = `Can't submit more than 4 txs in a single bundle, txSize: ${options.txs.length}`;
    logger.log(message);
    throw new Error(message);
  }

  if (options.txs.length === 0) {
    const message = `No transaction is submitted, txSize: ${options.txs.length}`;
    logger.log(message);
    throw new Error(message);
  }

  if (options.tipLamports < 1_000n) {
    const message = `tipLamports must be greater than 1_000, tipLamports: ${options.tipLamports}`;
    logger.log(message);
    throw new Error(message);
  }
};
