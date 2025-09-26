import {
  PositionDirection,
  PositionType,
  TradePositionStatus,
} from '../../constants2';
import { Platform } from '..';

export interface UpdateTradePositionOptions {
  platform?: Platform;
  status?: TradePositionStatus;
  tokenMint?: string;
  currencyMint?: string;
  amountIn?: bigint;
  amountOut?: bigint;
  timeLastPriceUpdate?: Date;
  timeOpened?: Date;
  timeClosed?: Date;
  entryPrice?: number;
  currentPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  positionSize?: bigint;
  positionDirection?: PositionDirection;
  positionType?: PositionType;
  leverage?: number;
  marketIndex?: number;
  realizedPnl?: number;
  exitFlag?: boolean;
}
