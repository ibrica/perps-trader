import { PositionDirection } from '@perps/shared/constants';
import {
  ClearinghouseState,
  L2Book,
  Meta,
  OrderResponse,
  Tif,
} from 'hyperliquid';

// Use types from the SDK
export type HLMarket = Meta['universe'][0] & {
  pxDecimals?: number;
  minSize?: number;
};

export type HLPosition = ClearinghouseState['assetPositions'][0]['position'];

export interface HLBalance {
  coin: string;
  total: string;
  available: string;
  reserved: string;
}

export type HLOrderResponse = OrderResponse;

export interface HLTicker {
  coin: string;
  bid: string;
  ask: string;
  last: string;
  mark: string;
  volume24h: string;
  openInterest: string;
  fundingRate: string;
}

export type HLOrderbook = L2Book & {
  coin: string;
};

export interface PlacePerpOrderParams {
  symbol: string;
  direction: PositionDirection;
  quoteAmount: bigint;
  price?: number;
  tif?: Tif;
  leverage?: number;
  clientOrderId?: string;
  reduceOnly?: boolean;
}

export interface WsFill {
  coin: string;
  px: string;
  sz: string;
  side: string;
  time: number;
  oid: number;
  fee: string;
  closedPnl?: string;
  isSnapshot?: boolean;
}

export interface WsUserFillsMessage {
  channel: 'userFills';
  data: {
    isSnapshot: boolean;
    user: string;
    fills: WsFill[];
  };
}

export interface WsOrder {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
  cloid?: string;
}

export interface WsOrderUpdatesMessage {
  channel: 'orderUpdates';
  data: {
    user: string;
    orders: WsOrder[];
  };
}
