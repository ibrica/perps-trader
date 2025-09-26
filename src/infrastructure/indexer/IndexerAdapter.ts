import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import {
  WebSocketMessage,
  SubscriptionMessage,
  TradeNotification,
  SubscriptionResponse,
  ErrorResponse,
} from '../../shared';
import { SUBSCRIPTION_EVENTS, INDEXER_EVENTS } from '../../app/events/types';
import { IndexerClient } from './IndexerClient';
import { LastPriceResponse } from './types';

export class IndexerAdapter {
  private readonly logger = new Logger(IndexerAdapter.name);

  private readonly url: string;

  private readonly eventEmitter: EventEmitter2;

  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions = new Set<string>();
  private client: IndexerClient;

  constructor(
    host: string = 'localhost',
    wsPort: number = 7070,
    apiPort: number = 7071,
    eventEmitter: EventEmitter2,
  ) {
    this.url = `ws://${host}:${wsPort}/ws`;
    this.eventEmitter = eventEmitter;
    this.client = new IndexerClient({
      baseUrl: `http://${host}:${apiPort}`,
    });
  }
  /**
   * Connect to the SOL Indexer WebSocket server
   */
  async connect(): Promise<void> {
    // If already connected, return immediately
    if (this.isConnected()) {
      this.logger.debug('Already connected to SOL Indexer WebSocket');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.logger.log(
            `✅ Connected to SOL Indexer WebSocket, URL: ${this.url}`,
          );
          this.reconnectAttempts = 0;
          this.eventEmitter.emit(INDEXER_EVENTS.CONNECTED);
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.logger.error('Failed to parse WebSocket message:', error);
            this.eventEmitter.emit(
              INDEXER_EVENTS.ERROR,
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.logger.log(
            `WebSocket connection closed: ${code} ${reason.toString()}`,
          );
          this.eventEmitter.emit(
            INDEXER_EVENTS.DISCONNECTED,
            code,
            reason.toString(),
          );
          this.attemptReconnect();
        });

        this.ws.on('error', (error: Error) => {
          this.logger.error('WebSocket error:', error);
          this.eventEmitter.emit(INDEXER_EVENTS.ERROR, error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to trade events for a specific token
   */
  async subscribe(tokenMint: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message: SubscriptionMessage = {
      action: 'subscribe',
      tokenMint,
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.add(tokenMint);
    this.logger.log(`📡 Subscribed to token: ${tokenMint}`);
  }

  /**
   * Unsubscribe from trade events for a specific token
   */
  async unsubscribe(tokenMint: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message: SubscriptionMessage = {
      action: 'unsubscribe',
      tokenMint,
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptions.delete(tokenMint);
    this.logger.log(`📡 Unsubscribed from token: ${tokenMint}`);
  }

  async getLastPrice(tokenMint: string): Promise<LastPriceResponse> {
    return this.client.getLastPrice(tokenMint);
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  async unsubscribeFromAll(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const activeSubscriptions = Array.from(this.subscriptions);

    if (activeSubscriptions.length === 0) {
      this.logger.log('📡 No active subscriptions to unsubscribe from');
      return;
    }

    this.logger.log(
      `📡 Unsubscribing from all ${activeSubscriptions.length} active subscriptions`,
    );

    // Unsubscribe from each active subscription
    for (const tokenMint of activeSubscriptions) {
      try {
        const message: SubscriptionMessage = {
          action: 'unsubscribe',
          tokenMint,
        };

        this.ws.send(JSON.stringify(message));
        this.subscriptions.delete(tokenMint);
        this.logger.log(`📡 Unsubscribed from token: ${tokenMint}`);
      } catch (error) {
        this.logger.error(
          `Failed to unsubscribe from token ${tokenMint}:`,
          error,
        );
      }
    }

    this.logger.log('📡 Successfully unsubscribed from all tokens');
  }

  /**
   * Get the list of current subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Check if connected to the WebSocket server
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'trade':
        this.handleTradeNotification(message as TradeNotification);
        break;
      case 'success':
        this.handleSuccessResponse(message as SubscriptionResponse);
        break;
      case 'error':
        this.handleErrorResponse(message as ErrorResponse);
        break;
      default:
        this.logger.log('Unknown message type:', message);
    }
  }

  private handleTradeNotification(notification: TradeNotification): void {
    const { trade, tokenMint, timestamp } = notification;

    this.logger.log(`Trade for ${tokenMint}: ${JSON.stringify(trade)}`);

    this.eventEmitter.emit(SUBSCRIPTION_EVENTS.TRADE_INDEXER, {
      tokenMint,
      trade,
      timestamp: new Date(timestamp),
    });
  }

  private handleSuccessResponse(response: SubscriptionResponse): void {
    this.logger.log(`✅ ${response.message}`);
    this.eventEmitter.emit(INDEXER_EVENTS.SUCCESS, response);
  }

  private handleErrorResponse(error: ErrorResponse): void {
    this.logger.error(`❌ Error: ${error.message} (${error.code})`);
    this.eventEmitter.emit(
      INDEXER_EVENTS.ERROR,
      new Error(`${error.code}: ${error.message}`),
    );
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.log(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe to all previous subscriptions
        for (const tokenMint of this.subscriptions) {
          await this.subscribe(tokenMint);
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }, delay);
  }
}
