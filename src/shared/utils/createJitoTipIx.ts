import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { SystemProgram } from '@solana/web3.js';
import { tipWalletPK } from '../constants/solana';

export const createJitoTipIx = (
  sender: PublicKey,
  amount: bigint,
): TransactionInstruction => {
  return SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: tipWalletPK,
    lamports: amount,
  });
};
