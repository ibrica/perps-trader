import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { TradeOrderResult } from '../trade-order';
import { EnterPositionOptions } from './EnterPositionOptions';

export abstract class BasePlatformService {
  abstract enterPosition(
    options: EnterPositionOptions,
  ): Promise<TradeOrderResult>;

  abstract exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<TradeOrderResult>;
}
