import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository } from '../../shared';
import { Lock, LockDocument } from './Lock.schema';

@Injectable()
export class LockRepository extends BaseMongoRepository<LockDocument> {
  constructor(
    @InjectModel(Lock.name)
    lockModel: Model<LockDocument>,
  ) {
    super(lockModel);
  }
}
