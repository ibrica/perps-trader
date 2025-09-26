import {
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

export const convertLegacyToVersionedTransaction = async (
  legacyTransaction: Transaction,
): Promise<VersionedTransaction> => {
  const { recentBlockhash, feePayer, instructions } = legacyTransaction;

  if (!feePayer) {
    throw new Error(
      'Payer key not defined when converting legacy to versioned tx',
    );
  }

  if (!recentBlockhash) {
    throw new Error(
      'Recent blockhash is not defined when converting legacy to versioned tx',
    );
  }

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash,
    instructions,
  });

  const compiledMessage = message.compileToV0Message();

  const versionedTransaction = new VersionedTransaction(compiledMessage);

  return versionedTransaction;
};
