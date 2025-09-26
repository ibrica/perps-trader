export interface PumpFunTrade {
  blockNumber: string; // UInt256 comes as string from ClickHouse
  blockTimestamp: string; // DateTime comes as ISO string
  sender: string;
  collateralMintAddress: string;
  tokenMintAddress: string;
  isBuy: boolean;
  curvePosPostTrade: string; // UInt256 comes as string
  collateralAmount: string; // UInt256 comes as string
  tokenAmount: string; // UInt256 comes as string
}

export interface TokenTradesSummary {
  tokenMintAddress: string;
  totalTrades: number;
  firstTradeTimestamp: string;
  lastCurvePosition: string;
}

export interface TokenTradesQuery {
  curvePositionMin: string;
  curvePositionMax: string;
  lastXSeconds: number;
  firstTradeInterval: number;
  minTrades?: number;
}
