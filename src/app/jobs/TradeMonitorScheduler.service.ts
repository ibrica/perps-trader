import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TradeManagerService } from '@atrader-app/trade-manager/TradeManager.service';

interface LockDoc {
  _id: string;
  leaseUntil: Date;
}

@Injectable()
export class TradeMonitorScheduler {
  private readonly logger = new Logger(TradeMonitorScheduler.name);
  private static readonly LOCK_ID = 'trade-monitor';
  private static readonly LEASE_MS = 55_000; // < 1 min cron

  constructor(
    private readonly tradeManager: TradeManagerService,
    @InjectModel('locks') private readonly locks: Model<LockDoc>,
  ) {}

  @Cron('* * * * *') // Every minute
  async run(): Promise<void> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + TradeMonitorScheduler.LEASE_MS);

    try {
      const lock = await this.locks.findOneAndUpdate(
        {
          _id: TradeMonitorScheduler.LOCK_ID,
          $or: [
            { leaseUntil: { $lte: now } },
            { leaseUntil: { $exists: false } },
          ],
        },
        { _id: TradeMonitorScheduler.LOCK_ID, leaseUntil },
        { upsert: true, new: true },
      );

      // If we didn't acquire (someone else did), skip
      if (lock.leaseUntil.getTime() < leaseUntil.getTime() - 1) {
        return;
      }

      this.logger.log('Trade Monitor Scheduler started');
      const open = await this.tradeManager.monitorAndClosePositions();

      if (open < 5) {
        await this.tradeManager.startTrading();
      }

      this.logger.log(`Trade Monitor Scheduler finished - ${open} open positions`);
    } catch (error) {
      this.logger.error('Trade Monitor Scheduler error:', error);
    } finally {
      // Release lock early
      try {
        await this.locks.updateOne(
          { _id: TradeMonitorScheduler.LOCK_ID },
          { $set: { leaseUntil: new Date() } },
        );
      } catch (error) {
        this.logger.warn('Failed to release lock:', error);
      }
    }
  }
}