import { TradeOrderStatus } from '../../constants';

export interface CreateTradeOrderOptions {
  status: TradeOrderStatus;
  position: string;
  type: string;
  orderId?: string;
  coin?: string;
  side?: string;
  size?: number;
  price?: number;
  fee?: number;
  timestampUpdate?: number;
  timestampFill?: number;
  closedPnl?: number;
  limitPrice?: number;
  originalSize?: number;
  clientOrderId?: string;
  // Trigger order fields
  isTrigger?: boolean;
  triggerPrice?: number;
  triggerType?: 'tp' | 'sl';
  isMarket?: boolean;
}
