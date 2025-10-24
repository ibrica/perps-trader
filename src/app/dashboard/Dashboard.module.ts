import { Module } from '@nestjs/common';
import { DashboardController } from './Dashboard.controller';
import { DashboardService } from './Dashboard.service';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PerpModule } from '../perps/Perp.module';
import { SettingsModule } from '../settings/Settings.module';
import { CsrfGuard } from '../auth/guards/Csrf.guard';
import { AuthModule } from '../auth/Auth.module';

@Module({
  imports: [TradePositionModule, PerpModule, SettingsModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, CsrfGuard],
  exports: [DashboardService],
})
export class DashboardModule {}
