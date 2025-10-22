import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HyperliquidTokenDiscoveryService } from './HyperliquidTokenDiscovery.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PerpService } from '../perps/Perp.service';
import { Platform } from '../../shared';

describe('HyperliquidTokenDiscoveryService', () => {
  let service: HyperliquidTokenDiscoveryService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockHyperliquidService: jest.Mocked<HyperliquidService>;
  let mockPerpService: jest.Mocked<PerpService>;

  const mockMarkets = [
    {
      name: 'BTC-PERP',
      szDecimals: 3,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 20,
      onlyIsolated: false,
    },
    {
      name: 'ETH-PERP',
      szDecimals: 3,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 15,
      onlyIsolated: false,
    },
    {
      name: 'SOL-PERP',
      szDecimals: 2,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 10,
      onlyIsolated: false,
    },
  ];

  const mockPerps = [
    {
      name: 'BTC-PERP',
      token: 'BTC',
      platform: Platform.HYPERLIQUID,
    },
    {
      name: 'ETH-PERP',
      token: 'ETH',
      platform: Platform.HYPERLIQUID,
    },
    {
      name: 'SOL-PERP',
      token: 'SOL',
      platform: Platform.HYPERLIQUID,
    },
  ];

  const mockTickers = {
    BTC: {
      coin: 'BTC',
      bid: '50000.00',
      ask: '50001.00',
      last: '50000.50',
      mark: '50000.50',
      volume24h: '1000000',
      openInterest: '500000',
      fundingRate: '0.0001',
    },
    ETH: {
      coin: 'ETH',
      bid: '3000.00',
      ask: '3001.00',
      last: '3000.50',
      mark: '3000.50',
      volume24h: '500000',
      openInterest: '250000',
      fundingRate: '0.0002',
    },
    SOL: {
      coin: 'SOL',
      bid: '100.00',
      ask: '100.10',
      last: '100.05',
      mark: '100.05',
      volume24h: '200000',
      openInterest: '100000',
      fundingRate: '0.0003',
    },
  };

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockHyperliquidService = {
      getMarkets: jest.fn(),
      getTicker: jest.fn(),
    } as any;

    mockPerpService = {
      findByToken: jest.fn(),
      getPerpsForTrading: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HyperliquidTokenDiscoveryService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HyperliquidService,
          useValue: mockHyperliquidService,
        },
        {
          provide: PerpService,
          useValue: mockPerpService,
        },
      ],
    }).compile();

    service = module.get<HyperliquidTokenDiscoveryService>(
      HyperliquidTokenDiscoveryService,
    );

    // Setup default mocks
    mockConfigService.get.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct platform', () => {
      expect(service.platform).toBe(Platform.HYPERLIQUID);
    });

    it('should initialize with empty cache', () => {
      expect((service as any).marketsCache).toEqual([]);
      expect((service as any).lastFetch).toBe(0);
    });
  });

  describe('getTokensToTrade', () => {
    it('should return active tokens when enabled', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'ETH', 'SOL']);
      expect(mockPerpService.getPerpsForTrading).toHaveBeenCalledWith(
        Platform.HYPERLIQUID,
      );
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
    });

    it('should return empty array when disabled', async () => {
      mockConfigService.get.mockReturnValue(false);

      const result = await service.getTokensToTrade();

      expect(result).toEqual([]);
      expect(mockPerpService.getPerpsForTrading).not.toHaveBeenCalled();
      expect(mockHyperliquidService.getMarkets).not.toHaveBeenCalled();
    });

    it('should use cached markets if within TTL', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      // First call
      await service.getTokensToTrade();
      jest.clearAllMocks();

      // Second call should use cache
      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'ETH', 'SOL']);
      expect(mockPerpService.getPerpsForTrading).not.toHaveBeenCalled();
      expect(mockHyperliquidService.getMarkets).not.toHaveBeenCalled();
    });

    it('should refetch markets after cache expires', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      // First call
      await service.getTokensToTrade();

      // Expire cache by setting lastFetch to past and clearing cache array
      (service as any).lastFetch = Date.now() - 400000;
      (service as any).marketsCache = []; // Clear the cache array
      jest.clearAllMocks();

      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      // Second call should refetch
      await service.getTokensToTrade();

      expect(mockPerpService.getPerpsForTrading).toHaveBeenCalledWith(
        Platform.HYPERLIQUID,
      );
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockPerpService.getPerpsForTrading.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service.getTokensToTrade();
      expect(result).toEqual([]);
    });

    it('should skip perps without active markets on Hyperliquid', async () => {
      const perpsWithMissing = [
        ...mockPerps,
        {
          name: 'ADA-PERP',
          token: 'ADA',
          platform: Platform.HYPERLIQUID,
        },
      ];

      mockPerpService.getPerpsForTrading.mockResolvedValue(
        perpsWithMissing as any,
      );
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      // ADA should be skipped because it doesn't have a market on Hyperliquid
      expect(result).toEqual(['BTC', 'ETH', 'SOL']);
    });

    it('should skip inactive markets', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce({
          ...mockTickers.ETH,
          bid: '0',
          ask: '0',
        }) // Inactive market
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'SOL']);
    });

    it('should skip markets with wide spreads', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue(mockPerps as any);
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce({
          ...mockTickers.ETH,
          bid: '3000.00',
          ask: '3500.00', // 16.67% spread - too wide
        })
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'SOL']);
    });

    it('should handle perps with descriptional names by constructing market name from symbol', async () => {
      const perpsWithDescriptionalNames = [
        {
          name: 'Bitcoin Perpetual', // Descriptional name
          token: 'BTC',
          platform: Platform.HYPERLIQUID,
        },
        {
          name: 'Cardano', // Descriptional name
          token: 'ADA',
          platform: Platform.HYPERLIQUID,
        },
      ];

      const marketsWithAda = [
        ...mockMarkets,
        {
          name: 'ADA-PERP',
          szDecimals: 2,
          pxDecimals: 8,
          minSize: 0.00001,
          maxLeverage: 10,
          onlyIsolated: false,
        },
      ];

      mockPerpService.getPerpsForTrading.mockResolvedValue(
        perpsWithDescriptionalNames as any,
      );
      mockHyperliquidService.getMarkets.mockResolvedValue(marketsWithAda);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC) // For BTC
        .mockResolvedValueOnce({
          // For ADA
          coin: 'ADA',
          bid: '0.50',
          ask: '0.51',
          last: '0.505',
          mark: '0.505',
          volume24h: '50000',
          openInterest: '25000',
          fundingRate: '0.0001',
        });

      const result = await service.getTokensToTrade();

      // Both should be found even though the perp names don't match market names
      // The service should construct the market name from symbols: BTC-PERP and ADA-PERP
      expect(result).toEqual(['BTC', 'ADA']);
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
      expect(mockHyperliquidService.getTicker).toHaveBeenCalledWith('BTC');
      expect(mockHyperliquidService.getTicker).toHaveBeenCalledWith('ADA');
    });
  });

  describe('getMarketStats', () => {
    it('should return market statistics for tokens', async () => {
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH);

      const result = await service.getMarketStats(['BTC', 'ETH']);

      expect(result).toEqual({
        BTC: {
          price: '50000.50',
          volume24h: '1000000',
          bid: '50000.00',
          ask: '50001.00',
          mark: '50000.50',
          openInterest: '500000',
          fundingRate: '0.0001',
          spread: '0.0020',
        },
        ETH: {
          price: '3000.50',
          volume24h: '500000',
          bid: '3000.00',
          ask: '3001.00',
          mark: '3000.50',
          openInterest: '250000',
          fundingRate: '0.0002',
          spread: '0.0333',
        },
      });
    });

    it('should fetch market stats for all tokens to trade if no symbols provided', async () => {
      mockPerpService.getPerpsForTrading.mockResolvedValue([
        mockPerps[0],
      ] as any);
      mockHyperliquidService.getMarkets.mockResolvedValue([mockMarkets[0]]);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.BTC);

      const result = await service.getMarketStats();

      expect(result).toEqual({
        BTC: {
          price: '50000.50',
          volume24h: '1000000',
          bid: '50000.00',
          ask: '50001.00',
          mark: '50000.50',
          openInterest: '500000',
          fundingRate: '0.0001',
          spread: '0.0020',
        },
      });
    });

    it('should handle ticker fetch errors gracefully', async () => {
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockRejectedValueOnce(new Error('Ticker not found'));

      const result = await service.getMarketStats(['BTC', 'ETH']);

      expect(result).toEqual({
        BTC: {
          price: '50000.50',
          volume24h: '1000000',
          bid: '50000.00',
          ask: '50001.00',
          mark: '50000.50',
          openInterest: '500000',
          fundingRate: '0.0001',
          spread: '0.0020',
        },
      });
    });
  });
});
