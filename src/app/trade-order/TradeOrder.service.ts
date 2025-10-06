import { Injectable, Logger } from '@nestjs/common';
import { TradeOrderDocument } from './TradeOrder.schema';
import { CreateTradeOrderOptions, UpdateTradeOrderOptions } from '../../shared';
import { TradeOrderRepository } from './TradeOrder.repository';
import { OrderFill, OrderUpdate } from '../../infrastructure/websocket';

@Injectable()
export class TradeOrderService {
  private readonly logger = new Logger(TradeOrderService.name);

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

  /**
   * Handle order fill event from WebSocket and update database
   */
  async handleOrderFill(fill: OrderFill): Promise<void> {
    try {
      const updateData: UpdateTradeOrderOptions = {
        coin: fill.coin,
        side: fill.side,
        size: parseFloat(fill.size),
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee),
        timestampFill: fill.timestamp,
        closedPnl: fill.closedPnl ? parseFloat(fill.closedPnl) : undefined,
      };

      const updated = await this.updateByOrderId(fill.orderId, updateData);

      if (updated) {
        this.logger.log(`Updated order ${fill.orderId} with fill data`);
      } else {
        this.logger.warn(`Order ${fill.orderId} not found for fill update`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle order fill for ${fill.orderId}`,
        error,
      );
    }
  }

  /**
   * Handle order update event from WebSocket and update database
   */
  async handleOrderUpdate(order: OrderUpdate): Promise<void> {
    try {
      const updateData: UpdateTradeOrderOptions = {
        coin: order.coin,
        side: order.side,
        limitPrice: parseFloat(order.limitPrice),
        size: parseFloat(order.size),
        timestampUpdate: order.timestamp,
        originalSize: parseFloat(order.originalSize),
        clientOrderId: order.clientOrderId,
      };

      const updated = await this.updateByOrderId(order.orderId, updateData);

      if (updated) {
        this.logger.debug(
          `Updated order ${order.orderId} with order update data`,
        );
      } else {
        this.logger.warn(`Order ${order.orderId} not found for order update`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle order update for ${order.orderId}`,
        error,
      );
    }
  }
}
