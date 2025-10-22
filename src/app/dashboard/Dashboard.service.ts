import { Injectable, Logger } from '@nestjs/common';
import { TradePositionRepository } from '../trade-position/TradePosition.repository';
import { PerpRepository } from '../perps/Perp.repository';
import { SettingsRepository } from '../settings/Settings.repository';
import {
  DashboardAnalytics,
  TimePeriod,
  DashboardOverview,
  TimeSeriesDataPoint,
  TokenBreakdown,
  PositionResponse,
  PaginatedPositionsResponse,
} from './Dashboard.dto';
import { TradePositionStatus } from '../../shared';
import { TradePositionDocument } from '../trade-position/TradePosition.schema';
import { PerpDocument } from '../perps/Perp.schema';
import { UpdatePerpDto } from '../perps/Perp.service';
import { SettingsDocument } from '../settings/Settings.schema';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly tradePositionRepository: TradePositionRepository,
    private readonly perpRepository: PerpRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  async getAnalytics(
    period?: TimePeriod,
    startDate?: string,
    endDate?: string,
    token?: string,
  ): Promise<DashboardAnalytics> {
    const dateRange = this.getDateRange(period, startDate, endDate);
    const filter: any = {
      timeOpened: {
        $gte: dateRange.start,
        $lte: dateRange.end,
      },
    };

    if (token) {
      filter.token = token;
    }

    const positions = await this.tradePositionRepository.getAll({ filter });

    const overview = this.calculateOverview(positions);
    const timeSeries = this.calculateTimeSeries(positions, dateRange);
    const tokenBreakdown = this.calculateTokenBreakdown(positions);

    return {
      overview,
      timeSeries,
      tokenBreakdown,
    };
  }

  async getPositions(
    status?: TradePositionStatus,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaginatedPositionsResponse> {
    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    const positions = await this.tradePositionRepository.getAll({
      filter,
      queryOptions: {
        limit,
        skip: offset,
        sort: { timeOpened: -1 },
      },
    });

    const total = await this.tradePositionRepository.count(filter);

    const positionResponses: PositionResponse[] = positions.map((position) =>
      this.mapPositionToResponse(position),
    );

    return {
      positions: positionResponses,
      total,
      limit,
      offset,
    };
  }

  async updatePositionExitFlag(
    id: string,
    exitFlag: boolean,
  ): Promise<PositionResponse | null> {
    const position = await this.tradePositionRepository.updateById(id, {
      exitFlag,
    });

    if (!position) {
      return null;
    }

    return this.mapPositionToResponse(position);
  }

  async getAllPerps(): Promise<PerpDocument[]> {
    return this.perpRepository.getAll();
  }

  async updatePerp(
    id: string,
    updateDto: UpdatePerpDto,
  ): Promise<PerpDocument | null> {
    return this.perpRepository.updateById(id, updateDto);
  }

  async getSettings(): Promise<SettingsDocument | null> {
    const settings = await this.settingsRepository.getAll({
      queryOptions: { limit: 1 },
    });
    return settings[0] || null;
  }

  async updateSettings(
    closeAllPositions: boolean,
  ): Promise<SettingsDocument | null> {
    // Get the first settings document or create one
    const existingSettings = await this.getSettings();

    if (existingSettings) {
      return this.settingsRepository.updateById(
        existingSettings._id.toString(),
        { closeAllPositions },
      );
    }

    // Create new settings if none exist
    return this.settingsRepository.create({ closeAllPositions });
  }

  private getDateRange(
    period?: TimePeriod,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const end = endDate ? new Date(endDate) : new Date();
    let start: Date;

    switch (period) {
      case TimePeriod.LAST_7_DAYS:
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_30_DAYS:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_3_MONTHS:
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_6_MONTHS:
        start = new Date(end.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.LAST_YEAR:
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.CUSTOM:
        start = startDate ? new Date(startDate) : new Date(0);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    }

    return { start, end };
  }

  private calculateOverview(
    positions: TradePositionDocument[],
  ): DashboardOverview {
    let totalPnl = 0;
    let totalVolume = 0;
    let winningTrades = 0;
    let openPositionsCount = 0;
    let closedPositionsCount = 0;

    for (const position of positions) {
      if (position.status === TradePositionStatus.OPEN) {
        openPositionsCount++;
      } else if (position.status === TradePositionStatus.CLOSED) {
        closedPositionsCount++;
      }

      const pnl = position.totalRealizedPnl || position.realizedPnl || 0;
      totalPnl += pnl;
      totalVolume += position.amountIn || 0;

      if (pnl > 0) {
        winningTrades++;
      }
    }

    const totalTrades = positions.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      totalPnl,
      totalVolume,
      winRate,
      openPositionsCount,
      closedPositionsCount,
      totalTrades,
    };
  }

  private calculateTimeSeries(
    positions: TradePositionDocument[],
    dateRange: { start: Date; end: Date },
  ): TimeSeriesDataPoint[] {
    const dailyPnl = new Map<string, number>();

    // Initialize all days in range with 0
    const currentDate = new Date(dateRange.start);
    while (currentDate <= dateRange.end) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyPnl.set(dateKey, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate PnL by day
    for (const position of positions) {
      if (position.timeClosed) {
        const dateKey = position.timeClosed.toISOString().split('T')[0];
        const pnl = position.totalRealizedPnl || position.realizedPnl || 0;
        const currentPnl = dailyPnl.get(dateKey) || 0;
        dailyPnl.set(dateKey, currentPnl + pnl);
      }
    }

    // Convert to array and sort by date
    return Array.from(dailyPnl.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateTokenBreakdown(
    positions: TradePositionDocument[],
  ): TokenBreakdown[] {
    const tokenStats = new Map<
      string,
      {
        totalPnl: number;
        totalVolume: number;
        winningTrades: number;
        totalTrades: number;
      }
    >();

    for (const position of positions) {
      const token = position.token || 'UNKNOWN';
      const stats = tokenStats.get(token) || {
        totalPnl: 0,
        totalVolume: 0,
        winningTrades: 0,
        totalTrades: 0,
      };

      const pnl = position.totalRealizedPnl || position.realizedPnl || 0;
      stats.totalPnl += pnl;
      stats.totalVolume += position.amountIn || 0;
      stats.totalTrades++;

      if (pnl > 0) {
        stats.winningTrades++;
      }

      tokenStats.set(token, stats);
    }

    // Convert to array and calculate win rate
    return Array.from(tokenStats.entries())
      .map(([token, stats]) => ({
        token,
        totalPnl: stats.totalPnl,
        totalVolume: stats.totalVolume,
        winRate:
          stats.totalTrades > 0
            ? (stats.winningTrades / stats.totalTrades) * 100
            : 0,
        tradeCount: stats.totalTrades,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl); // Sort by PnL descending
  }

  private mapPositionToResponse(
    position: TradePositionDocument,
  ): PositionResponse {
    let pnlPercent: number | undefined;
    if (
      position.entryPrice &&
      position.currentPrice &&
      position.positionDirection
    ) {
      const priceDiff = position.currentPrice - position.entryPrice;
      const isLong = position.positionDirection === 'LONG';
      const direction = isLong ? 1 : -1;
      pnlPercent = (direction * priceDiff * 100) / position.entryPrice;
    }

    return {
      id: position._id.toString(),
      platform: position.platform,
      token: position.token || '',
      status: position.status,
      positionDirection: position.positionDirection,
      positionSize: position.positionSize,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      takeProfitPrice: position.takeProfitPrice,
      stopLossPrice: position.stopLossPrice,
      realizedPnl: position.totalRealizedPnl || position.realizedPnl,
      leverage: position.leverage,
      exitFlag: position.exitFlag,
      timeOpened: position.timeOpened,
      timeClosed: position.timeClosed,
      pnlPercent,
    };
  }
}
