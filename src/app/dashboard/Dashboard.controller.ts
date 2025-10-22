import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DashboardService } from './Dashboard.service';
import {
  GetAnalyticsQueryDto,
  GetPositionsQueryDto,
  DashboardAnalytics,
  PaginatedPositionsResponse,
  PositionResponse,
} from './Dashboard.dto';
import { PerpDocument } from '../perps/Perp.schema';
import { UpdatePerpDto } from '../perps/Perp.service';
import { SettingsDocument } from '../settings/Settings.schema';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('analytics')
  async getAnalytics(
    @Query() query: GetAnalyticsQueryDto,
  ): Promise<DashboardAnalytics> {
    return this.dashboardService.getAnalytics(
      query.period,
      query.startDate,
      query.endDate,
      query.token,
    );
  }

  @Get('positions')
  async getPositions(
    @Query() query: GetPositionsQueryDto,
  ): Promise<PaginatedPositionsResponse> {
    return this.dashboardService.getPositions(
      query.status,
      query.limit,
      query.offset,
    );
  }

  @Patch('positions/:id')
  async updatePosition(
    @Param('id') id: string,
    @Body() body: { exitFlag: boolean },
  ): Promise<PositionResponse> {
    if (typeof body.exitFlag !== 'boolean') {
      throw new BadRequestException('exitFlag must be a boolean');
    }

    const position = await this.dashboardService.updatePositionExitFlag(
      id,
      body.exitFlag,
    );

    if (!position) {
      throw new NotFoundException(`Position with id ${id} not found`);
    }

    return position;
  }

  @Get('perps')
  async getPerps(): Promise<PerpDocument[]> {
    return this.dashboardService.getAllPerps();
  }

  @Patch('perps/:id')
  async updatePerp(
    @Param('id') id: string,
    @Body() body: UpdatePerpDto,
  ): Promise<PerpDocument> {
    const perp = await this.dashboardService.updatePerp(id, body);

    if (!perp) {
      throw new NotFoundException(`Perp with id ${id} not found`);
    }

    return perp;
  }

  @Get('settings')
  async getSettings(): Promise<SettingsDocument> {
    const settings = await this.dashboardService.getSettings();

    if (!settings) {
      throw new NotFoundException('Settings not found');
    }

    return settings;
  }

  @Patch('settings')
  async updateSettings(
    @Body() body: { closeAllPositions: boolean },
  ): Promise<SettingsDocument> {
    if (typeof body.closeAllPositions !== 'boolean') {
      throw new BadRequestException('closeAllPositions must be a boolean');
    }

    const settings = await this.dashboardService.updateSettings(
      body.closeAllPositions,
    );

    if (!settings) {
      throw new NotFoundException('Failed to update settings');
    }

    return settings;
  }
}
