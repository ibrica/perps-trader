export interface SubscriptionMessage {
  action: 'subscribe' | 'unsubscribe';
  tokenMint: string;
}

export interface TradeIndexerEvent {
  Amount: string;
  CollateralAmount: string;
  CurvePosition: string;
  TokenMint: string;
  CollateralMintAddress: string;
  Sender: string;
  IsBuy: boolean;
  BlockNumber: string;
  BlockTimestamp: string;
}

export interface TradeNotification {
  type: 'trade';
  tokenMint: string;
  trade: TradeIndexerEvent;
  timestamp: string;
}

export interface SubscriptionResponse {
  type: 'success' | 'error' | 'notification';
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface IndexerErrorResponse {
  type: 'error';
  message: string;
  code: string;
}

export type WebSocketMessage =
  | TradeNotification
  | SubscriptionResponse
  | IndexerErrorResponse;
