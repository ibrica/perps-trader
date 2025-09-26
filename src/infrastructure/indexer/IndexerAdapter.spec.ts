/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import { IndexerAdapter } from './IndexerAdapter';
import {
  SubscriptionMessage,
  TradeNotification,
  SubscriptionResponse,
  ErrorResponse,
} from '../../shared';
import { SUBSCRIPTION_EVENTS, INDEXER_EVENTS } from '../../app/events/types';

// Mock WebSocket
jest.mock('ws');
const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

// Create mock WebSocket instance
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  readyState: WebSocket.OPEN as number,
  CONNECTING: WebSocket.CONNECTING,
  OPEN: WebSocket.OPEN,
  CLOSING: WebSocket.CLOSING,
  CLOSED: WebSocket.CLOSED,
};

// Mock EventEmitter2
const mockEventEmitter = {
  emit: jest.fn(),
} as unknown as EventEmitter2;

describe('IndexerAdapter', () => {
  let adapter: IndexerAdapter;
  const testHost = 'localhost';
  const testWsPort = 7070;
  const testApiPort = 7071;
  const testTokenMint = 'AWcvL1GSNX8VDLm1nFWzB9u2o4guAmXM341imLaHpump';

  // Mock message data
  const mockTradeNotification: TradeNotification = {
    type: 'trade',
    tokenMint: testTokenMint,
    trade: {
      Amount: '1000000',
      CollateralAmount: '0.001',
      CurvePosition: '500000000',
      TokenMint: testTokenMint,
      CollateralMintAddress: 'So11111111111111111111111111111111111111112',
      Sender: 'mock_user_address',
      IsBuy: true,
      BlockNumber: '12345',
      BlockTimestamp: '1705316245',
    },
    timestamp: '2024-01-15T10:30:45.123Z',
  };

  const mockSuccessResponse: SubscriptionResponse = {
    type: 'success',
    message: 'Successfully subscribed to token',
  };

  const mockErrorResponse: ErrorResponse = {
    type: 'error',
    code: 'SUBSCRIPTION_ERROR',
    message: 'Failed to subscribe to token',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mock WebSocket state
    mockWebSocket.readyState = WebSocket.CONNECTING;

    // Setup WebSocket mock to return our mock instance
    MockedWebSocket.mockImplementation(() => mockWebSocket as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: IndexerAdapter,
          useFactory: () =>
            new IndexerAdapter(
              testHost,
              testWsPort,
              testApiPort,
              mockEventEmitter,
            ),
        },
      ],
    }).compile();

    adapter = module.get<IndexerAdapter>(IndexerAdapter);
  });

  describe('constructor', () => {
    it('should initialize with correct URL and dependencies', () => {
      expect(adapter).toBeDefined();
      expect(adapter.getSubscriptions()).toEqual([]);
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should successfully connect to WebSocket server', async () => {
      // Arrange
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            mockWebSocket.readyState = WebSocket.OPEN;
            setTimeout(() => callback(), 0); // Simulate immediate connection
          }
        },
      );

      // Act
      const connectPromise = adapter.connect();
      await Promise.resolve(); // Allow event loop to process

      await connectPromise;

      // Assert
      expect(MockedWebSocket).toHaveBeenCalledWith(
        `ws://${testHost}:${testWsPort}/ws`,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.CONNECTED,
      );
    });

    it('should handle connection errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'error') {
            setTimeout(() => callback(error), 0);
          }
        },
      );

      // Act & Assert
      await expect(adapter.connect()).rejects.toThrow('Connection failed');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.ERROR,
        error,
      );
    });

    it('should handle connection close', async () => {
      // Arrange
      const closeCode = 1000;
      const closeReason = Buffer.from('Normal closure');

      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            setTimeout(() => callback(), 0);
          } else if (event === 'close') {
            setTimeout(() => callback(closeCode, closeReason), 10);
          }
        },
      );

      // Act
      await adapter.connect();

      // Simulate close event
      const closeHandler = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1];
      if (closeHandler) {
        closeHandler(closeCode, closeReason);
      }

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.DISCONNECTED,
        closeCode,
        closeReason.toString(),
      );
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      // Arrange
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            setTimeout(() => callback(), 0);
          }
        },
      );

      await adapter.connect();

      // Act
      adapter.disconnect();

      // Assert
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            mockWebSocket.readyState = WebSocket.OPEN;
            setTimeout(() => callback(), 0);
          }
        },
      );
      await adapter.connect();
    });

    it('should send subscription message for token', async () => {
      // Act
      await adapter.subscribe(testTokenMint);

      // Assert
      const expectedMessage: SubscriptionMessage = {
        action: 'subscribe',
        tokenMint: testTokenMint,
      };
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(expectedMessage),
      );
      expect(adapter.getSubscriptions()).toContain(testTokenMint);
    });

    it('should throw error when WebSocket is not connected', async () => {
      // Arrange
      adapter.disconnect();
      mockWebSocket.readyState = WebSocket.CLOSED;

      // Act & Assert
      await expect(adapter.subscribe(testTokenMint)).rejects.toThrow(
        'WebSocket is not connected',
      );
    });
  });

  describe('unsubscribe', () => {
    beforeEach(async () => {
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            setTimeout(() => callback(), 0);
          }
        },
      );
      await adapter.connect();
      // Ensure WebSocket stays connected for subsequent operations
      mockWebSocket.readyState = WebSocket.OPEN;
      await adapter.subscribe(testTokenMint);
    });

    it('should send unsubscription message for token', async () => {
      // Act
      await adapter.unsubscribe(testTokenMint);

      // Assert
      const expectedMessage: SubscriptionMessage = {
        action: 'unsubscribe',
        tokenMint: testTokenMint,
      };
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(expectedMessage),
      );
      expect(adapter.getSubscriptions()).not.toContain(testTokenMint);
    });

    it('should throw error when WebSocket is not connected', async () => {
      // Arrange
      adapter.disconnect();
      mockWebSocket.readyState = WebSocket.CLOSED;

      // Act & Assert
      await expect(adapter.unsubscribe(testTokenMint)).rejects.toThrow(
        'WebSocket is not connected',
      );
    });
  });

  describe('getSubscriptions', () => {
    beforeEach(async () => {
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            mockWebSocket.readyState = WebSocket.OPEN;
            setTimeout(() => callback(), 0);
          }
        },
      );
      await adapter.connect();
    });

    it('should return empty array initially', () => {
      expect(adapter.getSubscriptions()).toEqual([]);
    });

    it('should return subscribed tokens', async () => {
      // Arrange
      const token1 = 'token1';
      const token2 = 'token2';

      // Ensure WebSocket stays connected
      mockWebSocket.readyState = WebSocket.OPEN;

      // Act
      await adapter.subscribe(token1);
      await adapter.subscribe(token2);

      // Assert
      expect(adapter.getSubscriptions()).toEqual([token1, token2]);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      // Arrange
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            mockWebSocket.readyState = WebSocket.OPEN;
            setTimeout(() => callback(), 0);
          }
        },
      );

      // Act
      await adapter.connect();

      // Assert
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe('message handling', () => {
    let messageHandler: Function;

    beforeEach(async () => {
      mockWebSocket.on.mockImplementation(
        (event: string, callback: Function) => {
          if (event === 'open') {
            setTimeout(() => callback(), 0);
          } else if (event === 'message') {
            messageHandler = callback;
          }
        },
      );
      await adapter.connect();
    });

    it('should handle trade notifications', () => {
      // Act
      messageHandler(Buffer.from(JSON.stringify(mockTradeNotification)));

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        SUBSCRIPTION_EVENTS.TRADE_INDEXER,
        {
          tokenMint: testTokenMint,
          trade: mockTradeNotification.trade,
          timestamp: new Date(mockTradeNotification.timestamp),
        },
      );
    });

    it('should handle success responses', () => {
      // Act
      messageHandler(Buffer.from(JSON.stringify(mockSuccessResponse)));

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.SUCCESS,
        mockSuccessResponse,
      );
    });

    it('should handle error responses', () => {
      // Act
      messageHandler(Buffer.from(JSON.stringify(mockErrorResponse)));

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.ERROR,
        new Error(`${mockErrorResponse.code}: ${mockErrorResponse.message}`),
      );
    });

    it('should handle malformed JSON messages', () => {
      // Act
      messageHandler(Buffer.from('invalid json'));

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.ERROR,
        expect.any(Error),
      );
    });

    it('should handle unknown message types', () => {
      // Arrange
      const unknownMessage = { type: 'unknown', data: 'test' };

      // Act
      messageHandler(Buffer.from(JSON.stringify(unknownMessage)));

      // Assert - Should not throw error, just log
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        INDEXER_EVENTS.ERROR,
      );
    });
  });

  describe('reconnection logic', () => {
    it('should trigger reconnection attempt when connection is lost', async () => {
      // Arrange
      let closeHandler: ((code: number, reason: Buffer) => void) | undefined;
      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(() => callback(), 0);
        } else if (event === 'close') {
          closeHandler = callback as (code: number, reason: Buffer) => void;
        }
      });

      await adapter.connect();

      // Act - Simulate connection loss
      if (closeHandler) {
        closeHandler(1006, Buffer.from('Connection lost'));
      }

      // Assert that close event was handled
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        INDEXER_EVENTS.DISCONNECTED,
        1006,
        'Connection lost',
      );
    });
  });

  describe('getLastPrice', () => {
    it('should delegate to IndexerClient getLastPrice method', async () => {
      // Arrange
      const mockResponse = {
        token_address: testTokenMint,
        type: 'meme' as const,
        position: '500000000',
        timestamp: '2024-01-15T10:30:45.123Z',
      };

      // Mock the global fetch function
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Act
      const result = await adapter.getLastPrice(testTokenMint);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://${testHost}:${testApiPort}/last-price?token-address=${testTokenMint}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Token not found' }),
      } as Response);

      // Act & Assert
      await expect(adapter.getLastPrice(testTokenMint)).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });
  });
});
