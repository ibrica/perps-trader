import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TradeMonitorScheduler } from './TradeMonitorScheduler.service';
import { TradeManagerModule } from '../trade-manager/TradeManager.module';
import { LockSchema } from './Lock.schema';
import { LockRepository } from './Lock.repository';
import { LockService } from './Lock.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'locks', schema: LockSchema }]),
    TradeManagerModule,
  ],
  providers: [TradeMonitorScheduler, LockRepository, LockService],
  exports: [TradeMonitorScheduler],
})
export class JobsModule {}
