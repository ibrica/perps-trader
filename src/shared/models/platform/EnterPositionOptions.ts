import { TradeType, Blockchain, Currency } from '../../constants';
import { Platform } from './Platform';

export interface EnterPositionOptions {
  blockchain: Blockchain;

  tradeType: TradeType;

  platform: Platform;

  currencyFrom: Currency;

  currencyTo: Currency;

  leverage?: number;

  amountIn: bigint;

  expectedAmountOut?: bigint;
}
