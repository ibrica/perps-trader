import { Entity } from '../../entity';
import {
  TradeType,
  TradeStatus,
  Currency,
  Blockchain,
} from '../../../constants';
import { Platform } from '../Platform';

export class Trade extends Entity {
  sender: string;

  tradeType: TradeType;

  platform: Platform;

  status: TradeStatus;

  currencyFrom: Currency;

  currencyTo: Currency;

  amountIn: bigint;

  amountOut?: bigint;

  expectedAmountOut?: bigint;

  blockchain?: Blockchain;

  leverage?: number;

  createdAt?: Date;

  updatedAt?: Date;
}
