import { DynamicModule, Global, Module } from '@nestjs/common';
import { TradeManagerService } from './TradeManager.service';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PredictorModule } from '../predictor/Predictor.module';
import { PlatformManagerModule } from '../platform-manager/PlatformManager.module';
import { PerpModule } from '../perps/Perp.module';
import { SettingsModule } from '../settings/Settings.module';
import { IndexerModule } from '../indexer/Indexer.module';
import { TradeOrderModule } from '../trade-order/TradeOrder.module';

@Global()
@Module({
  imports: [
    TradePositionModule,
    TradeOrderModule,
    PredictorModule,
    PlatformManagerModule,
    PerpModule,
    SettingsModule,
    IndexerModule,
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
