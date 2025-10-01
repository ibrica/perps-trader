import { Injectable } from '@nestjs/common';
import { LockRepository } from './Lock.repository';

@Injectable()
export class LockService {
  constructor(private readonly lockRepository: LockRepository) {}

  async acquireLock(name: string, leaseUntil: Date): Promise<boolean> {
    try {
      // Check if lock already exists and is still valid
      const existingLock = await this.lockRepository.getOne({
        filter: { name },
      });

      if (
        existingLock &&
        existingLock.leaseUntil.getTime() > new Date().getTime()
      ) {
        // Lock exists and is not expired - cannot acquire
        return false;
      }

      const lock = await this.lockRepository.getOneAndUpdate(
        {
          name,
          $or: [
            { leaseUntil: { $lte: new Date() } },
            { leaseUntil: { $exists: false } },
          ],
        },
        { $set: { name, leaseUntil } },
        { upsert: true, new: true },
      );

      if (!lock) {
        return false;
      }

      // Check if the lease matches what we requested (within 1ms tolerance)
      return Math.abs(lock.leaseUntil.getTime() - leaseUntil.getTime()) <= 1;
    } catch (error: unknown) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  async releaseLock(name: string): Promise<void> {
    await this.lockRepository.deleteOne({ filter: { name } });
  }
}
