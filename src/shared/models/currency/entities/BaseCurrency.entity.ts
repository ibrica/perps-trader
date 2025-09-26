import { Entity } from '../../entity';

export class BaseCurrency extends Entity {
  id: string;

  symbol: string;

  name: string;

  mintAddress: string;

  decimals: number;

  symbolPrefix?: string;

  coinMarketCapId?: string;

  solBalanceAfterLastTrade?: bigint;

  lastTradeDate?: Date;

  nrTrades?: number;
}
