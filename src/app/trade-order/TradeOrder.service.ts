import { Injectable } from '@nestjs/common';
import { TradeOrderDocument } from './TradeOrder.schema';
import { CreateTradeOrderOptions, UpdateTradeOrderOptions } from '../../shared';
import { TradeOrderRepository } from './TradeOrder.repository';

@Injectable()
export class TradeOrderService {
  constructor(private readonly tradeOrderRepository: TradeOrderRepository) {}

  async createTradeOrder(
    createTradeOrderOptions: CreateTradeOrderOptions,
  ): Promise<TradeOrderDocument> {
    return this.tradeOrderRepository.create(createTradeOrderOptions);
  }

  async updateTradeOrder(
    id: string,
    updateTradeOrderOptions: UpdateTradeOrderOptions,
  ): Promise<TradeOrderDocument | null> {
    return this.tradeOrderRepository.updateById(id, updateTradeOrderOptions);
  }

  async getByOrderId(orderId: string): Promise<TradeOrderDocument | null> {
    return this.tradeOrderRepository.getOne({
      filter: { orderId },
    });
  }

  async updateByOrderId(
    orderId: string,
    updateTradeOrderOptions: UpdateTradeOrderOptions,
  ): Promise<TradeOrderDocument | null> {
    const tradeOrder = await this.getByOrderId(orderId);
    if (!tradeOrder) {
      return null;
    }
    return this.tradeOrderRepository.updateById(
      String(tradeOrder._id),
      updateTradeOrderOptions,
    );
  }
}
