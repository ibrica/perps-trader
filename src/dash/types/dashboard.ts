export enum TimePeriod {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_3_MONTHS = 'LAST_3_MONTHS',
  LAST_6_MONTHS = 'LAST_6_MONTHS',
  LAST_YEAR = 'LAST_YEAR',
  CUSTOM = 'CUSTOM',
}

export enum TradePositionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  FAILED = 'FAILED',
}

export interface DashboardOverview {
  totalPnl: number;
  totalVolume: number;
  winRate: number;
  openPositionsCount: number;
  closedPositionsCount: number;
  totalTrades: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  pnl: number;
}

export interface TokenBreakdown {
  token: string;
  totalPnl: number;
  totalVolume: number;
  winRate: number;
  tradeCount: number;
}

export interface DashboardAnalytics {
  overview: DashboardOverview;
  timeSeries: TimeSeriesDataPoint[];
  tokenBreakdown: TokenBreakdown[];
}

export interface Position {
  id: string;
  platform: string;
  token: string;
  status: TradePositionStatus;
  positionDirection?: string;
  positionSize?: number;
  entryPrice?: number;
  currentPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  realizedPnl?: number;
  leverage?: number;
  exitFlag?: boolean;
  timeOpened?: string;
  timeClosed?: string;
  pnlPercent?: number;
}

export interface PaginatedPositions {
  positions: Position[];
  total: number;
  limit: number;
  offset: number;
}

export interface Perp {
  _id: string;
  name: string;
  token: string;
  currency: string;
  platform: string;
  buyFlag: boolean;
  marketDirection: string;
  isActive: boolean;
  defaultLeverage?: number;
  recommendedAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Settings {
  _id: string;
  closeAllPositions: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardQuery {
  period?: TimePeriod;
  startDate?: string;
  endDate?: string;
  token?: string;
}
