import { TradePositionDocument } from '../../app/trade-position/TradePosition.schema';
import { PredictorAdapter } from '../predictor/PredictorAdapter';
import {
  TradeOrderResult,
  EnterPositionOptions,
  PositionDirection,
  TrendTimeframe,
  TrendStatus,
} from '../../shared';

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
  ): Promise<PositionDirection | undefined> {
    const trendsResponse = await this.predictorAdapter.getTrendsForToken(token);
    if (!trendsResponse) {
      throw new Error('No trends response from predictor adapter');
    }
    // For now only use the one hour trend and the fifteen minute trend to see  if the price is moving in the same direction
    const { trends } = trendsResponse;
    const oneHourTrend = trends[TrendTimeframe.ONE_HOUR].trend;
    const fifteenMinuteTrend = trends[TrendTimeframe.FIFTEEN_MIN].trend;
    if (
      oneHourTrend !== TrendStatus.UNDEFINED &&
      oneHourTrend !== TrendStatus.NEUTRAL &&
      oneHourTrend === fifteenMinuteTrend
    ) {
      return oneHourTrend === TrendStatus.UP
        ? PositionDirection.LONG
        : PositionDirection.SHORT;
    }
  }
}
