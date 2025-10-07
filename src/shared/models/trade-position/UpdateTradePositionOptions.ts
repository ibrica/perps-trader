import {
  PositionDirection,
  PositionType,
  TradePositionStatus,
} from '../../constants';
import { Platform } from '..';

export interface UpdateTradePositionOptions {
  platform?: Platform;
  status?: TradePositionStatus;
  positionType?: PositionType;
  token?: string;
  currency?: string;
  amountIn?: number;
  amountOut?: number;
  positionDirection?: PositionDirection;
  leverage?: number;
  positionSize?: number;
  entryPrice?: number;
  currentPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  realizedPnl?: number;
  timeOpened?: Date;
  timeClosed?: Date;
  exitFlag?: boolean;
}
