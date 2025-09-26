import { InjectModel } from '@nestjs/mongoose';
import { Model, AnyKeys, Types } from 'mongoose';
import { Injectable } from '@nestjs/common';
import {
  BaseMongoRepository,
  RepositoryQueryOptions,
  serializeBigInt,
} from '../../shared';
import { Trade, TradeDocument } from './Trade.schema';

@Injectable()
export class TradeRepository extends BaseMongoRepository<TradeDocument> {
  constructor(@InjectModel(Trade.name) tradeModel: Model<TradeDocument>) {
    super(tradeModel);
  }

  async create(
    createDto: AnyKeys<TradeDocument>,
    options?: RepositoryQueryOptions<TradeDocument>,
  ): Promise<TradeDocument> {
    // Serialize BigInt fields to strings for MongoDB storage
    const serializedDto = serializeBigInt(createDto, [
      'amountIn',
      'amountOut',
      'expectedMarginalAmountOut',
    ]);

    return super.create(serializedDto, options);
  }

  async updateById(
    id: string,
    updateDto: AnyKeys<TradeDocument>,
    options?: RepositoryQueryOptions<TradeDocument>,
  ): Promise<TradeDocument | null> {
    // Serialize BigInt fields to strings for MongoDB storage
    const serializedDto = serializeBigInt(updateDto, [
      'amountIn',
      'amountOut',
      'expectedMarginalAmountOut',
    ]);

    return super.updateById(id, serializedDto, options);
  }

  getTradeByMintFrom(mintFrom: string): Promise<TradeDocument[]> {
    return this.getAll({ filter: { mintFrom } });
  }

  getTradeByMintTo(mintTo: string): Promise<TradeDocument[]> {
    return this.getAll({ filter: { mintTo } });
  }

  getTradesByTradePosition(tradePosition: string): Promise<TradeDocument[]> {
    return this.getAll({
      filter: { tradePosition: new Types.ObjectId(tradePosition) },
    });
  }
}
