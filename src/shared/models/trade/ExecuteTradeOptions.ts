import { TradeType, Blockchain, Currency } from '../../constants';
import { Platform } from './Platform';

export interface CreateTradeOptions {
  blockchain: Blockchain;

  tradeType: TradeType;

  platform: Platform;

  currencyFrom: Currency;

  currencyTo: Currency;

  leverage?: number;

  amountIn: bigint;

  amountOut?: bigint;

  expectedAmountOut?: bigint;
}
