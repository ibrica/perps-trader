import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  HyperliquidService,
  HLMarket,
  HLTicker,
  PlacePerpOrderParams,
} from './HyperliquidService';
import { HyperliquidClient, HyperliquidError } from './HyperliquidClient';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';
import { HL_SYMBOL_MAP } from '../../shared/constants2/hyperliquid';

// Add HL_ACTION_TYPES for backwards compatibility in tests
const HL_ACTION_TYPES = {
  PERPS_META_AND_ASSET_CTXS: 'metaAndAssetCtxs',
  ALL_MIDS: 'allMids',
  L2_BOOK: 'l2Book',
  ORDER: 'order',
  CANCEL: 'cancel',
  USER_STATE: 'userState',
};

describe('HyperliquidService', () => {
  let service: HyperliquidService;
  let mockClient: jest.Mocked<HyperliquidClient>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSignatureAdapter: jest.Mocked<HyperliquidSignatureAdapter>;

  const mockMarkets: HLMarket[] = [
    {
      name: 'BTC',
      szDecimals: 3,
      pxDecimals: 2,
      minSize: 0.001,
      maxLeverage: 20,
      onlyIsolated: false,
    },
    {
      name: 'ETH',
      szDecimals: 3,
      pxDecimals: 2,
      minSize: 0.01,
      maxLeverage: 15,
      onlyIsolated: false,
    },
  ];

  const mockTicker: HLTicker = {
    coin: 'BTC',
    bid: '50000.00',
    ask: '50001.00',
    last: '50000.50',
    mark: '50000.50',
    volume24h: '1000000',
    openInterest: '500000',
    fundingRate: '0.0001',
  };

  beforeEach(async () => {
    mockClient = {
      getInfo: jest.fn(),
      exchangeAction: jest.fn(),
      getSdk: jest.fn().mockReturnValue({
        isAuthenticated: jest.fn().mockReturnValue(true),
        custom: {
          cancelAllOrders: jest
            .fn()
            .mockResolvedValue({ response: { data: { statuses: [] } } }),
        },
      }),
      isAuthenticated: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<HyperliquidClient>;

    // Set up default mocks for common service calls
    (mockClient.getInfo as any).mockImplementation((type: string) => {
      switch (type) {
        case 'metaAndAssetCtxs':
          return Promise.resolve([
            { universe: mockMarkets },
            [
              {
                markPx: '50000.0',
                dayNtlVlm: '1000000',
                openInterest: '500000',
                funding: '0.0001',
              },
              {
                markPx: '3000.0',
                dayNtlVlm: '500000',
                openInterest: '300000',
                funding: '0.0002',
              },
            ],
          ]);
        case 'allMids':
          return Promise.resolve({ BTC: '50000.0', ETH: '3000.0' });
        case 'userState':
          return Promise.resolve({
            assetPositions: [
              {
                position: {
                  coin: 'BTC',
                  szi: '0.1',
                  entryPx: '49000.00',
                  positionValue: '4900.00',
                  unrealizedPnl: '100.00',
                  returnOnEquity: '0.0204',
                  leverage: { rawUsd: '20', value: '10', type: 'cross' },
                  liquidationPx: '45000.00',
                  maxLeverage: 20,
                  marginUsed: '490.00',
                  cumFunding: {
                    allTime: '5.00',
                    sinceChange: '1.00',
                    sinceOpen: '2.50',
                  },
                },
              },
            ],
            marginSummary: { accountValue: '1000.0' },
          });
        case 'l2Book':
          return Promise.resolve({
            levels: [{ px: '50000.0', sz: '1.0', n: 1 }],
          });
        case 'fundingHistory':
          return Promise.resolve([{ coin: 'BTC', rate: '0.0001' }]);
        default:
          return Promise.resolve({});
      }
    });

    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockSignatureAdapter = {
      getPublicAddress: jest
        .fn()
        .mockReturnValue('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'),
    } as unknown as jest.Mocked<HyperliquidSignatureAdapter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperliquidService,
        {
          provide: HyperliquidClient,
          useValue: mockClient,
        },
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

    service = module.get<HyperliquidService>(HyperliquidService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMarkets', () => {
    it('should fetch and cache markets', async () => {
      (mockClient.getInfo as any).mockResolvedValue([
        { universe: mockMarkets },
        [],
      ]);

      const result = await service.getMarkets();

      expect(result).toEqual([
        { ...mockMarkets[0], pxDecimals: 5, minSize: 0.001 },
        { ...mockMarkets[1], pxDecimals: 5, minSize: 0.001 },
      ]);
      expect(mockClient.getInfo).toHaveBeenCalledWith('metaAndAssetCtxs');
    });

    it('should return cached markets if within TTL', async () => {
      // First call to populate cache
      (mockClient.getInfo as any).mockResolvedValue([
        { universe: mockMarkets },
        [],
      ]);

      await service.getMarkets();
      jest.clearAllMocks();

      // Second call should use cache
      const result = await service.getMarkets();

      expect(result).toEqual([
        { ...mockMarkets[0], pxDecimals: 5, minSize: 0.001 },
        { ...mockMarkets[1], pxDecimals: 5, minSize: 0.001 },
      ]);
      expect(mockClient.getInfo).not.toHaveBeenCalled();
    });

    it('should refetch markets after cache expires', async () => {
      // First call to populate cache
      (mockClient.getInfo as any).mockResolvedValue({
        meta: {
          universe: mockMarkets,
        },
      });

      await service.getMarkets();

      // Manually expire cache
      (service as any).lastMarketsFetch = Date.now() - 70000; // 70 seconds ago
      jest.clearAllMocks();

      const updatedMarkets = [
        ...mockMarkets,
        {
          name: 'SOL',
          szDecimals: 2,
          pxDecimals: 3,
          minSize: 0.1,
          maxLeverage: 10,
          onlyIsolated: false,
        },
      ];
      (mockClient.getInfo as any).mockResolvedValue([
        { universe: updatedMarkets },
        [],
      ]);

      const result = await service.getMarkets();

      expect(result).toEqual([
        { ...mockMarkets[0], pxDecimals: 5, minSize: 0.001 },
        { ...mockMarkets[1], pxDecimals: 5, minSize: 0.001 },
        {
          name: 'SOL',
          szDecimals: 2,
          pxDecimals: 5,
          minSize: 0.001,
          maxLeverage: 10,
          onlyIsolated: false,
        },
      ]);
      expect(mockClient.getInfo).toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      (mockClient.getInfo as any).mockRejectedValue(error);

      await expect(service.getMarkets()).rejects.toThrow('API Error');
    });
  });

  describe('getTicker', () => {
    it('should fetch ticker for a symbol', async () => {
      (mockClient.getInfo as any).mockImplementation((type: string) => {
        if (type === 'allMids') {
          return Promise.resolve({ BTC: '50000.50' });
        }
        if (type === 'metaAndAssetCtxs') {
          return Promise.resolve([
            {
              universe: [{ name: 'BTC' }],
            },
            [
              {
                markPx: '50000.50',
                dayNtlVlm: '1000000',
                openInterest: '500000',
                funding: '0.0001',
              },
            ],
          ]);
        }
        return Promise.resolve({});
      });

      // Mock the symbol mapping to return 'BTC'
      jest.spyOn(service as any, 'mapSymbolToHL').mockReturnValue('BTC');

      const result = await service.getTicker('BTC');

      expect(result).toEqual({
        coin: 'BTC',
        bid: '50000.50',
        ask: '50000.50',
        last: '50000.50',
        mark: '50000.50',
        volume24h: '1000000',
        openInterest: '500000',
        fundingRate: '0.0001',
      });
      expect(mockClient.getInfo).toHaveBeenCalledWith('allMids');
    });

    it('should map symbol using symbol map', async () => {
      (mockClient.getInfo as any).mockImplementation((type: string) => {
        if (type === 'allMids') {
          return Promise.resolve({ 'BTC-PERP': '50000.50' });
        }
        if (type === 'metaAndAssetCtxs') {
          return Promise.resolve([
            {
              universe: [{ name: 'BTC-PERP' }],
            },
            [
              {
                markPx: '50000.50',
                dayNtlVlm: '1000000',
                openInterest: '500000',
                funding: '0.0001',
              },
            ],
          ]);
        }
        return Promise.resolve({});
      });

      // Mock symbol mapping
      jest.spyOn(service as any, 'mapSymbolToHL').mockReturnValue('BTC-PERP');

      await service.getTicker('BTC');

      expect((service as any).mapSymbolToHL).toHaveBeenCalledWith('BTC');
    });

    it('should throw error if ticker not found', async () => {
      (mockClient.getInfo as any).mockResolvedValue({});

      await expect(service.getTicker('INVALID')).rejects.toThrow(
        HyperliquidError,
      );
    });
  });

  describe('getOrderbook', () => {
    it('should fetch orderbook for a symbol', async () => {
      const mockOrderbook = {
        coin: 'BTC',
        levels: [
          { px: '50000.00', sz: '1.0', n: 5 },
          { px: '50001.00', sz: '0.5', n: 3 },
        ],
      };

      (mockClient.getInfo as any).mockResolvedValue({
        levels: mockOrderbook.levels,
      });

      jest.spyOn(service as any, 'mapSymbolToHL').mockReturnValue('BTC');

      const result = await service.getOrderbook('BTC');

      expect(result).toEqual(mockOrderbook);
      expect(mockClient.getInfo).toHaveBeenCalledWith(HL_ACTION_TYPES.L2_BOOK, {
        coin: 'BTC',
      });
    });
  });

  describe('placePerpOrder', () => {
    beforeEach(() => {
      // Mock dependencies - need to mock the actual service methods, not private ones
      jest.spyOn(service as any, 'getMarket').mockResolvedValue(mockMarkets[0]); // Return BTC market
      jest.spyOn(service, 'getTicker').mockResolvedValue({
        ...mockTicker,
        mark: '50000', // Ensure mark price is available for size calculation
      });
      jest.spyOn(service as any, 'getAssetIndex').mockResolvedValue(0);
      jest.spyOn(service as any, 'updateLeverage').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'mapSymbolToHL').mockReturnValue('BTC');
    });

    it('should place a LONG order successfully', async () => {
      const mockOrderResponse = {
        response: {
          data: {
            statuses: [
              {
                resting: {
                  oid: 'order-123',
                },
              },
            ],
          },
        },
      };

      mockClient.exchangeAction.mockResolvedValue(mockOrderResponse);

      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'LONG',
        quoteAmount: BigInt(50000000), // 50 USDC (6 decimals)
        price: 50000,
        leverage: 10,
      };

      const result = await service.placePerpOrder(params);

      expect(result).toEqual({ orderId: 'order-123' });
      expect(mockClient.exchangeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order',
          order: expect.objectContaining({
            coin: 'BTC',
            is_buy: true,
            sz: '0.001',
            limit_px: '50000',
            order_type: { limit: { tif: 'Gtc' } },
            reduce_only: false,
          }),
        }),
      );
    });

    it('should place a SHORT order successfully', async () => {
      const mockOrderResponse = {
        response: {
          data: {
            statuses: [
              {
                filled: {
                  oid: 'order-456',
                  totalSz: '0.020',
                  avgPx: '50000.00',
                },
              },
            ],
          },
        },
      };

      mockClient.exchangeAction.mockResolvedValue(mockOrderResponse);

      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'SHORT',
        quoteAmount: BigInt(50000000), // 50 USDC
        leverage: 5,
      };

      const result = await service.placePerpOrder(params);

      expect(result).toEqual({ orderId: 'order-456' });
      expect(mockClient.exchangeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order',
          order: expect.objectContaining({
            coin: 'BTC',
            is_buy: false,
            sz: '0.001',
            limit_px: '50000',
            order_type: { limit: { tif: 'Gtc' } },
            reduce_only: false,
          }),
        }),
      );
    });

    it('should calculate size from quote amount and mark price', async () => {
      const mockOrderResponse = {
        response: {
          data: {
            statuses: [{ resting: { oid: 'order-123' } }],
          },
        },
      };

      mockClient.exchangeAction.mockResolvedValue(mockOrderResponse);

      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'LONG',
        quoteAmount: BigInt(100000000), // 100 USDC
      };

      await service.placePerpOrder(params);

      // 100 USDC / 50000 price = 0.002 BTC
      // Rounded to minSize step (0.001) = 0.002
      expect(mockClient.exchangeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order',
          order: expect.objectContaining({
            coin: 'BTC',
            is_buy: true,
            sz: '0.002',
            limit_px: '50000',
            order_type: { limit: { tif: 'Gtc' } },
            reduce_only: false,
          }),
        }),
      );
    });

    it('should validate minimum order size', async () => {
      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'LONG',
        quoteAmount: BigInt(100), // Very small amount
      };

      await expect(service.placePerpOrder(params)).rejects.toThrow(
        'Order size 0 is below minimum 0.001',
      );
    });

    it('should handle order placement errors', async () => {
      const mockOrderResponse = {
        response: {
          data: {
            statuses: [
              {
                // No resting or filled object means the order failed
              },
            ],
          },
        },
      };

      mockClient.exchangeAction.mockResolvedValue(mockOrderResponse);

      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'LONG',
        quoteAmount: BigInt(1000000000), // Larger amount to avoid minimum size issue
      };

      await expect(service.placePerpOrder(params)).rejects.toThrow(
        'Failed to place order: Unknown error',
      );
    });

    it('should update leverage if specified', async () => {
      const mockOrderResponse = {
        response: {
          data: {
            statuses: [{ resting: { oid: 'order-123' } }],
          },
        },
      };

      mockClient.exchangeAction.mockResolvedValue(mockOrderResponse);

      const params: PlacePerpOrderParams = {
        symbol: 'BTC',
        direction: 'LONG',
        quoteAmount: BigInt(1000000000), // Larger amount to avoid minimum size issue
        leverage: 15,
      };

      await service.placePerpOrder(params);

      expect((service as any).updateLeverage).toHaveBeenCalledWith('BTC', 15);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order successfully', async () => {
      mockClient.exchangeAction.mockResolvedValue({ success: true });

      await service.cancelOrder('123', 'BTC');

      expect(mockClient.exchangeAction).toHaveBeenCalledWith({
        type: 'cancel',
        cancels: [
          {
            coin: 'BTC-PERP',
            o: 123,
          },
        ],
      });
    });

    it('should cancel order without symbol', async () => {
      mockClient.exchangeAction.mockResolvedValue({ success: true });

      await service.cancelOrder('123');

      expect(mockClient.exchangeAction).toHaveBeenCalledWith({
        type: 'cancel',
        cancels: [
          {
            coin: '',
            o: 123,
          },
        ],
      });
    });
  });

  describe('cancelAll', () => {
    it('should cancel all orders for a symbol', async () => {
      const mockResponse = {
        status: 'ok',
        response: {
          type: 'cancel',
          data: {
            statuses: ['order-1', 'order-2'],
          },
        },
      };

      // Mock the SDK's custom.cancelAllOrders method
      const mockSdk = mockClient.getSdk();
      jest
        .spyOn(mockSdk.custom, 'cancelAllOrders')
        .mockResolvedValue(mockResponse);

      const result = await service.cancelAll('BTC');

      expect(result).toBe(2);
      expect(mockSdk.custom.cancelAllOrders).toHaveBeenCalledWith('BTC-PERP');
    });

    it('should cancel all orders without symbol', async () => {
      const mockResponse = {
        status: 'ok',
        response: {
          type: 'cancel',
          data: {
            statuses: ['order-1', 'order-2', 'order-3'],
          },
        },
      };

      // Mock the SDK's custom.cancelAllOrders method
      const mockSdk = mockClient.getSdk();
      jest
        .spyOn(mockSdk.custom, 'cancelAllOrders')
        .mockResolvedValue(mockResponse);

      const result = await service.cancelAll();

      expect(result).toBe(3);
      expect(mockSdk.custom.cancelAllOrders).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getPositions', () => {
    it('should fetch user positions', async () => {
      const mockUserState = {
        assetPositions: [
          {
            position: {
              coin: 'BTC',
              szi: '0.1',
              entryPx: '49000.00',
              positionValue: '4900.00',
              unrealizedPnl: '100.00',
              returnOnEquity: '0.0204',
              leverage: {
                rawUsd: '20',
                value: '10',
                type: 'cross',
              },
              liquidationPx: '45000.00',
              maxLeverage: 20,
              marginUsed: '490.00',
              cumFunding: {
                allTime: '5.00',
                sinceChange: '1.00',
                sinceOpen: '2.50',
              },
            },
          },
        ],
      };

      (mockClient.getInfo as any).mockResolvedValue(mockUserState);

      const result = await service.getPositions();

      // The result should match the actual structure returned from the service
      expect(result).toEqual([
        {
          coin: 'BTC',
          szi: '0.1',
          entryPx: '49000.00',
          positionValue: '4900.00',
          unrealizedPnl: '100.00',
          returnOnEquity: '0.0204',
          leverage: {
            rawUsd: '20',
            value: '10',
            type: 'cross',
          },
          liquidationPx: '45000.00',
          maxLeverage: 20,
          marginUsed: '490.00',
          cumFunding: {
            allTime: '5.00',
            sinceChange: '1.00',
            sinceOpen: '2.50',
          },
        },
      ]);
      expect(mockClient.getInfo).toHaveBeenCalledWith('userState', {
        user: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      });
    });

    it('should handle empty positions', async () => {
      (mockClient.getInfo as any).mockResolvedValue({ assetPositions: [] });

      const result = await service.getPositions();

      expect(result).toEqual([]);
    });
  });

  describe('getBalance', () => {
    it('should fetch account balance', async () => {
      const mockUserState = {
        marginSummary: {
          accountValue: '10000.00',
          totalMarginUsed: '1000.00',
        },
      };

      (mockClient.getInfo as any).mockResolvedValue(mockUserState);

      const result = await service.getBalance();

      expect(result).toEqual({
        total: 10000,
        available: 1000,
      });
    });
  });

  describe('getFundingRates', () => {
    it('should fetch funding rates for all symbols', async () => {
      const mockFundingRates = [
        { coin: 'BTC', rate: '0.0001' },
        { coin: 'ETH', rate: '0.0002' },
      ];

      (mockClient.getInfo as any).mockResolvedValue(mockFundingRates);

      const result = await service.getFundingRates();

      expect(result).toEqual(mockFundingRates);
      // The service now adds startTime parameter for funding history
      expect(mockClient.getInfo).toHaveBeenCalledWith(
        'fundingHistory',
        expect.objectContaining({
          coin: 'BTC',
          startTime: expect.any(Number),
        }),
      );
    });

    it('should fetch funding rates for specific symbol', async () => {
      const mockFundingRates = [{ coin: 'BTC', rate: '0.0001' }];

      (mockClient.getInfo as any).mockResolvedValue(mockFundingRates);
      jest.spyOn(service as any, 'mapSymbolToHL').mockReturnValue('BTC');

      const result = await service.getFundingRates('BTC');

      expect(result).toEqual(mockFundingRates);
      // The service now adds startTime parameter for funding history
      expect(mockClient.getInfo).toHaveBeenCalledWith(
        'fundingHistory',
        expect.objectContaining({
          coin: 'BTC',
          startTime: expect.any(Number),
        }),
      );
    });
  });

  describe('getMarketPrice', () => {
    it('should get market price by index', async () => {
      jest.spyOn(service as any, 'getMarkets').mockResolvedValue(mockMarkets);
      jest.spyOn(service as any, 'getTicker').mockResolvedValue(mockTicker);
      jest.spyOn(service as any, 'mapSymbolFromHL').mockReturnValue('BTC');

      const result = await service.getMarketPrice(0);

      expect(result).toEqual({
        bid: 50000,
        ask: 50001,
      });
    });

    it('should throw error for invalid market index', async () => {
      jest.spyOn(service as any, 'getMarkets').mockResolvedValue(mockMarkets);

      await expect(service.getMarketPrice(10)).rejects.toThrow(
        'Invalid market index: 10',
      );
    });
  });

  describe('getAvailableMarkets', () => {
    it('should return available markets with indices', async () => {
      jest.spyOn(service as any, 'getMarkets').mockResolvedValue(mockMarkets);
      jest.spyOn(service as any, 'mapSymbolFromHL').mockReturnValue('BTC');

      const result = await service.getAvailableMarkets();

      expect(result).toEqual([
        { marketIndex: 0, baseAssetSymbol: 'BTC' },
        { marketIndex: 1, baseAssetSymbol: 'BTC' },
      ]);
    });
  });

  describe('symbol mapping', () => {
    it('should map symbol to Hyperliquid format', () => {
      const result = (service as any).mapSymbolToHL('BTC');
      expect(result).toBe(HL_SYMBOL_MAP['BTC'] || 'BTC');
    });

    it('should map symbol from Hyperliquid format', () => {
      const result = (service as any).mapSymbolFromHL('BTC-PERP');
      // This would depend on the reverse mapping in constants
      expect(result).toBeDefined();
    });
  });

  describe('roundToStep', () => {
    it('should round value to nearest step', () => {
      const result = (service as any).roundToStep(0.1234, 0.001);
      expect(result).toBe(0.123);
    });

    it('should round down to step', () => {
      const result = (service as any).roundToStep(0.1239, 0.001);
      expect(result).toBe(0.123);
    });
  });
});
