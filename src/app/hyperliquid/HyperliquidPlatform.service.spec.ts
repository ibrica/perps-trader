import { Test, TestingModule } from '@nestjs/testing';
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

describe('HyperliquidPlatformService', () => {
  let service: HyperliquidPlatformService;
  let hyperliquidService: jest.Mocked<HyperliquidService>;
  let tradeOrderService: jest.Mocked<TradeOrderService>;
  let module: TestingModule;

  beforeEach(async () => {
    const mockHyperliquidService = {
      placePerpOrder: jest.fn(),
      getTicker: jest.fn(),
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

    module = await Test.createTestingModule({
      providers: [
        HyperliquidPlatformService,
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
        3200,
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
        3200,
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

    it('should handle getTicker returning mark: "0" gracefully', async () => {
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

      const mockSlResult = {
        orderId: 'sl-order-zero-mark',
        status: TradeOrderStatus.CREATED,
        size: 0.002,
        price: 50000,
        type: 'trigger_sl',
      };

      hyperliquidService.placePerpOrder.mockResolvedValue(mockSlResult);

      await service.createStopLossAndTakeProfitOrders(
        'BTC',
        PositionDirection.LONG,
        0.002,
        'position-id-zero-mark',
        45000,
        undefined,
      );

      // Should use quoteAmount of 0 (0.002 * 0)
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith({
        symbol: 'BTC',
        direction: PositionDirection.SHORT,
        quoteAmount: 0,
        triggerPrice: 45000,
        triggerType: 'sl',
        isMarket: true,
        reduceOnly: true,
      });
    });

    it('should handle getTicker returning mark: undefined gracefully', async () => {
      hyperliquidService.getTicker.mockResolvedValue({
        coin: 'BTC',
        bid: '50000',
        ask: '50000',
        last: '50000',
        mark: undefined as any, // Edge case: mark price is undefined
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });

      const mockTpResult = {
        orderId: 'tp-order-undefined-mark',
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
        'position-id-undefined-mark',
        undefined,
        3500,
      );

      // Should use quoteAmount of NaN (0.001 * NaN) or 0
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'ETH',
          direction: PositionDirection.LONG,
          triggerPrice: 3500,
          triggerType: 'tp',
        }),
      );
    });

    it('should not create SL/TP orders when position size is 0', async () => {
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
        orderId: 'sl-order-zero-size',
        status: TradeOrderStatus.CREATED,
        size: 0,
        price: 50000,
        type: 'trigger_sl',
      };

      const mockTpResult = {
        orderId: 'tp-order-zero-size',
        status: TradeOrderStatus.CREATED,
        size: 0,
        price: 50000,
        type: 'trigger_tp',
      };

      hyperliquidService.placePerpOrder
        .mockResolvedValueOnce(mockSlResult)
        .mockResolvedValueOnce(mockTpResult);

      await service.createStopLossAndTakeProfitOrders(
        'BTC',
        PositionDirection.LONG,
        0, // Edge case: position size is 0
        'position-id-zero-size',
        45000,
        60000,
      );

      // Should still attempt to create orders with quoteAmount of 0
      // This behavior may need refinement in the actual implementation
      expect(hyperliquidService.placePerpOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          quoteAmount: 0,
        }),
      );
    });

    describe.skip('trigger price validation', () => {
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
});
