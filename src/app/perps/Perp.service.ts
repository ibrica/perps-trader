import { Injectable, NotFoundException } from '@nestjs/common';
import { PerpRepository } from './Perp.repository';
import { PerpDocument, MarketDirection } from './Perp.schema';
import {
  Platform,
  toObjectId,
  Optional,
  PositionDirection,
} from '../../shared';

export interface CreatePerpDto {
  name: string;
  baseCurrency: string;
  quoteCurrency: string;
  platform: Platform;
  buyFlag?: boolean;
  marketDirection?: MarketDirection;
  marketIndex?: number;
  baseAssetSymbol: string;
  isActive?: boolean;
  leverage?: number;
  recommendedAmount?: string;
}

export interface UpdatePerpDto {
  name?: string;
  buyFlag?: boolean;
  marketDirection?: MarketDirection;
  isActive?: boolean;
  leverage?: number;
  recommendedAmount?: string;
}

@Injectable()
export class PerpService {
  constructor(private perpRepository: PerpRepository) {}

  async create(createPerpDto: CreatePerpDto): Promise<PerpDocument> {
    const perpData = {
      ...createPerpDto,
      baseCurrency: toObjectId(createPerpDto.baseCurrency),
      quoteCurrency: toObjectId(createPerpDto.quoteCurrency),
      buyFlag: createPerpDto.buyFlag ?? false,
      marketDirection: createPerpDto.marketDirection ?? MarketDirection.NEUTRAL,
      isActive: createPerpDto.isActive ?? true,
      leverage: createPerpDto.leverage ?? 1,
      recommendedAmount: createPerpDto.recommendedAmount,
    };

    return this.perpRepository.create(perpData, {
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
  }

  async findAll(): Promise<PerpDocument[]> {
    return this.perpRepository.getAll({
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
  }

  async findByPlatformAndBuyFlag(
    platform: Platform,
    buyFlag: boolean,
  ): Promise<PerpDocument[]> {
    return this.perpRepository.findByPlatformAndBuyFlag(platform, buyFlag);
  }

  async findByMarketIndex(marketIndex: number): Promise<PerpDocument | null> {
    return this.perpRepository.findByMarketIndex(marketIndex);
  }

  async findByBaseAssetSymbol(
    baseAssetSymbol: string,
  ): Promise<PerpDocument | null> {
    return this.perpRepository.findByBaseAssetSymbol(baseAssetSymbol);
  }

  async findByBaseCurrencyMint(
    mintAddress: string,
  ): Promise<PerpDocument | null> {
    return this.perpRepository.findByBaseCurrencyMint(mintAddress);
  }

  async findById(id: string): Promise<PerpDocument> {
    const perp = await this.perpRepository.getById(id, {
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
    return Optional.of(perp).getOrThrow(
      new NotFoundException(`Perp with id ${id} not found`),
    );
  }

  async update(
    id: string,
    updatePerpDto: UpdatePerpDto,
  ): Promise<PerpDocument> {
    const perp = await this.perpRepository.updateById(id, updatePerpDto, {
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
    return Optional.of(perp).getOrThrow(
      new NotFoundException(`Perp with id ${id} not found`),
    );
  }

  async delete(id: string): Promise<void> {
    await this.perpRepository.findByIdAndDelete(id);
  }

  async getPerpsForTrading(platform: Platform): Promise<PerpDocument[]> {
    return this.findByPlatformAndBuyFlag(platform, true);
  }

  async getAllPerpsForTrading(): Promise<PerpDocument[]> {
    return this.perpRepository.getAll({
      filter: { buyFlag: true, isActive: true },
      queryOptions: { populate: ['baseCurrency', 'quoteCurrency'] },
    });
  }

  /**
   * Determines the position direction based on the perp's market direction
   * @param perp - The perp document
   * @returns PositionDirection - LONG for UP market, SHORT for DOWN market, LONG as default
   */
  determinePositionDirection(perp: PerpDocument): PositionDirection {
    if (perp.marketDirection === MarketDirection.UP) {
      return PositionDirection.LONG;
    } else if (perp.marketDirection === MarketDirection.DOWN) {
      return PositionDirection.SHORT;
    }
    return PositionDirection.LONG;
  }
}
