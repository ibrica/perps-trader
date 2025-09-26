import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

export const createMockVersionedTx = (): VersionedTransaction => {
  return new VersionedTransaction(
    new TransactionMessage({
      instructions: [],
      payerKey: PublicKey.default,
      recentBlockhash: '11111111111111111111111111111111',
    }).compileToV0Message(),
  );
};
