import { TradePositionDocument } from '../../../app/trade-position/TradePosition.schema';
import { TradeOrderResult } from '../trade-order';
import { EnterPositionOptions } from './EnterPositionOptions';
import { PositionDirection } from '../../constants/PositionDirection';

export abstract class BasePlatformService {
  abstract enterPosition(
    options: EnterPositionOptions,
  ): Promise<TradeOrderResult>;

  abstract exitPosition(
    tradePosition: TradePositionDocument,
  ): Promise<TradeOrderResult>;

  abstract createStopLossAndTakeProfitOrders(
    token: string,
    direction: PositionDirection,
    size: number,
    positionId: string,
    stopLossPrice?: number,
    takeProfitPrice?: number,
  ): Promise<void>;
}
