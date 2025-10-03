import { TradeOrderStatus } from '../../constants';

export interface UpdateTradeOrderOptions {
  status?: TradeOrderStatus;
  position?: string;
  type?: string;
  orderId?: string;
  size?: number;
  price?: number;
  fee?: number;
}
