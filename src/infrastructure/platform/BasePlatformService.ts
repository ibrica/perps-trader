import { TradePositionDocument } from '../../app/trade-position/TradePosition.schema';
import { TradeOrderResult } from '../../shared/models/trade-order';
import { EnterPositionOptions } from '../../shared/models/platform/EnterPositionOptions';
import { PositionDirection } from '../../shared/constants/PositionDirection';
import { PredictorAdapter } from '../predictor/PredictorAdapter';
import { TrendStatus } from '@perps/shared/models/predictor';

export abstract class BasePlatformService {
  constructor(protected readonly predictorAdapter: PredictorAdapter) {}

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

  protected async determineDirection(
    token: string,
  ): Promise<PositionDirection | null> {
    const trends = await this.predictorAdapter.getTrendsForToken(token);
    if (trends?.trends?.trend === TrendStatus.BULLISH) {
      return PositionDirection.LONG;
    } else if (trends?.trends?.trend === TrendStatus.BEARISH) {
      return PositionDirection.SHORT;
    }
  }
}
