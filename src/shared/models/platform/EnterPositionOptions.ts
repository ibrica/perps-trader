import { TradeType, Currency } from '../../constants';
import { Platform } from './Platform';

export interface EnterPositionOptions {
  tradeType: TradeType;

  platform: Platform;

  currency: Currency;

  token: string;

  leverage?: number;

  amountIn: number;

  expectedAmountOut?: number;
}
