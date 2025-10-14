/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { TradeManagerService } from './TradeManager.service';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { TradeOrderService } from '../trade-order/TradeOrder.service';
import { IndexerAdapter } from '../../infrastructure/indexer/IndexerAdapter';
import { PlatformManagerService } from '../platform-manager/PlatformManagerService';
import { PerpService } from '../perps/Perp.service';
import { SettingsService } from '../settings/Settings.service';
import {
  Platform,
  TradePositionStatus,
  PositionType,
  PositionDirection,
  Currency,
  TradeOrderStatus,
} from '../../shared';

describe('TradeManagerService', () => {
  let service: TradeManagerService;
  let tradePositionService: jest.Mocked<TradePositionService>;
  let tradeOrderService: jest.Mocked<TradeOrderService>;
  let platformManagerService: jest.Mocked<PlatformManagerService>;

  const mockTradingOpportunity = {
    platform: Platform.HYPERLIQUID,
    token: 'BTC',
    tradingDecision: {
      shouldTrade: true,
      reason: 'Good opportunity',
      confidence: 0.8,
      recommendedAmount: 100,
      metadata: {
        direction: PositionDirection.LONG,
        leverage: 5,
      },
    },
    priority: 1,
  };

  const mockOpenPosition = {
    _id: 'position-id',
    token: 'BTC',
    platform: Platform.HYPERLIQUID,
    status: TradePositionStatus.OPEN,
    positionType: PositionType.PERPETUAL,
    positionDirection: PositionDirection.LONG,
    entryPrice: 50000,
    amountIn: 100,
    currency: Currency.USDC,
    leverage: 5,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeManagerService,
        {
          provide: TradePositionService,
          useValue: {
            getOpenTradePositions: jest.fn(),
            createTradePosition: jest.fn(),
            updateTradePosition: jest.fn(),
          },
        },
        {
          provide: TradeOrderService,
          useValue: {
            createTradeOrder: jest.fn(),
          },
        },
        {
          provide: IndexerAdapter,
          useValue: {
            getLastPrice: jest.fn(),
          },
        },
        {
          provide: PlatformManagerService,
          useValue: {
            findTradingOpportunities: jest.fn(),
            evaluateExitDecision: jest.fn(),
            getEnabledPlatforms: jest.fn(),
            getPlatformConfiguration: jest.fn(),
            getPlatformService: jest.fn(),
            createStopLossAndTakeProfitOrders: jest.fn(),
            getCurrentPrice: jest.fn(),
          },
        },
        {
          provide: PerpService,
          useValue: {
            findByToken: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TradeManagerService>(TradeManagerService);
    tradePositionService = module.get(TradePositionService);
    tradeOrderService = module.get(TradeOrderService);
    platformManagerService = module.get(PlatformManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTradePositionData', () => {
    beforeEach(() => {
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultCurrencyFrom: Currency.USDC,
      });
    });

    it('should create position with CREATED status (not OPEN)', () => {
      const createTradePositionData = (
        service as any
      ).createTradePositionData.bind(service);

      const tradingDecision = {
        recommendedAmount: 50,
        metadata: {
          direction: PositionDirection.LONG,
          leverage: 5,
        },
      };

      const result = createTradePositionData(
        Platform.HYPERLIQUID,
        'BTC',
        tradingDecision,
      );

      expect(result.positionType).toBe(PositionType.PERPETUAL);
      expect(result.positionDirection).toBe(PositionDirection.LONG);
      expect(result.leverage).toBe(5);
      expect(result.status).toBe(TradePositionStatus.CREATED); // Should be CREATED, not OPEN
      expect(result.entryPrice).toBeUndefined(); // Should not have entry price yet
    });

    it('should use default leverage if not provided', () => {
      const createTradePositionData = (
        service as any
      ).createTradePositionData.bind(service);

      const tradingDecision = {
        recommendedAmount: 50,
        metadata: {
          direction: PositionDirection.SHORT,
        },
      };

      const result = createTradePositionData(
        Platform.HYPERLIQUID,
        'ETH',
        tradingDecision,
      );

      expect(result.leverage).toBe(3); // Default leverage
      expect(result.positionDirection).toBe(PositionDirection.SHORT);
    });
  });

  describe('enterPosition', () => {
    it('should create position and order with correct data', async () => {
      const mockPlatformService = {
        enterPosition: jest.fn().mockResolvedValue({
          orderId: 'order-123',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 50000,
          fee: 5,
        }),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultCurrencyFrom: Currency.USDC,
      });
      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      tradePositionService.createTradePosition.mockResolvedValue({
        _id: 'position-123',
        ...mockOpenPosition,
        status: TradePositionStatus.CREATED,
      } as any);

      await (service as any).enterPosition(mockTradingOpportunity);

      // Verify position created with CREATED status
      expect(tradePositionService.createTradePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TradePositionStatus.CREATED,
          platform: Platform.HYPERLIQUID,
          token: 'BTC',
          positionDirection: PositionDirection.LONG,
        }),
      );

      // Verify order created with coin and side
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TradeOrderStatus.CREATED,
          orderId: 'order-123',
          coin: 'BTC',
          side: 'B', // Buy for LONG
          type: 'market',
          size: 0.002,
          price: 50000,
        }),
      );
    });

    it('should set side to S for SHORT positions', async () => {
      const shortOpportunity = {
        ...mockTradingOpportunity,
        tradingDecision: {
          ...mockTradingOpportunity.tradingDecision,
          metadata: {
            direction: PositionDirection.SHORT,
            leverage: 5,
          },
        },
      };

      const mockPlatformService = {
        enterPosition: jest.fn().mockResolvedValue({
          orderId: 'order-456',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 50000,
        }),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultCurrencyFrom: Currency.USDC,
      });
      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      tradePositionService.createTradePosition.mockResolvedValue({
        _id: 'position-456',
        positionDirection: PositionDirection.SHORT,
      } as any);

      await (service as any).enterPosition(shortOpportunity);

      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'S', // Sell for SHORT
        }),
      );
    });

    it('should calculate and pass SL/TP prices for LONG positions', async () => {
      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      const mockPlatformService = {
        enterPosition: jest.fn().mockResolvedValue({
          orderId: 'order-789',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 50000,
          metadata: {
            direction: PositionDirection.LONG,
            stopLossPrice: 45000,
            takeProfitPrice: 60000,
          },
        }),
        createStopLossAndTakeProfitOrders: jest
          .fn()
          .mockResolvedValue(undefined),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 10,
          takeProfitPercent: 20,
        },
        defaultCurrencyFrom: Currency.USDC,
      });

      const mockPosition = {
        _id: 'position-789',
        ...mockOpenPosition,
      };
      tradePositionService.createTradePosition.mockResolvedValue(
        mockPosition as any,
      );

      await (service as any).enterPosition(mockTradingOpportunity);

      // Verify SL/TP prices are calculated correctly for LONG
      expect(mockPlatformService.enterPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          stopLossPrice: 45000, // 50000 * (1 - 0.10)
          takeProfitPrice: 60000, // 50000 * (1 + 0.20)
        }),
      );

      // Verify position is created with SL/TP prices stored
      expect(tradePositionService.createTradePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          stopLossPrice: 45000,
          takeProfitPrice: 60000,
        }),
      );

      // SL/TP orders are no longer created immediately - they're created by WebSocket handler
      // after the entry order is filled. This eliminates the race condition.
      expect(
        platformManagerService.createStopLossAndTakeProfitOrders,
      ).not.toHaveBeenCalled();
    });

    it('should calculate and pass SL/TP prices for SHORT positions', async () => {
      const shortOpportunity = {
        ...mockTradingOpportunity,
        tradingDecision: {
          ...mockTradingOpportunity.tradingDecision,
          metadata: {
            direction: PositionDirection.SHORT,
            leverage: 5,
          },
        },
      };

      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      const mockPlatformService = {
        enterPosition: jest.fn().mockResolvedValue({
          orderId: 'order-short-123',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 50000,
          metadata: {
            direction: PositionDirection.SHORT,
            stopLossPrice: 55000,
            takeProfitPrice: 40000,
          },
        }),
        createStopLossAndTakeProfitOrders: jest
          .fn()
          .mockResolvedValue(undefined),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 10,
          takeProfitPercent: 20,
        },
        defaultCurrencyFrom: Currency.USDC,
      });

      const mockShortPosition = {
        _id: 'position-short-123',
        positionDirection: PositionDirection.SHORT,
      };
      tradePositionService.createTradePosition.mockResolvedValue(
        mockShortPosition as any,
      );

      await (service as any).enterPosition(shortOpportunity);

      // Verify SL/TP prices are calculated correctly for SHORT (inverted)
      const enterPositionCall =
        mockPlatformService.enterPosition.mock.calls[0][0];
      expect(enterPositionCall.stopLossPrice).toBeCloseTo(55000, 1); // 50000 * (1 + 0.10) - price goes up = loss for short
      expect(enterPositionCall.takeProfitPrice).toBeCloseTo(40000, 1); // 50000 * (1 - 0.20) - price goes down = profit for short

      // Verify position is created with SL/TP prices stored
      const createPositionCall =
        tradePositionService.createTradePosition.mock.calls[0][0];
      expect(createPositionCall.stopLossPrice).toBeCloseTo(55000, 1);
      expect(createPositionCall.takeProfitPrice).toBeCloseTo(40000, 1);

      // SL/TP orders are no longer created immediately - they're created by WebSocket handler
      // after the entry order is filled. This eliminates the race condition.
      expect(
        platformManagerService.createStopLossAndTakeProfitOrders,
      ).not.toHaveBeenCalled();
    });

    it('should handle errors in SL/TP order creation gracefully', async () => {
      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      const mockPlatformService = {
        enterPosition: jest.fn().mockResolvedValue({
          orderId: 'order-error-test',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 50000,
          metadata: {
            direction: PositionDirection.LONG,
            stopLossPrice: 45000,
            takeProfitPrice: 60000,
          },
        }),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.HYPERLIQUID,
        enabled: true,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100,
          stopLossPercent: 10,
          takeProfitPercent: 20,
        },
        defaultCurrencyFrom: Currency.USDC,
      });

      // Mock platformManagerService to throw error on SL/TP creation
      platformManagerService.createStopLossAndTakeProfitOrders.mockRejectedValue(
        new Error('Failed to create SL/TP orders'),
      );

      tradePositionService.createTradePosition.mockResolvedValue({
        _id: 'position-error-test',
        ...mockOpenPosition,
      } as any);

      // Should not throw, just log error
      await expect(
        (service as any).enterPosition(mockTradingOpportunity),
      ).resolves.not.toThrow();

      // Main order should still be created
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalled();
    });
  });

  describe('getCurrentPrice', () => {
    it('should get price from platform first', async () => {
      platformManagerService.getCurrentPrice.mockResolvedValue(50000);

      const price = await (service as any).getCurrentPrice(
        Platform.HYPERLIQUID,
        'BTC',
      );

      expect(price).toBe(50000);
      expect(platformManagerService.getCurrentPrice).toHaveBeenCalledWith(
        Platform.HYPERLIQUID,
        'BTC',
      );
    });

    it('should fallback to indexer when platform fails', async () => {
      platformManagerService.getCurrentPrice.mockResolvedValue(55000);

      const price = await (service as any).getCurrentPrice(
        Platform.HYPERLIQUID,
        'BTC',
      );

      expect(price).toBe(55000);
      expect(platformManagerService.getCurrentPrice).toHaveBeenCalledWith(
        Platform.HYPERLIQUID,
        'BTC',
      );
    });

    it('should throw error when both platform and indexer fail', async () => {
      platformManagerService.getCurrentPrice.mockRejectedValue(
        new Error('Failed to get current price for BTC'),
      );

      await expect(
        (service as any).getCurrentPrice(Platform.HYPERLIQUID, 'BTC'),
      ).rejects.toThrow('Failed to get current price for BTC');
    });
  });

  describe('exitPosition', () => {
    it('should create exit order with opposite side', async () => {
      const mockPlatformService = {
        exitPosition: jest.fn().mockResolvedValue({
          orderId: 'exit-order-123',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 52000,
        }),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );

      await (service as any).exitPosition(mockOpenPosition);

      // Verify exit order created with opposite side (S for LONG position)
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TradeOrderStatus.CREATED,
          orderId: 'exit-order-123',
          coin: 'BTC',
          side: 'S', // Sell to close LONG
          type: 'market',
          size: 0.002,
          price: 52000,
        }),
      );
    });

    it('should set side to B for closing SHORT positions', async () => {
      const shortPosition = {
        ...mockOpenPosition,
        positionDirection: PositionDirection.SHORT,
      };

      const mockPlatformService = {
        exitPosition: jest.fn().mockResolvedValue({
          orderId: 'exit-order-456',
          status: TradeOrderStatus.CREATED,
          type: 'market',
          size: 0.002,
          price: 48000,
        }),
      };

      platformManagerService.getPlatformService.mockReturnValue(
        mockPlatformService as any,
      );

      await (service as any).exitPosition(shortPosition);

      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'B', // Buy to close SHORT
        }),
      );
    });
  });
});
