import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository } from '../../shared';
import { TradeOrder, TradeOrderDocument } from './TradeOrder.schema';

@Injectable()
export class TradeOrderRepository extends BaseMongoRepository<TradeOrderDocument> {
  constructor(
    @InjectModel(TradeOrder.name)
    tradeOrderModel: Model<TradeOrderDocument>,
  ) {
    super(tradeOrderModel);
  }
}
