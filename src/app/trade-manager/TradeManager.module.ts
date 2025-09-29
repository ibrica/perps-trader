import { DynamicModule, Global, Module } from '@nestjs/common';
import { TradeManagerService } from './TradeManager.service';
import { TradeModule } from '../trade/Trade.module';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PredictorModule } from '../predictor/Predictor.module';
import { PlatformManagerModule } from '../platform-manager/PlatformManager.module';
import { PerpModule } from '../perps/Perp.module';

@Global()
@Module({
  imports: [
    TradeModule,
    TradePositionModule,
    PredictorModule,
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
