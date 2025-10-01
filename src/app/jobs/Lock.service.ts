import { Injectable } from '@nestjs/common';
import { LockRepository } from './Lock.repository';

@Injectable()
export class LockService {
  constructor(private readonly lockRepository: LockRepository) {}

  async acquireLock(name: string, leaseUntil: Date): Promise<boolean> {
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
    return lock.leaseUntil.getTime() > leaseUntil.getTime() - 1;
  }

  async releaseLock(name: string): Promise<void> {
    this.lockRepository.deleteOne({ filter: { name } });
  }
}
