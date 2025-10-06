/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HyperliquidWebSocketService } from './HyperliquidWebSocket.service';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';

// Mock WebSocket
const mockWebSocketInstance = {
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
};

jest.mock('ws', () => {
  const MockWebSocket: any = jest.fn(() => mockWebSocketInstance);
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSED = 3;
  MockWebSocket.CONNECTING = 0;
  return MockWebSocket;
});

// Get the mocked WebSocket constructor
import * as WebSocket from 'ws';
const MockWebSocket = WebSocket as any;

// WebSocket state constants
const WS_OPEN = 1;
const WS_CLOSED = 3;
const WS_CONNECTING = 0;

describe('HyperliquidWebSocketService', () => {
  let service: HyperliquidWebSocketService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSignatureAdapter: jest.Mocked<HyperliquidSignatureAdapter>;

  const mockWsUrl = 'wss://api.hyperliquid-testnet.xyz/ws';
  const mockUserAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Reset mock instance
    mockWebSocketInstance.on = jest.fn();
    mockWebSocketInstance.send = jest.fn();
    mockWebSocketInstance.close = jest.fn();
    mockWebSocketInstance.readyState = WS_OPEN;

    mockConfigService = {
      get: jest.fn().mockReturnValue(mockWsUrl),
    } as unknown as jest.Mocked<ConfigService>;

    mockSignatureAdapter = {
      getPublicAddress: jest.fn().mockReturnValue(mockUserAddress),
    } as unknown as jest.Mocked<HyperliquidSignatureAdapter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperliquidWebSocketService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HyperliquidSignatureAdapter,
          useValue: mockSignatureAdapter,
        },
      ],
    }).compile();

    service = module.get<HyperliquidWebSocketService>(
      HyperliquidWebSocketService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('hyperliquid.wsUrl');
      expect(service).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to WebSocket and subscribe to channels', async () => {
      await service.connect();

      expect(MockWebSocket).toHaveBeenCalledWith(mockWsUrl);
      expect(mockWebSocketInstance.on).toHaveBeenCalledWith(
        'open',
        expect.any(Function),
      );
      expect(mockWebSocketInstance.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
      expect(mockWebSocketInstance.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockWebSocketInstance.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );

      // Simulate WebSocket open event
      const openHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'open',
      )?.[1] as Function;
      openHandler();

      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'userFills',
            user: mockUserAddress,
          },
        }),
      );

      expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
        JSON.stringify({
          method: 'subscribe',
          subscription: {
            type: 'orderUpdates',
            user: mockUserAddress,
          },
        }),
      );
    });

    it('should not connect if already connecting', async () => {
      // Start first connection
      const firstConnect = service.connect();

      // Try to connect again while connecting
      await service.connect();

      await firstConnect;

      // WebSocket should only be created once
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should not connect if already connected', async () => {
      await service.connect();

      // Simulate open event
      const openHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'open',
      )?.[1] as Function;
      openHandler();

      jest.clearAllMocks();

      // Try to connect again
      await service.connect();

      // Should not create new WebSocket
      expect(MockWebSocket).not.toHaveBeenCalled();
    });

    it('should throw error if no user address is available', async () => {
      mockSignatureAdapter.getPublicAddress.mockReturnValue(null);

      await expect(service.connect()).rejects.toThrow(
        'No wallet address available for WebSocket connection',
      );
    });

    it('should schedule reconnect on connection error', async () => {
      const error = new Error('Connection failed');
      MockWebSocket.mockImplementationOnce(() => {
        throw error;
      });

      await service.connect();

      // Fast-forward time to trigger reconnect
      jest.advanceTimersByTime(5000);

      // Should attempt to reconnect
      expect(MockWebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebSocket event handlers', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should handle open event', () => {
      const openHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'open',
      )?.[1] as Function;

      openHandler();

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(2); // userFills + orderUpdates
    });

    it('should handle message event with userFills', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const fillCallback = jest.fn();
      service.onOrderFill(fillCallback);

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: false,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(fillCallback).toHaveBeenCalledWith({
        orderId: '123',
        coin: 'BTC',
        side: 'buy',
        size: '0.1',
        price: '50000',
        fee: '5',
        timestamp: 1234567890,
        closedPnl: '100',
      });
    });

    it('should handle message event with orderUpdates', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const orderCallback = jest.fn();
      service.onOrderUpdate(orderCallback);

      const message = {
        channel: 'orderUpdates',
        data: {
          orders: [
            {
              coin: 'ETH',
              side: 'sell',
              limitPx: '3000',
              sz: '1.0',
              oid: 456,
              timestamp: 1234567890,
              origSz: '1.0',
              cloid: 'client-123',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(orderCallback).toHaveBeenCalledWith({
        orderId: '456',
        coin: 'ETH',
        side: 'sell',
        limitPrice: '3000',
        size: '1.0',
        timestamp: 1234567890,
        originalSize: '1.0',
        clientOrderId: 'client-123',
      });
    });

    it('should ignore snapshot messages for userFills', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const fillCallback = jest.fn();
      service.onOrderFill(fillCallback);

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: true,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(fillCallback).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON message gracefully', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      messageHandler(Buffer.from('invalid json'));

      // Should not throw error
    });

    it('should ignore messages without channel or data', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const fillCallback = jest.fn();
      service.onOrderFill(fillCallback);

      messageHandler(Buffer.from(JSON.stringify({ channel: 'userFills' })));
      messageHandler(Buffer.from(JSON.stringify({ data: {} })));

      expect(fillCallback).not.toHaveBeenCalled();
    });

    it('should handle unknown channel gracefully', () => {
      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const message = {
        channel: 'unknownChannel',
        data: {},
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      // Should not throw error
    });

    it('should handle error event', () => {
      const errorHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'error',
      )?.[1] as Function;

      const error = new Error('WebSocket error');
      errorHandler(error);

      // Should not throw
    });

    it('should handle close event and schedule reconnect', async () => {
      const closeHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1] as Function;

      // Spy on connect method
      const connectSpy = jest.spyOn(service, 'connect');

      closeHandler();

      // Verify reconnect was scheduled
      expect(jest.getTimerCount()).toBe(1);

      // Fast-forward time to trigger reconnect
      await jest.advanceTimersByTimeAsync(5000);

      // Should attempt to reconnect
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('subscribeToUserFills', () => {
    it('should not subscribe if WebSocket is not open', async () => {
      mockWebSocketInstance.readyState = WS_CONNECTING;

      await service.connect();

      const openHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'open',
      )?.[1] as Function;

      mockWebSocketInstance.readyState = WS_CLOSED;

      // Clear previous calls
      jest.clearAllMocks();

      openHandler();

      // Should not send subscription
      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket and clear reconnect timeout', async () => {
      await service.connect();

      service.disconnect();

      expect(mockWebSocketInstance.close).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('should clear reconnect timeout on disconnect', async () => {
      await service.connect();

      // Simulate close event to trigger reconnect schedule
      const closeHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1] as Function;
      closeHandler();

      // Disconnect before reconnect timeout fires
      service.disconnect();

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      // Should not attempt reconnect after disconnect
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('isConnected', () => {
    it('should return true when WebSocket is open', async () => {
      await service.connect();
      mockWebSocketInstance.readyState = WS_OPEN;

      expect(service.isConnected()).toBe(true);
    });

    it('should return false when WebSocket is closed', async () => {
      await service.connect();
      mockWebSocketInstance.readyState = WS_CLOSED;

      expect(service.isConnected()).toBe(false);
    });

    it('should return false when WebSocket is null', () => {
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('callback management', () => {
    it('should register and call fill callbacks', async () => {
      await service.connect();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.onOrderFill(callback1);
      service.onOrderFill(callback2);

      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: false,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should remove fill callback', async () => {
      await service.connect();

      const callback = jest.fn();
      service.onOrderFill(callback);
      service.removeOrderFillCallback(callback);

      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: false,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      await service.connect();

      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const validCallback = jest.fn();

      service.onOrderFill(errorCallback);
      service.onOrderFill(validCallback);

      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1] as Function;

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: false,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      // Both callbacks should be called despite error in first one
      expect(errorCallback).toHaveBeenCalled();
      expect(validCallback).toHaveBeenCalled();
    });
  });

  describe('reconnect logic', () => {
    it('should not schedule multiple reconnects', async () => {
      await service.connect();

      const closeHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1] as Function;

      // Trigger close multiple times
      closeHandler();
      closeHandler();

      // Should only have one timer scheduled
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('multiple fills handling', () => {
    it('should handle multiple fills in a single message', async () => {
      await service.connect();

      const callback = jest.fn();
      service.onOrderFill(callback);

      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1];

      if (!messageHandler) {
        throw new Error('Message handler not found');
      }

      const message = {
        channel: 'userFills',
        data: {
          isSnapshot: false,
          fills: [
            {
              coin: 'BTC',
              side: 'buy',
              sz: '0.1',
              px: '50000',
              fee: '5',
              oid: 123,
              time: 1234567890,
              closedPnl: '100',
            },
            {
              coin: 'ETH',
              side: 'sell',
              sz: '1.0',
              px: '3000',
              fee: '3',
              oid: 124,
              time: 1234567891,
              closedPnl: '50',
            },
          ],
        },
      };

      messageHandler(Buffer.from(JSON.stringify(message)));

      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscription response handling', () => {
    it('should handle subscription response messages', async () => {
      await service.connect();

      const messageHandler = mockWebSocketInstance.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1];

      if (!messageHandler) {
        throw new Error('Message handler not found');
      }

      const message = {
        channel: 'subscriptionResponse',
        data: {
          method: 'subscribe',
          subscription: {
            type: 'userFills',
            user: mockUserAddress,
          },
        },
      };

      // Should not throw error
      messageHandler(Buffer.from(JSON.stringify(message)));
    });
  });
});
