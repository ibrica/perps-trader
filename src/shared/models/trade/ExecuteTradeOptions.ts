import { PoolType, SwapType, TradeType } from '../../constants2';
import { Platform } from './Platform';

export interface CreateTradeOptions {
  blockchain: string;

  tradeType: TradeType;

  platform: Platform;

  mintFrom: string;

  mintTo: string;

  amountIn: bigint;

  amountOut?: bigint;

  expectedMarginalAmountOut?: bigint;

  pool?: string;

  poolType?: PoolType;

  swapType?: SwapType;
}
