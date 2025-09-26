import { Injectable } from '@nestjs/common';
import { TradePositionDocument } from './TradePosition.schema';
import {
  CreateTradePositionOptions,
  TradePositionStatus,
  UpdateTradePositionOptions,
} from '../../shared';
import { TradePositionRepository } from './TradePosition.repository';

@Injectable()
export class TradePositionService {
  constructor(
    private readonly tradePositionRepository: TradePositionRepository,
  ) {}

  async createTradePosition(
    createTradePositionOptions: CreateTradePositionOptions,
  ): Promise<TradePositionDocument> {
    const { amountIn, amountOut, positionSize, timeOpened, ...rest } =
      createTradePositionOptions;
    return this.tradePositionRepository.create({
      ...rest,
      amountIn: String(amountIn),
      amountOut: amountOut ? String(amountOut) : undefined,
      positionSize: positionSize ? String(positionSize) : undefined,
      timeOpened: timeOpened || new Date(),
    });
  }

  async updateTradePosition(
    id: string,
    updateTradePositionOptions: UpdateTradePositionOptions,
  ): Promise<TradePositionDocument | null> {
    const { amountIn, amountOut, positionSize, ...rest } =
      updateTradePositionOptions;
    return this.tradePositionRepository.updateById(id, {
      ...rest,
      ...(amountIn && { amountIn: String(amountIn) }),
      ...(amountOut && { amountOut: String(amountOut) }),
      ...(positionSize && { positionSize: String(positionSize) }),
    });
  }

  async getOpenTradePositions(): Promise<TradePositionDocument[]> {
    return this.tradePositionRepository.getAll({
      filter: {
        status: TradePositionStatus.OPEN,
      },
    });
  }

  async getTradePosition(
    tokenMint: string,
    currencyMint?: string,
  ): Promise<TradePositionDocument | null> {
    return this.tradePositionRepository.getOne({
      filter: {
        $or: [{ tokenMint: tokenMint }, { baseAssetSymbol: tokenMint }],
        ...(currencyMint && { currencyMint }),
      },
    });
  }

  async getTradePositionByTokenMint(
    tokenMint: string,
    status?: TradePositionStatus,
  ): Promise<TradePositionDocument | null> {
    return this.tradePositionRepository.getOne({
      filter: {
        $or: [{ tokenMint: tokenMint }, { baseAssetSymbol: tokenMint }],
        ...(status && { status }),
      },
    });
  }
}
