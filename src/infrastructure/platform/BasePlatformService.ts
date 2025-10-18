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

  abstract getCurrentPrice(token: string): Promise<number>;

  /**
   * Replace take-profit order for trailing functionality
   * Optional method - platforms that don't support trailing can leave as no-op
   * @returns Object with new order ID and count of cancelled orders for verification
   */
  async replaceTakeProfitOrder(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    direction: PositionDirection,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    positionId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newTpPrice: number,
  ): Promise<{ newOrderId: string; cancelledCount: number }> {
    // Default implementation: no-op for platforms that don't support trailing
    // Return empty result to indicate no action taken
    return { newOrderId: '', cancelledCount: 0 };
  }

  protected async determineDirection(
    token: string,
  ): Promise<PositionDirection | null> {
    // TODO: organize fallback so predictor can be optional
    const trendsResponse = await this.predictorAdapter.getTrendsForToken(token);
    if (!trendsResponse) {
      return null;
    }
    // For now only use the one hour trend and the fifteen minute trend to see if the price is moving in the same direction
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
    return null;
  }
}
