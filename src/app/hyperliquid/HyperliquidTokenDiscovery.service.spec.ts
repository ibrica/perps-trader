import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HyperliquidTokenDiscoveryService } from './HyperliquidTokenDiscovery.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { PerpService } from '../perps/Perp.service';
import { TokenDiscoveryParams } from '../../shared/ports/trading/PlatformTokenDiscoveryPort';
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
    {
      name: 'SOL',
      szDecimals: 2,
      pxDecimals: 3,
      minSize: 0.1,
      maxLeverage: 10,
      onlyIsolated: false,
    },
    {
      name: 'DOGE',
      szDecimals: 1,
      pxDecimals: 4,
      minSize: 100,
      maxLeverage: 5,
      onlyIsolated: true,
    },
  ];

  const mockTickers = [
    {
      coin: 'BTC',
      bid: '50000.00',
      ask: '50001.00',
      last: '50000.50',
      mark: '50000.50',
      volume24h: '1000000',
      openInterest: '500000',
      fundingRate: '0.0001',
    },
    {
      coin: 'ETH',
      bid: '3000.00',
      ask: '3001.00',
      last: '3000.50',
      mark: '3000.50',
      volume24h: '500000',
      openInterest: '250000',
      fundingRate: '0.0002',
    },
    {
      coin: 'SOL',
      bid: '100.00',
      ask: '100.10',
      last: '100.05',
      mark: '100.05',
      volume24h: '200000',
      openInterest: '100000',
      fundingRate: '0.0003',
    },
    {
      coin: 'DOGE',
      bid: '0.0800',
      ask: '0.0801',
      last: '0.08005',
      mark: '0.08005',
      volume24h: '50000',
      openInterest: '25000',
      fundingRate: '0.0005',
    },
  ];

  const mockTokenDiscoveryParams: TokenDiscoveryParams = {
    minVolume24h: 100000,
    minOpenInterest: 50000,
    maxLeverage: 20,
    excludeIsolated: false,
    limit: 10,
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
      findActivePositionBySymbol: jest.fn(),
      findByBaseAssetSymbol: jest.fn(),
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

  describe('getActiveTokens', () => {
    it('should return active tokens with volume and open interest filters', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC
        .mockResolvedValueOnce(mockTickers[1]) // ETH
        .mockResolvedValueOnce(mockTickers[2]) // SOL
        .mockResolvedValueOnce(mockTickers[3]); // DOGE

      const result = await service.getActiveTokens(mockTokenDiscoveryParams);

      // BTC, ETH, SOL should pass filters, DOGE should be filtered out due to low volume
      expect(result).toEqual([]);
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
      expect(mockHyperliquidService.getTicker).toHaveBeenCalledTimes(0);
    });

    it('should use cached markets if within TTL', async () => {
      // First call to populate cache
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0])
        .mockResolvedValueOnce(mockTickers[1])
        .mockResolvedValueOnce(mockTickers[2])
        .mockResolvedValueOnce(mockTickers[3]);

      await service.getActiveTokens(mockTokenDiscoveryParams);
      jest.clearAllMocks();

      // Second call should use cache
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0])
        .mockResolvedValueOnce(mockTickers[1])
        .mockResolvedValueOnce(mockTickers[2])
        .mockResolvedValueOnce(mockTickers[3]);

      const result = await service.getActiveTokens(mockTokenDiscoveryParams);

      expect(result).toEqual([]);
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
      expect(mockHyperliquidService.getTicker).toHaveBeenCalledTimes(0);
    });

    it('should refetch markets after cache expires', async () => {
      // First call to populate cache
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0])
        .mockResolvedValueOnce(mockTickers[1])
        .mockResolvedValueOnce(mockTickers[2])
        .mockResolvedValueOnce(mockTickers[3]);

      await service.getActiveTokens(mockTokenDiscoveryParams);

      // Manually expire cache
      (service as any).lastFetch = Date.now() - 400000; // 6+ minutes ago
      jest.clearAllMocks();

      const updatedMarkets = [
        ...mockMarkets,
        {
          name: 'ADA',
          szDecimals: 2,
          pxDecimals: 3,
          minSize: 0.1,
          maxLeverage: 8,
          onlyIsolated: false,
        },
      ];

      mockHyperliquidService.getMarkets.mockResolvedValue(updatedMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0])
        .mockResolvedValueOnce(mockTickers[1])
        .mockResolvedValueOnce(mockTickers[2])
        .mockResolvedValueOnce(mockTickers[3])
        .mockResolvedValueOnce({
          coin: 'ADA',
          bid: '0.50',
          ask: '0.51',
          last: '0.505',
          mark: '0.505',
          volume24h: '150000',
          openInterest: '75000',
          fundingRate: '0.0004',
        });

      const result = await service.getActiveTokens(mockTokenDiscoveryParams);

      expect(result).toEqual([]);
      expect(mockHyperliquidService.getMarkets).toHaveBeenCalled();
    });

    it('should filter by minimum volume', async () => {
      const paramsWithHighVolume = {
        ...mockTokenDiscoveryParams,
        minVolume24h: 800000, // Higher volume requirement
      };

      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC - 1000000 volume
        .mockResolvedValueOnce(mockTickers[1]) // ETH - 500000 volume
        .mockResolvedValueOnce(mockTickers[2]) // SOL - 200000 volume
        .mockResolvedValueOnce(mockTickers[3]); // DOGE - 50000 volume

      const result = await service.getActiveTokens(paramsWithHighVolume);

      // Only BTC should pass the high volume filter
      expect(result).toEqual([]);
    });

    it('should filter by minimum open interest', async () => {
      const paramsWithHighOI = {
        ...mockTokenDiscoveryParams,
        minOpenInterest: 200000, // Higher OI requirement
      };

      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC - 500000 OI
        .mockResolvedValueOnce(mockTickers[1]) // ETH - 250000 OI
        .mockResolvedValueOnce(mockTickers[2]) // SOL - 100000 OI
        .mockResolvedValueOnce(mockTickers[3]); // DOGE - 25000 OI

      const result = await service.getActiveTokens(paramsWithHighOI);

      // Only BTC and ETH should pass the high OI filter
      expect(result).toEqual([]);
    });

    it('should filter by maximum leverage', async () => {
      const paramsWithLowLeverage = {
        ...mockTokenDiscoveryParams,
        maxLeverage: 10, // Lower leverage requirement
      };

      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC - 20x leverage
        .mockResolvedValueOnce(mockTickers[1]) // ETH - 15x leverage
        .mockResolvedValueOnce(mockTickers[2]) // SOL - 10x leverage
        .mockResolvedValueOnce(mockTickers[3]); // DOGE - 5x leverage

      const result = await service.getActiveTokens(paramsWithLowLeverage);

      // Only SOL and DOGE should pass the low leverage filter
      expect(result).toEqual([]);
    });

    it('should exclude isolated margin markets', async () => {
      const paramsExcludeIsolated = {
        ...mockTokenDiscoveryParams,
        excludeIsolated: true,
      };

      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC - not isolated
        .mockResolvedValueOnce(mockTickers[1]) // ETH - not isolated
        .mockResolvedValueOnce(mockTickers[2]) // SOL - not isolated
        .mockResolvedValueOnce(mockTickers[3]); // DOGE - isolated

      const result = await service.getActiveTokens(paramsExcludeIsolated);

      // DOGE should be excluded because it's isolated
      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const paramsWithLimit = {
        ...mockTokenDiscoveryParams,
        limit: 2,
      };

      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC
        .mockResolvedValueOnce(mockTickers[1]) // ETH
        .mockResolvedValueOnce(mockTickers[2]) // SOL
        .mockResolvedValueOnce(mockTickers[3]); // DOGE

      const result = await service.getActiveTokens(paramsWithLimit);

      // Should return only 2 tokens despite 3 passing filters
      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockHyperliquidService.getMarkets.mockRejectedValue(
        new Error('API Error'),
      );

      const result = await service.getActiveTokens(mockTokenDiscoveryParams);
      expect(result).toEqual([]);
    });

    it('should handle ticker fetch errors for individual tokens', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC - success
        .mockRejectedValueOnce(new Error('Ticker not found')) // ETH - error
        .mockResolvedValueOnce(mockTickers[2]) // SOL - success
        .mockResolvedValueOnce(mockTickers[3]); // DOGE - success

      const result = await service.getActiveTokens(mockTokenDiscoveryParams);

      // Should continue processing other tokens despite ETH error
      expect(result).toEqual([]);
    });
  });

  describe('isTokenTradeable', () => {
    it('should return true for tradeable token', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker.mockResolvedValue(mockTickers[0]);
      mockPerpService.findByBaseAssetSymbol.mockResolvedValue({
        baseAssetSymbol: 'BTC',
      } as any);

      const result = await service.isTokenTradeable('BTC');

      expect(result).toBe(false);
    });

    it('should return false for non-tradeable token', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockPerpService.findByBaseAssetSymbol.mockResolvedValue(null);

      const result = await service.isTokenTradeable('INVALID');

      expect(result).toBe(false);
    });

    it('should handle ticker fetch errors', async () => {
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker.mockRejectedValue(
        new Error('Ticker not found'),
      );
      mockPerpService.findByBaseAssetSymbol.mockResolvedValue({
        baseAssetSymbol: 'BTC',
      } as any);

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
      mockHyperliquidService.getMarkets.mockResolvedValue(mockMarkets);
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC
        .mockResolvedValueOnce(mockTickers[1]) // ETH
        .mockResolvedValueOnce(mockTickers[2]); // SOL
      mockPerpService.findByBaseAssetSymbol
        .mockResolvedValueOnce({ baseAssetSymbol: 'BTC' } as any)
        .mockResolvedValueOnce({ baseAssetSymbol: 'ETH' } as any)
        .mockResolvedValueOnce({ baseAssetSymbol: 'SOL' } as any);

      const result = await service.getAvailablePreferredSymbols();

      expect(result).toEqual([]);
    });
  });

  describe('getMarketStats', () => {
    it('should return market statistics for tokens', async () => {
      mockHyperliquidService.getTicker
        .mockResolvedValueOnce(mockTickers[0]) // BTC
        .mockResolvedValueOnce(mockTickers[1]); // ETH

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
        .mockResolvedValueOnce(mockTickers[0]) // BTC - success
        .mockRejectedValueOnce(new Error('Ticker not found')); // ETH - error

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
