import { TradeOrderStatus } from '../../constants';

export interface TradeOrderResult {
  orderId?: string;
  status: TradeOrderStatus;
  size?: number;
  price?: number;
  fee?: number;
  type?: string;
  message?: string;
  // Trigger order fields
  isTrigger?: boolean;
  triggerPrice?: number;
  triggerType?: 'tp' | 'sl';
  isMarket?: boolean;
  // Metadata for passing additional context
  metadata?: {
    direction?: string;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    [key: string]: any;
  };
}
