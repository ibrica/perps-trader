import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { EnterPositionOptions } from './EnterPositionOptions';
import { PositionExecutionStatus } from '../trade-position';

export interface PositionExecutionResult {
  orderId: string;
  status: PositionExecutionStatus;
  message?: string;
}

export abstract class BasePlatformService {
  abstract enterPosition(
    options: EnterPositionOptions,
  ): Promise<PositionExecutionResult>;

  abstract exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<PositionExecutionResult>;
}
