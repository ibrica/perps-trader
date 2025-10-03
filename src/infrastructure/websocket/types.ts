export interface OrderFill {
  orderId: string;
  coin: string;
  side: string;
  size: string;
  price: string;
  fee: string;
  timestamp: number;
  closedPnl?: string;
}

export interface OrderUpdate {
  orderId: string;
  coin: string;
  side: string;
  limitPrice: string;
  size: string;
  timestamp: number;
  originalSize: string;
  clientOrderId?: string;
}
