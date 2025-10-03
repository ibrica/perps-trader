import { TradeOrderStatus } from '../../constants';

export interface TradeOrderResult {
  orderId?: string;
  status: TradeOrderStatus;
  size?: number;
  price?: number;
  fee?: number;
  type?: string;
  message?: string;
}
