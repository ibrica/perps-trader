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
      name: 'BTC',
      szDecimals: 3,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 20,
      onlyIsolated: false,
    },
    {
      name: 'ETH',
      szDecimals: 3,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 15,
      onlyIsolated: false,
    },
    {
      name: 'SOL',
      szDecimals: 2,
      pxDecimals: 8,
      minSize: 0.00001,
      maxLeverage: 10,
      onlyIsolated: false,
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
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce({ token: 'ETH' } as any)
        .mockResolvedValueOnce({ token: 'SOL' } as any);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'ETH', 'SOL']);
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
    });

    it('should return empty array when disabled', async () => {
      mockConfigService.get.mockReturnValue(false);

      const result = await service.getTokensToTrade();

      expect(result).toEqual([]);
      expect(mockHyperliquidService.getMarkets).not.toHaveBeenCalled();
    });

    it('should use cached markets if within TTL', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce({ token: 'ETH' } as any)
        .mockResolvedValueOnce({ token: 'SOL' } as any);
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
      expect(mockHyperliquidService.getMarkets).not.toHaveBeenCalled();
    });

    it('should refetch markets after cache expires', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce({ token: 'ETH' } as any)
        .mockResolvedValueOnce({ token: 'SOL' } as any);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      // First call
      await service.getTokensToTrade();

      // Expire cache
      (service as any).lastFetch = Date.now() - 400000;
      jest.clearAllMocks();

      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce({ token: 'ETH' } as any)
        .mockResolvedValueOnce({ token: 'SOL' } as any);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      // Second call should refetch
      await service.getTokensToTrade();

      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockHyperliquidService.getMarkets.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service.getTokensToTrade();
      expect(result).toEqual([]);
    });

    it('should skip tokens without perp definitions', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce(null) // ETH has no perp
        .mockResolvedValueOnce({ token: 'SOL' } as any);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getTokensToTrade();

      expect(result).toEqual(['BTC', 'SOL']);
    });

    it('should skip inactive markets', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any)
        .mockResolvedValueOnce({ token: 'ETH' } as any)
        .mockResolvedValueOnce({ token: 'SOL' } as any);
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
  });

  describe('isTokenTradeable', () => {
    it('should return true for tradeable token', async () => {
      const marketsWithUSD = [
        { ...mockMarkets[0], name: 'BTC-USD' },
        { ...mockMarkets[1], name: 'ETH-USD' },
        { ...mockMarkets[2], name: 'SOL-USD' },
      ];
      mockHyperliquidService.getMarkets.mockResolvedValue(marketsWithUSD);
      mockPerpService.findByToken.mockResolvedValue({ token: 'BTC' } as any);
      mockHyperliquidService.getTicker.mockResolvedValue(mockTickers.BTC);

      const result = await service.isTokenTradeable('BTC');

      expect(result).toBe(true);
    });

    it('should return false when disabled', async () => {
      mockConfigService.get.mockReturnValue(false);

      const result = await service.isTokenTradeable('BTC');

      expect(result).toBe(false);
    });

    it('should return false for token without perp definition', async () => {
      mockPerpService.findByToken.mockResolvedValue(null);

      const result = await service.isTokenTradeable('INVALID');

      expect(result).toBe(false);
    });

    it('should return false for token not on Hyperliquid', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken.mockResolvedValue({ token: 'ADA' } as any);

      const result = await service.isTokenTradeable('ADA');

      expect(result).toBe(false);
    });

    it('should handle ticker fetch errors', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByToken.mockResolvedValue({ token: 'BTC' } as any);
      mockHyperliquidService.getTicker.mockRejectedValue(
        new Error('Ticker not found'),
      );

      const result = await service.isTokenTradeable('BTC');

      expect(result).toBe(false);
    });
  });

  describe('getPreferredSymbols', () => {
    it('should return preferred trading symbols', () => {
      const result = service.getPreferredSymbols();

      expect(result).toEqual([
        'BTC',
        'ETH',
        'SOL',
        'DOGE',
        'AVAX',
        'MATIC',
        'ATOM',
        'DOT',
        'UNI',
        'LINK',
      ]);
    });
  });

  describe('getAvailablePreferredSymbols', () => {
    it('should return available preferred symbols', async () => {
      const marketsWithUSD = [
        { ...mockMarkets[0], name: 'BTC-USD' },
        { ...mockMarkets[1], name: 'ETH-USD' },
        { ...mockMarkets[2], name: 'SOL-USD' },
      ];

      mockHyperliquidService.getMarkets.mockResolvedValue(marketsWithUSD);

      // Mock for all preferred symbols
      mockPerpService.findByToken
        .mockResolvedValueOnce({ token: 'BTC' } as any) // BTC
        .mockResolvedValueOnce({ token: 'ETH' } as any) // ETH
        .mockResolvedValueOnce({ token: 'SOL' } as any) // SOL
        .mockResolvedValueOnce(null) // DOGE
        .mockResolvedValueOnce(null) // AVAX
        .mockResolvedValueOnce(null) // MATIC
        .mockResolvedValueOnce(null) // ATOM
        .mockResolvedValueOnce(null) // DOT
        .mockResolvedValueOnce(null) // UNI
        .mockResolvedValueOnce(null); // LINK

      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers.BTC)
        .mockResolvedValueOnce(mockTickers.ETH)
        .mockResolvedValueOnce(mockTickers.SOL);

      const result = await service.getAvailablePreferredSymbols();

      expect(result).toEqual(['BTC', 'ETH', 'SOL']);
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
