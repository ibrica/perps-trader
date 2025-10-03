import { DynamicModule, Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeOrder, TradeOrderSchema } from './TradeOrder.schema';
import { TradeOrderService } from './TradeOrder.service';
import { TradeOrderRepository } from './TradeOrder.repository';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TradeOrder.name, schema: TradeOrderSchema },
    ]),
  ],
  providers: [TradeOrderService, TradeOrderRepository],
  exports: [TradeOrderService],
})
export class TradeOrderModule {
  static register(): DynamicModule {
    return {
      module: TradeOrderModule,
    };
  }
}
