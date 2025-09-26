import { Keypair } from '@solana/web3.js';
import * as bs58 from 'bs58';

export const stringToKeypair = (privateKey: string): Keypair => {
  return Keypair.fromSecretKey(bs58.default.decode(privateKey));
};
