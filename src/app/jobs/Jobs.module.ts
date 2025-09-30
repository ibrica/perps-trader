import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { TradeMonitorScheduler } from './TradeMonitorScheduler.service';
import { TradeManagerModule } from '../trade-manager/TradeManager.module';

// Simple lock schema for distributed lock
const LockSchema = new Schema({
  _id: { type: String, required: true },
  leaseUntil: { type: Date, required: true },
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
