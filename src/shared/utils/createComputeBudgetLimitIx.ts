import { ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';

export const createComputeBudgetLimitIx = (): TransactionInstruction => {
  return ComputeBudgetProgram.setComputeUnitLimit({
    units: 150_000,
  });
};
