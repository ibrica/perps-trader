import { TradeOrderStatus } from '../../constants';

export interface UpdateTradeOrderOptions {
  status?: TradeOrderStatus;
  position?: string;
  type?: string;
  orderId?: string;
  coin?: string;
  side?: string;
  size?: number;
  filledSize?: number;
  remainingSize?: number;
  price?: number;
  fee?: number;
  timestampUpdate?: number;
  timestampFill?: number;
  closedPnl?: number;
  limitPrice?: number;
  originalSize?: number;
  clientOrderId?: string;
}
