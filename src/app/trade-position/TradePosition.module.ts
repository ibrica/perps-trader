import { DynamicModule, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradePosition, TradePositionSchema } from './TradePosition.schema';
import { TradePositionService } from './TradePosition.service';
import { TradePositionRepository } from './TradePosition.repository';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradePosition.name, schema: TradePositionSchema },
    ]),
  ],
  providers: [TradePositionService, TradePositionRepository],
  exports: [TradePositionService, TradePositionRepository],
})
export class TradePositionModule {
  static register(): DynamicModule {
    return {
      module: TradePositionModule,
    };
  }
}
