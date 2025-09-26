import { Entity } from '../../entity';
import {
  TradeType,
  TradeStatus,
  PoolType,
  SwapType,
} from '../../../constants2';
import { Platform } from '../Platform';

export class Trade extends Entity {
  sender: string;

  tradeType: TradeType;

  platform: Platform;

  status: TradeStatus;

  mintFrom: string;

  mintTo: string;

  amountIn: bigint;

  amountOut?: bigint;

  expectedMarginalAmountOut?: bigint;

  blockchain?: string;

  pool?: string;

  poolType?: PoolType;

  swapType?: SwapType;

  createdAt?: Date;

  updatedAt?: Date;
}
