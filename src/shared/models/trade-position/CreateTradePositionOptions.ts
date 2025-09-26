import {
  PositionDirection,
  PositionType,
  TradePositionStatus,
} from '../../constants';
import { Platform } from '..';

export interface CreateTradePositionOptions {
  platform: Platform;
  status: TradePositionStatus;
  tokenMint?: string; // For spot trades
  baseAssetSymbol?: string; // For perp trades
  currencyMint: string;
  amountIn: bigint;
  amountOut?: bigint;
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
}
