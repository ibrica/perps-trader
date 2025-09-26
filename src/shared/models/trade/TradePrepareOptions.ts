import { SwapType, TxPriority } from '../..';

export class TradePrepareOptions {
  sender: string;
  mintFrom: string;
  mintTo: string;
  amountIn: bigint;
  marginalAmountOut: bigint;
  decimalsIn?: number;
  decimalsOut?: number;
  priorityFee?: number;
  swapType?: SwapType;
  priority?: TxPriority;
}
