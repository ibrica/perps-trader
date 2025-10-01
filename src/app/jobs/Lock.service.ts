import { Injectable } from '@nestjs/common';
import { LockRepository } from './Lock.repository';
import { LockDocument } from './Lock.schema';

@Injectable()
export class LockService {
  constructor(private readonly lockRepository: LockRepository) {}

  async acquireLock(
    name: string,
    leaseUntil: Date,
  ): Promise<LockDocument | null> {
    const lock = await this.lockRepository.getOneAndUpdate(
      {
        name,
        $or: [
          { leaseUntil: { $lte: new Date() } },
          { leaseUntil: { $exists: false } },
        ],
      },
      { name, leaseUntil },
      { upsert: true, new: true },
    );

    // If we didn't acquire (someone else did), skip
    if (lock.leaseUntil.getTime() < leaseUntil.getTime() - 1) {
      return;
    }
    return lock;
  }

  async releaseLock(id: string): Promise<void> {
    await this.lockRepository.deleteOne({ _id: id });
  }
}
