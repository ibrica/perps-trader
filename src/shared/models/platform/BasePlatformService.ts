import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { EnterPositionOptions } from './EnterPositionOptions';
import { PositionExecutionStatus } from '../trade-position';

export interface TradeOrderResult {
  orderId: string;
  status: PositionExecutionStatus;
  message?: string;
}

export abstract class BasePlatformService {
  abstract enterPosition(
    options: EnterPositionOptions,
  ): Promise<TradeOrderResult>;

  abstract exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<TradeOrderResult>;
}
