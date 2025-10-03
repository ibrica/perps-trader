import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OrderFill, OrderUpdate } from './types';

export type OrderFillCallback = (fill: OrderFill) => void | Promise<void>;
export type OrderUpdateCallback = (order: OrderUpdate) => void | Promise<void>;

export abstract class PlatformWebSocketService
  implements OnModuleInit, OnModuleDestroy
{
  protected abstract readonly logger: Logger;
  protected fillCallbacks: Set<OrderFillCallback> = new Set();
  protected orderUpdateCallbacks: Set<OrderUpdateCallback> = new Set();

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  onModuleDestroy(): void {
    this.disconnect();
  }

  /**
   * Connect to the platform WebSocket
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the platform WebSocket
   */
  abstract disconnect(): void;

  /**
   * Check if WebSocket is connected
   */
  abstract isConnected(): boolean;

  /**
   * Subscribe to user order fills
   */
  protected abstract subscribeToUserFills(): void;

  /**
   * Subscribe to user order updates
   */
  protected abstract subscribeToOrderUpdates(): void;

  /**
   * Register a callback for order fills
   */
  onOrderFill(callback: OrderFillCallback): void {
    this.fillCallbacks.add(callback);
  }

  /**
   * Register a callback for order updates
   */
  onOrderUpdate(callback: OrderUpdateCallback): void {
    this.orderUpdateCallbacks.add(callback);
  }

  /**
   * Remove an order fill callback
   */
  removeOrderFillCallback(callback: OrderFillCallback): void {
    this.fillCallbacks.delete(callback);
  }

  /**
   * Remove an order update callback
   */
  removeOrderUpdateCallback(callback: OrderUpdateCallback): void {
    this.orderUpdateCallbacks.delete(callback);
  }

  /**
   * Notify all registered fill callbacks
   */
  protected notifyFillCallbacks(fill: OrderFill): void {
    for (const callback of this.fillCallbacks) {
      try {
        callback(fill);
      } catch (error) {
        this.logger.error('Error in fill callback', error);
      }
    }
  }

  /**
   * Notify all registered order update callbacks
   */
  protected notifyOrderUpdateCallbacks(order: OrderUpdate): void {
    for (const callback of this.orderUpdateCallbacks) {
      try {
        callback(order);
      } catch (error) {
        this.logger.error('Error in order update callback', error);
      }
    }
  }
}
