import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository } from '../../shared';
import { TradePosition, TradePositionDocument } from './TradePosition.schema';

@Injectable()
export class TradePositionRepository extends BaseMongoRepository<TradePositionDocument> {
  constructor(
    @InjectModel(TradePosition.name)
    tradePositionModel: Model<TradePositionDocument>,
  ) {
    super(tradePositionModel);
  }
}
