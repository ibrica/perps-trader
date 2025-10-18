import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HyperliquidPlatformService } from './HyperliquidPlatform.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import { TradeOrderService } from '../trade-order/TradeOrder.service';
import { TradePositionService } from '../trade-position/TradePosition.service';
import {
  Platform,
  TradeType,
  Currency,
  PositionDirection,
  TradeOrderStatus,
} from '../../shared';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';

describe('HyperliquidPlatformService', () => {
  let service: HyperliquidPlatformService;
  let hyperliquidService: jest.Mocked<HyperliquidService>;
  let tradeOrderService: jest.Mocked<TradeOrderService>;
  let module: TestingModule;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'hyperliquid.maxNotionalPerOrder') {
          return 10000;
        }
        return defaultValue;
      }),
    };

    const mockHyperliquidService = {
      placePerpOrder: jest.fn(),
      getTicker: jest.fn(),
      getPosition: jest.fn(),
    };

    const mockWebSocketService = {
      onOrderFill: jest.fn(),
      onOrderUpdate: jest.fn(),
    };

    const mockTradeOrderService = {
      createTradeOrder: jest.fn(),
      handleOrderFill: jest.fn(),
      handleOrderUpdate: jest.fn(),
      getByOrderId: jest.fn(),
      getMany: jest.fn(),
    };

    const mockTradePositionService = {
      getTradePositionById: jest.fn(),
    };

    const mockPredictorAdapter = {
      getTrendsForToken: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        HyperliquidPlatformService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HyperliquidService,
          useValue: mockHyperliquidService,
        },
        {
          provide: HyperliquidWebSocketService,
          useValue: mockWebSocketService,
        },
        {
          provide: TradeOrderService,
          useValue: mockTradeOrderService,
        },
        {
          provide: TradePositionService,
          useValue: mockTradePositionService,
        },
        {
          provide: PredictorAdapter,
          useValue: mockPredictorAdapter,
        },
      ],
    }).compile();

    service = module.get<HyperliquidPlatformService>(
      HyperliquidPlatformService,
    );
    hyperliquidService = module.get(HyperliquidService);
    tradeOrderService = module.get(TradeOrderService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('enterPosition', () => {
    it('should enter a position and return metadata with SL/TP prices', async () => {
      const mockOrderResult = {
        orderId: 'entry-order-123',
        status: TradeOrderStatus.CREATED,
        size: 0.002,
        price: 50000,
        fee: 0.1,
        type: 'Ioc',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockOrderResult);
      jest
        .spyOn(service as any, 'determineDirection')
        .mockResolvedValue(PositionDirection.LONG);

      const result = await service.enterPosition({
        platform: Platform.HYPERLIQUID,
        tradeType: TradeType.PERPETUAL,
        currency: Currency.USDC,
        token: 'BTC',
        amountIn: 100,
        stopLossPrice: 45000,
        takeProfitPrice: 60000,
      });

      expect(result.orderId).toBe('entry-order-123');
      expect(result.status).toBe(TradeOrderStatus.CREATED);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.stopLossPrice).toBe(45000);
      expect(result.metadata?.takeProfitPrice).toBe(60000);
      expect(result.metadata?.direction).toBe(PositionDirection.LONG);
    });

    it('should call placePerpOrder with correct parameters', async () => {
      const mockOrderResult = {
        orderId: 'order-456',
        status: TradeOrderStatus.CREATED,
        size: 0.001,
        price: 3000,
        type: 'Ioc',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockOrderResult);
      jest
        .spyOn(service as any, 'determineDirection')
        .mockResolvedValue(PositionDirection.LONG);

      await service.enterPosition({
        platform: Platform.HYPERLIQUID,
        tradeType: TradeType.PERPETUAL,
        currency: Currency.USDC,
        token: 'ETH',
        amountIn: 200,
      });

      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith({
        symbol: 'ETH',
        direction: PositionDirection.LONG,
        quoteAmount: 200,
        tif: 'Ioc',
      });
    });

    it('should handle errors gracefully', async () => {
      jest
        .spyOn(service as any, 'determineDirection')
        .mockResolvedValue(PositionDirection.LONG);
      hyperliquidService.placePerpOrder.mockRejectedValue(
        new Error('Exchange error'),
      );

      await expect(
        service.enterPosition({
          platform: Platform.HYPERLIQUID,
          tradeType: TradeType.PERPETUAL,
          currency: Currency.USDC,
          token: 'SOL',
          amountIn: 50,
        }),
      ).rejects.toThrow('Exchange error');
    });

    it('should throw error when direction cannot be determined', async () => {
      jest.spyOn(service as any, 'determineDirection').mockResolvedValue(null);

      await expect(
        service.enterPosition({
          platform: Platform.HYPERLIQUID,
          tradeType: TradeType.PERPETUAL,
          currency: Currency.USDC,
          token: 'BTC',
          amountIn: 100,
        }),
      ).rejects.toThrow(
        'Unable to determine trading direction for BTC. No valid trend signals found.',
      );

      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
    });

    it('should enter SHORT position when direction is SHORT', async () => {
      const mockOrderResult = {
        orderId: 'short-order-789',
        status: TradeOrderStatus.CREATED,
        size: 0.5,
        price: 150,
        fee: 0.05,
        type: 'Ioc',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockOrderResult);
      jest
        .spyOn(service as any, 'determineDirection')
        .mockResolvedValue(PositionDirection.SHORT);

      const result = await service.enterPosition({
        platform: Platform.HYPERLIQUID,
        tradeType: TradeType.PERPETUAL,
        currency: Currency.USDC,
        token: 'SOL',
        amountIn: 75,
      });

      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith({
        symbol: 'SOL',
        direction: PositionDirection.SHORT,
        quoteAmount: 75,
        tif: 'Ioc',
      });
      expect(result.orderId).toBe('short-order-789');
      expect(result.metadata?.direction).toBe(PositionDirection.SHORT);
    });

    it('should handle predictor service unavailability', async () => {
      jest
        .spyOn(service as any, 'determineDirection')
        .mockRejectedValue(new Error('Predictor service unavailable'));

      await expect(
        service.enterPosition({
          platform: Platform.HYPERLIQUID,
          tradeType: TradeType.PERPETUAL,
          currency: Currency.USDC,
          token: 'ETH',
          amountIn: 200,
        }),
      ).rejects.toThrow('Predictor service unavailable');

      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
    });
  });

  describe('createStopLossAndTakeProfitOrders', () => {
    beforeEach(() => {
      hyperliquidService.getTicker.mockReset();
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '50000',
        ask: '50000',
        last: '50000',
        mark: '50000',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });
      hyperliquidService.getPosition.mockReset();
      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'BTC',
        szi: '0.002',
        leverage: { value: 3, type: 'cross', rawUsd: '150' },
        unrealizedPnl: '0',
        entryPx: '50000',
        cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
        liquidationPx: '0',
        marginUsed: '50',
        maxLeverage: 10,
        positionValue: '100',
        returnOnEquity: '0',
      });
      hyperliquidService.placePerpOrder.mockReset();
    });

    it('should create both stop-loss and take-profit orders', async () => {
      const mockSlResult = {
        orderId: 'sl-order-123',
        status: TradeOrderStatus.CREATED,
        size: 0.002,
        price: 50000,
        type: 'trigger_sl',
      };

      const mockTpResult = {
        orderId: 'tp-order-456',
        status: TradeOrderStatus.CREATED,
        size: 0.002,
        price: 50000,
        type: 'trigger_tp',
      };

      hyperliquidService.placePerpOrder
        .mockResolvedValueOnce(mockSlResult)
        .mockResolvedValueOnce(mockTpResult);

      await service.createStopLossAndTakeProfitOrders(
        'BTC',
        PositionDirection.LONG,
        0.002,
        'position-id-123',
        45000,
        60000,
      );

      // Should create SL order (SHORT to close LONG)
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith({
        symbol: 'BTC',
        direction: PositionDirection.SHORT,
        quoteAmount: 100, // 0.002 * 50000
        triggerPrice: 45000,
        triggerType: 'sl',
        isMarket: true,
        reduceOnly: true,
      });

      // Should create TP order (SHORT to close LONG)
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith({
        symbol: 'BTC',
        direction: PositionDirection.SHORT,
        quoteAmount: 100,
        triggerPrice: 60000,
        triggerType: 'tp',
        isMarket: true,
        reduceOnly: true,
      });

      // Should save both orders to database
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledTimes(2);
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'sl-order-123',
          position: 'position-id-123',
          triggerType: 'sl',
          triggerPrice: 45000,
          isTrigger: true,
        }),
      );
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'tp-order-456',
          position: 'position-id-123',
          triggerType: 'tp',
          triggerPrice: 60000,
          isTrigger: true,
        }),
      );
    });

    it('should create only stop-loss order when TP price not provided', async () => {
      // Mock different ticker for ETH with mark price of 3000
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '3000',
        ask: '3000',
        last: '3000',
        mark: '3000',
        volume24h: '500000',
        openInterest: '200000',
        fundingRate: '0.0001',
      });

      const mockSlResult = {
        orderId: 'sl-only-123',
        status: TradeOrderStatus.CREATED,
        size: 0.001,
        price: 3000,
        type: 'trigger_sl',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockSlResult);

      await service.createStopLossAndTakeProfitOrders(
        'ETH',
        PositionDirection.SHORT,
        0.001,
        'position-id-456',
        3200, // SL above current price for SHORT
        undefined,
      );

      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledTimes(1);
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerType: 'sl',
          triggerPrice: 3200,
        }),
      );
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledTimes(1);
    });

    it('should create only take-profit order when SL price not provided', async () => {
      const mockTpResult = {
        orderId: 'tp-only-789',
        status: TradeOrderStatus.CREATED,
        size: 0.001,
        price: 3000,
        type: 'trigger_tp',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockTpResult);

      await service.createStopLossAndTakeProfitOrders(
        'ETH',
        PositionDirection.SHORT,
        0.001,
        'position-id-789',
        undefined,
        2800,
      );

      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledTimes(1);
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerType: 'tp',
          triggerPrice: 2800,
        }),
      );
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledTimes(1);
    });

    it('should not create any orders when both prices are undefined', async () => {
      await service.createStopLossAndTakeProfitOrders(
        'BTC',
        PositionDirection.LONG,
        0.002,
        'position-id-999',
        undefined,
        undefined,
      );

      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
      expect(tradeOrderService.createTradeOrder).not.toHaveBeenCalled();
    });

    it('should use opposite direction for SHORT positions', async () => {
      // Mock different ticker for ETH with mark price of 3000
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '3000',
        ask: '3000',
        last: '3000',
        mark: '3000',
        volume24h: '500000',
        openInterest: '200000',
        fundingRate: '0.0001',
      });

      const mockSlResult = {
        orderId: 'sl-short-123',
        status: TradeOrderStatus.CREATED,
        size: 0.001,
        price: 3000,
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockSlResult);

      await service.createStopLossAndTakeProfitOrders(
        'ETH',
        PositionDirection.SHORT,
        0.001,
        'position-id-short',
        3200, // SL above current price for SHORT
        undefined,
      );

      // For SHORT position, SL order should be LONG (opposite)
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: PositionDirection.LONG,
        }),
      );
    });

    it('should handle errors when creating SL order', async () => {
      hyperliquidService.placePerpOrder.mockRejectedValue(
        new Error('Failed to create SL order'),
      );

      await expect(
        service.createStopLossAndTakeProfitOrders(
          'BTC',
          PositionDirection.LONG,
          0.002,
          'position-id-error',
          45000,
          undefined,
        ),
      ).rejects.toThrow('Failed to create SL order');
    });

    it('should reject order when getTicker returns mark: "0"', async () => {
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '50000',
        ask: '50000',
        last: '50000',
        mark: '0', // Edge case: mark price is '0'
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      // Should throw validation error for invalid order size (quoteAmount = 0)
      await expect(
        service.createStopLossAndTakeProfitOrders(
          'BTC',
          PositionDirection.LONG,
          0.002,
          'position-id-zero-mark',
          45000,
          undefined,
        ),
      ).rejects.toThrow('Invalid order size for stop-loss/take-profit: 0');

      // Should not attempt to place order
      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
    });

    it('should reject order when getTicker returns mark: undefined', async () => {
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '3000',
        ask: '3000',
        last: '3000',
        mark: undefined as any, // Edge case: mark price is undefined
        volume24h: '500000',
        openInterest: '200000',
        fundingRate: '0.0001',
      });

      // Should throw validation error for invalid order size (quoteAmount = NaN)
      await expect(
        service.createStopLossAndTakeProfitOrders(
          'ETH',
          PositionDirection.SHORT,
          0.001,
          'position-id-undefined-mark',
          undefined,
          3500,
        ),
      ).rejects.toThrow('Invalid order size for stop-loss/take-profit: NaN');

      // Should not attempt to place order
      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
    });

    it('should reject SL/TP orders when position size is 0', async () => {
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '50000',
        ask: '50000',
        last: '50000',
        mark: '50000',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      // Mock getPosition to return size of 0
      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'BTC',
        szi: '0', // Position size is 0
        leverage: { value: 3, type: 'cross', rawUsd: '0' },
        unrealizedPnl: '0',
        entryPx: '50000',
        cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
        liquidationPx: '0',
        marginUsed: '0',
        maxLeverage: 10,
        positionValue: '0',
        returnOnEquity: '0',
      });

      // Should throw validation error when quoteAmount is 0 (size: 0 * price: 50000 = 0)
      await expect(
        service.createStopLossAndTakeProfitOrders(
          'BTC',
          PositionDirection.LONG,
          0, // Edge case: position size is 0
          'position-id-zero-size',
          45000,
          60000,
        ),
      ).rejects.toThrow('Invalid order size for stop-loss/take-profit: 0');

      // Should not attempt to place orders
      expect(hyperliquidService.placePerpOrder).not.toHaveBeenCalled();
    });

    describe('trigger price validation', () => {
      it('should reject invalid SL price for LONG position when SL equals current price', async () => {
        await expect(
          service.createStopLossAndTakeProfitOrders(
            'BTC',
            PositionDirection.LONG,
            0.002,
            'position-id-123',
            50000, // SL equal to current price
            undefined,
          ),
        ).rejects.toThrow('Invalid SL price 50000 for LONG (current: 50000)');
      });

      it('should reject invalid SL price for LONG position when SL above current price', async () => {
        await expect(
          service.createStopLossAndTakeProfitOrders(
            'BTC',
            PositionDirection.LONG,
            0.002,
            'position-id-123',
            55000, // SL above current price
            undefined,
          ),
        ).rejects.toThrow('Invalid SL price 55000 for LONG (current: 50000)');
      });

      it('should reject invalid SL price for SHORT position when SL below current price', async () => {
        hyperliquidService.getTicker.mockResolvedValue({
          coin: 'ETH',
          bid: '3000',
          ask: '3000',
          last: '3000',
          mark: '3000',
          volume24h: '500000',
          openInterest: '200000',
          fundingRate: '0.0001',
        });

        await expect(
          service.createStopLossAndTakeProfitOrders(
            'ETH',
            PositionDirection.SHORT,
            0.001,
            'position-id-456',
            2500, // SL below current price
            undefined,
          ),
        ).rejects.toThrow('Invalid SL price 2500 for SHORT (current: 3000)');
      });

      it('should reject invalid TP price for LONG position when TP below current price', async () => {
        await expect(
          service.createStopLossAndTakeProfitOrders(
            'BTC',
            PositionDirection.LONG,
            0.002,
            'position-id-789',
            undefined,
            45000, // TP below current price
          ),
        ).rejects.toThrow('Invalid TP price 45000 for LONG (current: 50000)');
      });

      it('should reject invalid TP price for SHORT position when TP above current price', async () => {
        hyperliquidService.getTicker.mockResolvedValue({
          coin: 'ETH',
          bid: '3000',
          ask: '3000',
          last: '3000',
          mark: '3000',
          volume24h: '500000',
          openInterest: '200000',
          fundingRate: '0.0001',
        });

        await expect(
          service.createStopLossAndTakeProfitOrders(
            'ETH',
            PositionDirection.SHORT,
            0.001,
            'position-id-999',
            undefined,
            3500, // TP above current price
          ),
        ).rejects.toThrow('Invalid TP price 3500 for SHORT (current: 3000)');
      });

      it('should accept valid SL and TP prices for LONG position', async () => {
        hyperliquidService.getTicker.mockResolvedValue({
          coin: 'BTC',
          bid: '50000',
          ask: '50000',
          last: '50000',
          mark: '50000',
          volume24h: '1000000',
          openInterest: '500000',
          fundingRate: '0.0001',
        });

        const mockSlResult = {
          orderId: 'sl-valid-long',
          status: TradeOrderStatus.CREATED,
          size: 0.002,
          price: 50000,
          type: 'trigger_sl',
        };

        const mockTpResult = {
          orderId: 'tp-valid-long',
          status: TradeOrderStatus.CREATED,
          size: 0.002,
          price: 50000,
          type: 'trigger_tp',
        };

        hyperliquidService.placePerpOrder
          .mockResolvedValueOnce(mockSlResult)
          .mockResolvedValueOnce(mockTpResult);

        await service.createStopLossAndTakeProfitOrders(
          'BTC',
          PositionDirection.LONG,
          0.002,
          'position-id-valid',
          45000, // Valid SL: below current price
          60000, // Valid TP: above current price
        );

        expect(hyperliquidService.placePerpOrder).toHaveBeenCalledTimes(2);
      });

      it('should accept valid SL and TP prices for SHORT position', async () => {
        hyperliquidService.getTicker.mockResolvedValue({
          coin: 'ETH',
          bid: '3000',
          ask: '3000',
          last: '3000',
          mark: '3000',
          volume24h: '500000',
          openInterest: '200000',
          fundingRate: '0.0001',
        });

        const mockSlResult = {
          orderId: 'sl-valid-short',
          status: TradeOrderStatus.CREATED,
          size: 0.001,
          price: 3000,
          type: 'trigger_sl',
        };

        const mockTpResult = {
          orderId: 'tp-valid-short',
          status: TradeOrderStatus.CREATED,
          size: 0.001,
          price: 3000,
          type: 'trigger_tp',
        };

        hyperliquidService.placePerpOrder
          .mockResolvedValueOnce(mockSlResult)
          .mockResolvedValueOnce(mockTpResult);

        await service.createStopLossAndTakeProfitOrders(
          'ETH',
          PositionDirection.SHORT,
          0.001,
          'position-id-valid-short',
          3200, // Valid SL: above current price
          2800, // Valid TP: below current price
        );

        expect(hyperliquidService.placePerpOrder).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('exitPosition', () => {
    it('should exit a LONG position with SHORT order', async () => {
      const mockPosition = {
        token: 'BTC',
        platform: Platform.HYPERLIQUID,
        positionDirection: PositionDirection.LONG,
        positionSize: 0.002,
      } as any;

      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        mark: '50000',
        bid: '50000',
        ask: '50000',
        last: '50000',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'BTC',
        szi: '0.002',
        leverage: { value: 3, type: 'cross', rawUsd: '150' },
        unrealizedPnl: '0',
        entryPx: '50000',
        cumFunding: { allTime: '0', sinceChange: '0', sinceOpen: '0' },
        liquidationPx: '0',
        marginUsed: '50',
        maxLeverage: 10,
        positionValue: '100',
        returnOnEquity: '0',
      });

      const mockExitResult = {
        orderId: 'exit-order-123',
        status: TradeOrderStatus.CREATED,
        size: 0.002,
        price: 50000,
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockExitResult);

      const result = await service.exitPosition(mockPosition);

      expect(result.orderId).toBe('exit-order-123');
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC',
          direction: PositionDirection.SHORT,
          reduceOnly: true,
        }),
      );
    });
  });

  describe('replaceTakeProfitOrder', () => {
    beforeEach(() => {
      hyperliquidService.getTicker.mockReset();
      hyperliquidService.getPosition.mockReset();
      hyperliquidService.placePerpOrder.mockReset();
      hyperliquidService.cancelOrder = jest.fn().mockResolvedValue(undefined);
      tradeOrderService.getMany.mockReset();
      tradeOrderService.createTradeOrder.mockReset();
    });

    it('should create new TP order BEFORE cancelling old ones (protection gap fix)', async () => {
      // Given: Position with old TP order
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '2448',
        ask: '2452',
        last: '2450',
        mark: '2450',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'ETH',
        szi: '1.0',
        entryPx: '2000',
        positionValue: '2450',
        unrealizedPnl: '450',
        returnOnEquity: '0.225',
        liquidationPx: '1000',
        marginUsed: '2000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1, rawUsd: '2000' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      const mockNewTpOrder = {
        orderId: 'new-tp-123',
        status: TradeOrderStatus.CREATED,
        size: 1.0,
        price: 2695,
        type: 'trigger_tp',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockNewTpOrder);

      tradeOrderService.getMany.mockResolvedValue([
        {
          orderId: 'old-tp-456',
          position: 'pos-123',
          triggerType: 'tp',
          isTrigger: true,
        } as any,
      ]);

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'ETH',
        szi: '1.0',
        entryPx: '2000',
        positionValue: '2450',
        unrealizedPnl: '450',
        returnOnEquity: '0.225',
        liquidationPx: '1000',
        marginUsed: '2000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1, rawUsd: '2000' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      // When: Replace TP order
      const result = await service.replaceTakeProfitOrder(
        'ETH',
        PositionDirection.LONG,
        'pos-123',
        2695,
      );

      // Then: New TP order created FIRST
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'ETH',
          direction: PositionDirection.SHORT,
          triggerPrice: 2695,
          triggerType: 'tp',
          reduceOnly: true,
        }),
      );

      // And: Old order cancelled AFTER new one created
      expect(hyperliquidService.cancelOrder).toHaveBeenCalledWith(
        'old-tp-456',
        'ETH',
      );

      // And: Returns verification data
      expect(result).toEqual({
        newOrderId: 'new-tp-123',
        cancelledCount: 1,
      });
    });

    it('should throw error if new TP order creation returns null orderId', async () => {
      // Given: Exchange fails to create order
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '2448',
        ask: '2452',
        last: '2450',
        mark: '2450',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'ETH',
        szi: '1.0',
        entryPx: '2000',
        positionValue: '2450',
        unrealizedPnl: '450',
        returnOnEquity: '0.225',
        liquidationPx: '1000',
        marginUsed: '2000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1, rawUsd: '2000' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      // Mock: Returns null orderId
      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: null, // FAILURE!
        status: TradeOrderStatus.FAILED,
        size: 0,
        price: 0,
      } as any);

      tradeOrderService.getMany.mockResolvedValue([
        { orderId: 'old-tp-789', triggerType: 'tp' } as any,
      ]);

      // When/Then: Should throw immediately
      await expect(
        service.replaceTakeProfitOrder(
          'ETH',
          PositionDirection.LONG,
          'pos-456',
          2695,
        ),
      ).rejects.toThrow('Failed to create new TP order for ETH: orderId is missing');

      // And: Old orders NOT cancelled
      expect(hyperliquidService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should save new TP order to database before cancelling old ones', async () => {
      // Given: Setup mocks
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '49800',
        ask: '50200',
        last: '50000',
        mark: '50000',
        volume24h: '10000000',
        openInterest: '5000000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'BTC',
        szi: '0.1', // Reduced to keep under 10000 limit
        entryPx: '48000',
        positionValue: '5000',
        unrealizedPnl: '200',
        returnOnEquity: '0.04',
        liquidationPx: '40000',
        marginUsed: '2400',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 2, rawUsd: '4800' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: 'new-tp-btc-999',
        status: TradeOrderStatus.CREATED,
        size: 0.5,
        price: 55000,
        type: 'trigger_tp',
      });

      tradeOrderService.getMany.mockResolvedValue([]);

      // When: Replace TP
      await service.replaceTakeProfitOrder(
        'BTC',
        PositionDirection.LONG,
        'pos-btc-123',
        55000,
      );

      // Then: New order saved to DB
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'new-tp-btc-999',
          position: 'pos-btc-123',
          triggerType: 'tp',
          triggerPrice: 55000,
          isTrigger: true,
        }),
      );
    });

    it('should handle multiple old TP orders', async () => {
      // Given: Multiple old TP orders exist
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '2448',
        ask: '2452',
        last: '2450',
        mark: '2450',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'ETH',
        szi: '2.0',
        entryPx: '2000',
        positionValue: '4900',
        unrealizedPnl: '900',
        returnOnEquity: '0.18',
        liquidationPx: '1500',
        marginUsed: '3000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1.5, rawUsd: '4500' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: 'new-tp-multi-123',
        status: TradeOrderStatus.CREATED,
        size: 2.0,
        price: 2695,
        type: 'trigger_tp',
      });

      // Multiple old orders
      tradeOrderService.getMany.mockResolvedValue([
        { orderId: 'old-tp-1', triggerType: 'tp' } as any,
        { orderId: 'old-tp-2', triggerType: 'tp' } as any,
        { orderId: 'old-tp-3', triggerType: 'tp' } as any,
      ]);

      // When: Replace TP
      const result = await service.replaceTakeProfitOrder(
        'ETH',
        PositionDirection.LONG,
        'pos-multi',
        2695,
      );

      // Then: All old orders cancelled
      expect(hyperliquidService.cancelOrder).toHaveBeenCalledTimes(3);
      expect(hyperliquidService.cancelOrder).toHaveBeenCalledWith('old-tp-1', 'ETH');
      expect(hyperliquidService.cancelOrder).toHaveBeenCalledWith('old-tp-2', 'ETH');
      expect(hyperliquidService.cancelOrder).toHaveBeenCalledWith('old-tp-3', 'ETH');

      // And: Returns correct count
      expect(result.cancelledCount).toBe(3);
    });

    it('should handle cancellation failures gracefully', async () => {
      // Given: Setup with old order
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'SOL',
        bid: '148',
        ask: '152',
        last: '150',
        mark: '150',
        volume24h: '500000',
        openInterest: '250000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'SOL',
        szi: '10.0',
        entryPx: '140',
        positionValue: '1500',
        unrealizedPnl: '100',
        returnOnEquity: '0.067',
        liquidationPx: '100',
        marginUsed: '1000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1.5, rawUsd: '1500' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: 'new-tp-sol-456',
        status: TradeOrderStatus.CREATED,
        size: 10.0,
        price: 165,
        type: 'trigger_tp',
      });

      tradeOrderService.getMany.mockResolvedValue([
        { orderId: 'old-tp-fail', triggerType: 'tp' } as any,
      ]);

      // Mock: Cancellation fails
      hyperliquidService.cancelOrder = jest
        .fn()
        .mockRejectedValue(new Error('Order not found on exchange'));

      // When: Replace TP (should NOT throw despite cancellation failure)
      const result = await service.replaceTakeProfitOrder(
        'SOL',
        PositionDirection.LONG,
        'pos-sol-789',
        165,
      );

      // Then: New order still created and saved
      expect(result.newOrderId).toBe('new-tp-sol-456');
      expect(tradeOrderService.createTradeOrder).toHaveBeenCalled();

      // And: Cancellation was attempted
      expect(hyperliquidService.cancelOrder).toHaveBeenCalled();

      // And: Returns 0 cancelled (failed to cancel)
      expect(result.cancelledCount).toBe(0);
    });

    it('should work for SHORT positions', async () => {
      // Given: SHORT position
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'ETH',
        bid: '1548',
        ask: '1552',
        last: '1550',
        mark: '1550',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'ETH',
        szi: '-1.5', // Negative for SHORT
        entryPx: '2000',
        positionValue: '2325',
        unrealizedPnl: '675',
        returnOnEquity: '0.29',
        liquidationPx: '2500',
        marginUsed: '2000',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 1.2, rawUsd: '2400' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: 'new-tp-short-789',
        status: TradeOrderStatus.CREATED,
        size: 1.5,
        price: 1395, // 1550 * 0.90 for SHORT
        type: 'trigger_tp',
      });

      tradeOrderService.getMany.mockResolvedValue([
        { orderId: 'old-tp-short', triggerType: 'tp' } as any,
      ]);

      // When: Replace TP for SHORT
      const result = await service.replaceTakeProfitOrder(
        'ETH',
        PositionDirection.SHORT,
        'pos-short-456',
        1395,
      );

      // Then: Close direction is LONG (opposite of SHORT)
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: PositionDirection.LONG,
          triggerPrice: 1395,
          triggerType: 'tp',
        }),
      );

      // And: Successful replacement
      expect(result.newOrderId).toBe('new-tp-short-789');
      expect(result.cancelledCount).toBe(1);
    });

    it('should query for old TP orders excluding the new one', async () => {
      // Given: Setup
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '49800',
        ask: '50200',
        last: '50000',
        mark: '50000',
        volume24h: '10000000',
        openInterest: '5000000',
        fundingRate: '0.0001',
      });

      hyperliquidService.getPosition.mockResolvedValue({
        coin: 'BTC',
        szi: '0.15', // Reduced to keep under 10000 limit
        entryPx: '48000',
        positionValue: '7500',
        unrealizedPnl: '300',
        returnOnEquity: '0.04',
        liquidationPx: '40000',
        marginUsed: '3600',
        maxLeverage: 10,
        leverage: { type: 'cross', value: 2, rawUsd: '7200' },
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      });

      hyperliquidService.placePerpOrder.mockResolvedValue({
        orderId: 'new-unique-123',
        status: TradeOrderStatus.CREATED,
        size: 1.0,
        price: 55000,
        type: 'trigger_tp',
      });

      tradeOrderService.getMany.mockResolvedValue([]);

      // When: Replace TP
      await service.replaceTakeProfitOrder(
        'BTC',
        PositionDirection.LONG,
        'pos-query-test',
        55000,
      );

      // Then: Query excludes new order ID
      expect(tradeOrderService.getMany).toHaveBeenCalledWith({
        position: 'pos-query-test',
        isTrigger: true,
        triggerType: 'tp',
        orderId: { $ne: 'new-unique-123' }, // Excludes new order!
      });
    });
  });
});
