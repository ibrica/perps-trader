import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository, Platform } from '../../shared';
import { Perp, PerpDocument } from './Perp.schema';

@Injectable()
export class PerpRepository extends BaseMongoRepository<PerpDocument> {
  constructor(@InjectModel(Perp.name) perpModel: Model<PerpDocument>) {
    super(perpModel);
  }

  async findByPlatformAndBuyFlag(
    platform: Platform,
    buyFlag: boolean,
  ): Promise<PerpDocument[]> {
    return this.getAll({
      filter: { platform, buyFlag, isActive: true },
    });
  }

  async findByMarketIndex(marketIndex: number): Promise<PerpDocument | null> {
    return this.getOne({
      filter: { marketIndex, isActive: true },
    });
  }

  async findByBaseAssetSymbol(
    baseAssetSymbol: string,
  ): Promise<PerpDocument | null> {
    return this.getOne({
      filter: { baseAssetSymbol, isActive: true },
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
  }

  async findByBaseCurrencyMint(
    mintAddress: string,
  ): Promise<PerpDocument | null> {
    // First find the currency with the matching mint address
    const currency = await this.model.db
      .collection('currencies')
      .findOne({ mintAddress });

    if (!currency) {
      return null;
    }

    // Then find the perp with this currency as baseCurrency
    return this.getOne({
      filter: {
        isActive: true,
        baseCurrency: currency._id,
      },
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
  }
}
