import { Module } from '@nestjs/common';
import { MongooseModule, Schema } from '@nestjs/mongoose';
import { TradeMonitorScheduler } from './TradeMonitorScheduler.service';
import { TradeManagerModule } from '../trade-manager/TradeManager.module';

// Simple lock schema for distributed lock
const LockSchema = new Schema({
  _id: String,
  leaseUntil: Date,
});

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'locks', schema: LockSchema }]),
    TradeManagerModule,
  ],
  providers: [TradeMonitorScheduler],
  exports: [TradeMonitorScheduler],
})
export class JobsModule {}
