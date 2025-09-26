import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { GeneralNetwork, FixedSide } from '../../constants';

export type RaydiumRequest = {
  migrationAuthority: PublicKey;
  network: GeneralNetwork;
  connection: Connection;
  startTime: number;
  tokenAmount: bigint;
  collateralAmount: bigint;
  tokenMint: PublicKey;
  tokenDecimals: number;
  collateralMint: PublicKey;
  collateralDecimals: number;
  marketId: PublicKey;
  microLamports: number;
};

export type RaydiumSwapRequest = {
  sender: PublicKey;
  targetPool: string;
  connection: Connection;
  amountIn: bigint;
  amountOut: bigint;
  mintFrom: string;
  decimalsIn: number;
  mintTo: string;
  decimalsOut: number;
  priorityFee: number;
  fixedSide?: FixedSide;
};

export type RaydiumCLMMSwapRequest = {
  sender: PublicKey;
  targetPool: string;
  connection: Connection;
  amountIn: bigint;
  amountOut: bigint;
  mintFrom: string;
  priorityFee: number;
};

export type RaydiumPriceRequest = {
  connection: Connection;
  targetPool: string;
  amountIn: bigint;
  mintFrom: string;
  mintTo: string;
  decimalsIn: number;
  decimalsOut: number;
};

export type RadiumCLMMPriceRequest = {
  connection: Connection;
  targetPool: string;
  amountIn: bigint;
  mintFrom: string;
};

export interface RaydiumSwapResponse {
  transaction: VersionedTransaction;
}

export interface RaydiumResponse {
  transaction: VersionedTransaction;
  ammId: string;
  lpTokenMintAddress: string;
}
