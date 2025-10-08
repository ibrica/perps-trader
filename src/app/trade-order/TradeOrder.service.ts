import { Injectable, Logger } from '@nestjs/common';
import { TradeOrderDocument } from './TradeOrder.schema';
import {
  CreateTradeOrderOptions,
  UpdateTradeOrderOptions,
  TradePositionStatus,
  TradeOrderStatus,
} from '../../shared';
import { TradeOrderRepository } from './TradeOrder.repository';
import { OrderFill, OrderUpdate } from '../../infrastructure/websocket';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { RepositoryQueryOptions } from '../../shared/repository/RepositoryQueryOptions';

@Injectable()
export class TradeOrderService {
  private readonly logger = new Logger(TradeOrderService.name);

  constructor(
    private readonly tradeOrderRepository: TradeOrderRepository,
    private readonly tradePositionService: TradePositionService,
  ) {}

  /**
   * Get multiple trade orders by filter
   */
  async getMany(
    filter: Record<string, unknown>,
  ): Promise<TradeOrderDocument[]> {
    return this.tradeOrderRepository.getMany({ filter });
  }

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

  async getByOrderId(
    orderId: string,
    options?: Partial<RepositoryQueryOptions<TradeOrderDocument>>,
  ): Promise<TradeOrderDocument | null> {
    return this.tradeOrderRepository.getOne({
      filter: { orderId },
      ...options,
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
      const fillSize = parseFloat(fill.size);
      const existingOrder = await this.getByOrderId(fill.orderId);

      // Calculate filled size and remaining size
      const previousFilledSize = existingOrder?.filledSize || 0;
      const newFilledSize = previousFilledSize + fillSize;
      const requestedSize = existingOrder?.size || newFilledSize;
      const newRemainingSize = Math.max(0, requestedSize - newFilledSize);

      const updateData: UpdateTradeOrderOptions = {
        status:
          newRemainingSize === 0
            ? TradeOrderStatus.FILLED
            : TradeOrderStatus.PARTIALLY_FILLED,
        coin: fill.coin,
        side: fill.side,
        filledSize: newFilledSize,
        remainingSize: newRemainingSize,
        size: requestedSize,
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee),
        timestampFill: fill.timestamp,
        closedPnl: fill.closedPnl ? parseFloat(fill.closedPnl) : undefined,
      };

      const updated = await this.updateByOrderId(fill.orderId, updateData);

      if (updated) {
        this.logger.log(
          `Updated order ${fill.orderId} with fill data (filled: ${newFilledSize}, remaining: ${newRemainingSize})`,
        );

        // Update position status based on fill
        await this.updatePositionStatusOnFill(updated, fill);
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
   * Update position status based on order fill
   * Handles both entry and exit fills, including partial fills
   * - Entry fills: Accumulate filled size and update entry price
   * - Exit fills: Accumulate realized PnL and check if position is fully closed
   */
  private async updatePositionStatusOnFill(
    order: TradeOrderDocument,
    fill: OrderFill,
  ): Promise<void> {
    try {
      const positionId =
        typeof order.position === 'string'
          ? order.position
          : String(order.position._id);

      const position =
        await this.tradePositionService.getTradePositionById(positionId);
      if (!position) {
        this.logger.error(`Position ${positionId} not found`);
        return;
      }

      const fillSize = parseFloat(fill.size);
      const fillPrice = parseFloat(fill.price);
      const closedPnl = fill.closedPnl ? parseFloat(fill.closedPnl) : 0;

      // Record the fill in position history
      const fillRecord = {
        orderId: fill.orderId,
        size: fillSize,
        price: fillPrice,
        closedPnl: closedPnl !== 0 ? closedPnl : undefined,
        timestamp: fill.timestamp,
        side: fill.side,
      };

      const updatedFills = [...(position.fills || []), fillRecord];

      // Determine if this is an entry or exit fill based on:
      // 1. closedPnl presence (most reliable for exits)
      // 2. Fill side vs position direction
      const isExitFill = closedPnl !== 0;

      if (isExitFill) {
        // This is an exit/reduce order
        const newTotalRealizedPnl =
          (position.totalRealizedPnl || 0) + closedPnl;
        const newRemainingSize = Math.max(
          0,
          (position.remainingSize || position.totalFilledSize || 0) - fillSize,
        );

        this.logger.log(
          `Order ${fill.orderId} is an exit fill (closedPnl: ${closedPnl}, remaining: ${newRemainingSize})`,
        );

        // Only close position when remaining size reaches zero
        if (newRemainingSize === 0) {
          await this.tradePositionService.updateTradePosition(positionId, {
            status: TradePositionStatus.CLOSED,
            timeClosed: new Date(),
            realizedPnl: newTotalRealizedPnl,
            totalRealizedPnl: newTotalRealizedPnl,
            remainingSize: 0,
            currentPrice: fillPrice,
            fills: updatedFills,
          });
          this.logger.log(`Position ${positionId} fully closed`);
        } else {
          // Partial exit
          await this.tradePositionService.updateTradePosition(positionId, {
            totalRealizedPnl: newTotalRealizedPnl,
            remainingSize: newRemainingSize,
            currentPrice: fillPrice,
            fills: updatedFills,
          });
          this.logger.log(
            `Position ${positionId} partially closed (remaining: ${newRemainingSize})`,
          );
        }
      } else {
        // This is an entry order
        const newTotalFilledSize = (position.totalFilledSize || 0) + fillSize;
        const newRemainingSize = newTotalFilledSize; // For entry, remaining = total filled

        // Calculate weighted average entry price
        const previousTotal =
          (position.totalFilledSize || 0) * (position.entryPrice || 0);
        const newTotal = previousTotal + fillSize * fillPrice;
        const newEntryPrice =
          newTotalFilledSize > 0 ? newTotal / newTotalFilledSize : fillPrice;

        this.logger.log(
          `Order ${fill.orderId} is an entry fill (filled: ${newTotalFilledSize}, entry price: ${newEntryPrice})`,
        );

        await this.tradePositionService.updateTradePosition(positionId, {
          status: TradePositionStatus.OPEN,
          timeOpened: position.timeOpened || new Date(),
          entryPrice: newEntryPrice,
          currentPrice: fillPrice,
          totalFilledSize: newTotalFilledSize,
          remainingSize: newRemainingSize,
          fills: updatedFills,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update position status on fill', error);
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
