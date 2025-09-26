import { ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';
import { priorityFee } from '../constants/solana';

export const createPriorityFeeIx = (): TransactionInstruction => {
  return ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee, // Validator Tip (adjust for priority)
  });
};
