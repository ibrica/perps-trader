import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TradeManagerService } from '../trade-manager/TradeManager.service';
import { LockService } from './Lock.service';

@Injectable()
export class TradeMonitorScheduler {
  private readonly logger = new Logger(TradeMonitorScheduler.name);
  private static readonly LOCK_NAME = 'trade-monitor';
  private static readonly LEASE_MS = 55_000; // < 1 min cron

  constructor(
    private readonly tradeManager: TradeManagerService,
    private readonly lockService: LockService,
  ) {}

  @Cron('* * * * *') // Every minute
  async run(): Promise<void> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + TradeMonitorScheduler.LEASE_MS);

    try {
      if (
        await this.lockService.acquireLock(
          TradeMonitorScheduler.LOCK_NAME,
          leaseUntil,
        )
      ) {
        this.logger.log('Trade Monitor Scheduler started');
        const open = await this.tradeManager.monitorAndClosePositions();

        if (open < 5) {
          await this.tradeManager.startTrading();
        }

        this.logger.log(
          `Trade Monitor Scheduler finished - ${open} open positions`,
        );
      } else {
        this.logger.debug(
          'Trade Monitor Scheduler skipped - lock acquired by another instance',
        );
      }
    } catch (error) {
      this.logger.error('Trade Monitor Scheduler error:', error);
    } finally {
      // Release lock early
      try {
        await this.lockService.releaseLock(TradeMonitorScheduler.LOCK_NAME);
      } catch (error) {
        this.logger.warn('Failed to release lock:', error);
      }
    }
  }
}
