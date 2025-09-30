import { Injectable, NotFoundException } from '@nestjs/common';
import { PerpRepository } from './Perp.repository';
import { PerpDocument, MarketDirection } from './Perp.schema';
import {
  Platform,
  toObjectId,
  Optional,
  PositionDirection,
  Currency,
} from '../../shared';

export interface CreatePerpDto {
  name: string;
  token: string;
  currency: Currency;
  perpSymbol: string;
  platform: Platform;
  buyFlag?: boolean;
  marketDirection?: MarketDirection;
  isActive?: boolean;
  defaultLeverage?: number;
  recommendedAmount?: string;
}

export interface UpdatePerpDto {
  name?: string;
  buyFlag?: boolean;
  marketDirection?: MarketDirection;
  isActive?: boolean;
  defaultLeverage?: number;
  recommendedAmount?: string;
}

@Injectable()
export class PerpService {
  constructor(private perpRepository: PerpRepository) {}

  async create(createPerpDto: CreatePerpDto): Promise<PerpDocument> {
    const perpData = {
      ...createPerpDto,
      buyFlag: createPerpDto.buyFlag ?? false,
      marketDirection: createPerpDto.marketDirection ?? MarketDirection.NEUTRAL,
      isActive: createPerpDto.isActive ?? true,
      defaultLeverage: createPerpDto.defaultLeverage ?? 1,
      recommendedAmount: createPerpDto.recommendedAmount,
    };

    return this.perpRepository.create(perpData);
  }

  async findAll(): Promise<PerpDocument[]> {
    return this.perpRepository.getAll();
  }

  async findByPlatformAndBuyFlag(
    platform: Platform,
    buyFlag: boolean,
  ): Promise<PerpDocument[]> {
    return this.perpRepository.findByPlatformAndBuyFlag(platform, buyFlag);
  }

  async findByToken(token: string): Promise<PerpDocument | null> {
    return this.perpRepository.findByToken(token);
  }

  async findByCurrency(currency: Currency): Promise<PerpDocument | null> {
    return this.perpRepository.findByCurrency(currency);
  }

  async findById(id: string): Promise<PerpDocument> {
    const perp = await this.perpRepository.getById(id);
    return Optional.of(perp).getOrThrow(
      new NotFoundException(`Perp with id ${id} not found`),
    );
  }

  async update(
    id: string,
    updatePerpDto: UpdatePerpDto,
  ): Promise<PerpDocument> {
    const perp = await this.perpRepository.updateById(id, updatePerpDto);
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
