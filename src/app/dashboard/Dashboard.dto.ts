import { IsEnum, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { TradePositionStatus } from '../../shared';

export enum TimePeriod {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_3_MONTHS = 'LAST_3_MONTHS',
  LAST_6_MONTHS = 'LAST_6_MONTHS',
  LAST_YEAR = 'LAST_YEAR',
  CUSTOM = 'CUSTOM',
}

export class GetAnalyticsQueryDto {
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  token?: string;
}

export class GetPositionsQueryDto {
  @IsOptional()
  @IsEnum(TradePositionStatus)
  status?: TradePositionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number = 0;
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

export interface PositionResponse {
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
  timeOpened?: Date;
  timeClosed?: Date;
  pnlPercent?: number;
}

export interface PaginatedPositionsResponse {
  positions: PositionResponse[];
  total: number;
  limit: number;
  offset: number;
}
