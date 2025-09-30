import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { BaseMongoRepository, Currency, Platform } from '../../shared';
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

  async findByToken(token: string): Promise<PerpDocument | null> {
    return this.getOne({
      filter: { token, isActive: true },
    });
  }

  async findByCurrency(currency: Currency): Promise<PerpDocument | null> {
    return this.getOne({
      filter: {
        isActive: true,
        currency,
      },
    });
  }
}
