import { DynamicModule, Global, Module } from '@nestjs/common';
import { TradeManagerService } from './TradeManager.service';
import { BlockchainModule } from '../blockchain';
import { TradeModule } from '../trade/Trade.module';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { CurrencyModule } from '../currency';
import { PredictorModule } from '../predictor/Predictor.module';
import { SettingsModule } from '../settings/Settings.module';
import { PlatformManagerModule } from '../platform-manager/PlatformManager.module';
import { PerpModule } from '../perps/Perp.module';

@Global()
@Module({
  imports: [
    BlockchainModule,
    TradeModule,
    TradePositionModule,
    CurrencyModule,
    PredictorModule,
    SettingsModule,
    PlatformManagerModule,
    PerpModule,
  ],
  providers: [TradeManagerService],
  exports: [TradeManagerService],
})
export class TradeManagerModule {
  static register(): DynamicModule {
    return {
      module: TradeManagerModule,
    };
  }
}
