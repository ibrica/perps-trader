import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';
import { PlatformWebSocketService, OrderFill, OrderUpdate } from '../websocket';
import { WsUserFillsMessage, WsOrderUpdatesMessage } from '../../shared';

@Injectable()
export class HyperliquidWebSocketService extends PlatformWebSocketService {
  protected readonly logger = new Logger(HyperliquidWebSocketService.name);
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly wsUrl: string;
  private readonly reconnectDelay = 5000;
  private isConnecting = false;
  private userAddress: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly signatureAdapter: HyperliquidSignatureAdapter,
  ) {
    super();
    const isTestnet = this.configService.get<boolean>(
      'hyperliquid.testnet',
      false,
    );
    this.wsUrl = isTestnet
      ? 'wss://api.hyperliquid-testnet.xyz/ws'
      : 'wss://api.hyperliquid.xyz/ws';
  }

  async connect(): Promise<void> {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;
    this.userAddress = this.signatureAdapter.getPublicAddress();

    if (!this.userAddress) {
      throw new Error('No wallet address available for WebSocket connection');
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.logger.log('WebSocket connected to Hyperliquid');
        this.isConnecting = false;
        this.subscribeToUserFills();
        this.subscribeToOrderUpdates();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse WebSocket message', error);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error', error);
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        this.logger.warn('WebSocket closed, will attempt to reconnect');
        this.isConnecting = false;
        this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.error('Failed to connect WebSocket', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  protected subscribeToUserFills(): void {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.userAddress
    ) {
      return;
    }

    const subscription = {
      method: 'subscribe',
      subscription: {
        type: 'userFills',
        user: this.userAddress,
      },
    };

    this.ws.send(JSON.stringify(subscription));
    this.logger.log(`Subscribed to user fills for ${this.userAddress}`);
  }

  protected subscribeToOrderUpdates(): void {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.userAddress
    ) {
      return;
    }

    const subscription = {
      method: 'subscribe',
      subscription: {
        type: 'orderUpdates',
        user: this.userAddress,
      },
    };

    this.ws.send(JSON.stringify(subscription));
    this.logger.log(`Subscribed to order updates for ${this.userAddress}`);
  }

  private handleMessage(message: any): void {
    if (!message.channel || !message.data) {
      return;
    }

    switch (message.channel) {
      case 'userFills':
        this.handleUserFills(message as WsUserFillsMessage);
        break;
      case 'orderUpdates':
        this.handleOrderUpdates(message as WsOrderUpdatesMessage);
        break;
      default:
        this.logger.debug(`Unhandled message channel: ${message.channel}`);
    }
  }

  private handleUserFills(message: WsUserFillsMessage): void {
    const { isSnapshot, fills } = message.data;

    if (isSnapshot) {
      this.logger.debug(`Received fills snapshot with ${fills.length} fills`);
      return;
    }

    for (const fill of fills) {
      this.logger.log(
        `Order filled: ${fill.coin} ${fill.side} ${fill.sz} @ ${fill.px} (oid: ${fill.oid})`,
      );

      // Convert to platform-agnostic OrderFill format
      const orderFill: OrderFill = {
        orderId: String(fill.oid),
        coin: fill.coin,
        side: fill.side,
        size: fill.sz,
        price: fill.px,
        fee: fill.fee,
        timestamp: fill.time,
        closedPnl: fill.closedPnl,
      };

      // Notify callbacks using base class method
      this.notifyFillCallbacks(orderFill);
    }
  }

  private handleOrderUpdates(message: WsOrderUpdatesMessage): void {
    const { orders } = message.data;

    for (const order of orders) {
      this.logger.debug(
        `Order update: ${order.coin} ${order.side} ${order.sz} @ ${order.limitPx} (oid: ${order.oid})`,
      );

      // Convert to platform-agnostic OrderUpdate format
      const orderUpdate: OrderUpdate = {
        orderId: String(order.oid),
        coin: order.coin,
        side: order.side,
        limitPrice: order.limitPx,
        size: order.sz,
        timestamp: order.timestamp,
        originalSize: order.origSz,
        clientOrderId: order.cloid,
      };

      // Notify callbacks using base class method
      this.notifyOrderUpdateCallbacks(orderUpdate);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.logger.log('Attempting to reconnect WebSocket');
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
