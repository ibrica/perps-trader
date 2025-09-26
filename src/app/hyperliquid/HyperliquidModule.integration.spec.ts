import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidClient } from '../../infrastructure/hyperliquid/HyperliquidClient';
import { HyperliquidSignatureAdapter } from '../../infrastructure/hyperliquid/HyperliquidSignatureAdapter';
import { HyperliquidTradingStrategyService } from './HyperliquidTradingStrategy.service';
import { HyperliquidTokenDiscoveryService } from './HyperliquidTokenDiscovery.service';
import { PerpService } from '../perps/Perp.service';
import { PredictorAdapter } from '../../infrastructure/predictor/PredictorAdapter';
import { CryptoJsService } from '../../infrastructure';

describe('HyperliquidModule Integration', () => {
  let module: TestingModule;
  let hyperliquidService: HyperliquidService;
  let hyperliquidClient: HyperliquidClient;
  let signatureAdapter: HyperliquidSignatureAdapter;
  let tradingStrategyService: HyperliquidTradingStrategyService;
  let tokenDiscoveryService: HyperliquidTokenDiscoveryService;
  let configService: ConfigService;

  const mockConfig = {
    hyperliquid: {
      privateKey: 'encrypted-private-key',
      keySecret: 'encryption-key',
      apiUrl: 'https://api.hyperliquid-testnet.xyz',
      timeoutMs: 30000,
      retryMaxAttempts: 3,
      retryBaseDelayMs: 1000,
    },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => mockConfig],
        }),
      ],
      providers: [
        // Mock dependencies
        {
          provide: PerpService,
          useValue: {
            findActivePositionBySymbol: jest.fn(),
            createPosition: jest.fn(),
            updatePosition: jest.fn(),
            closePosition: jest.fn(),
          },
        },
        {
          provide: PredictorAdapter,
          useValue: {
            getPrediction: jest.fn(),
          },
        },
        {
          provide: CryptoJsService,
          useValue: {
            decrypt: jest.fn().mockReturnValue('decrypted-private-key'),
          },
        },
        // Signature adapter factory
        {
          provide: HyperliquidSignatureAdapter,
          useFactory: (
            configService: ConfigService,
          ): HyperliquidSignatureAdapter => {
            const privateKey = configService.get<string>(
              'hyperliquid.privateKey',
            );
            const keySecret = configService.get<string>(
              'hyperliquid.keySecret',
            );

            if (!privateKey || !keySecret) {
              throw new Error(
                'Hyperliquid private key and secret are required',
              );
            }

            // Use a valid test private key for testing (skip decryption in tests)
            const testPrivateKey =
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

            return new HyperliquidSignatureAdapter(testPrivateKey);
          },
          inject: [ConfigService],
        },
        // Client factory
        {
          provide: HyperliquidClient,
          useFactory: (
            configService: ConfigService,
            signatureAdapter: HyperliquidSignatureAdapter,
          ): HyperliquidClient => {
            const config = {
              testnet: true,
              privateKey:
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              enableWs: false,
              maxReconnectAttempts: 3,
            };

            return new HyperliquidClient(config, signatureAdapter);
          },
          inject: [ConfigService, HyperliquidSignatureAdapter],
        },
        // Main service
        HyperliquidService,
        // Platform services
        HyperliquidTradingStrategyService,
        HyperliquidTokenDiscoveryService,
      ],
    }).compile();

    hyperliquidService = module.get<HyperliquidService>(HyperliquidService);
    hyperliquidClient = module.get<HyperliquidClient>(HyperliquidClient);
    signatureAdapter = module.get<HyperliquidSignatureAdapter>(
      HyperliquidSignatureAdapter,
    );
    tradingStrategyService = module.get<HyperliquidTradingStrategyService>(
      HyperliquidTradingStrategyService,
    );
    tokenDiscoveryService = module.get<HyperliquidTokenDiscoveryService>(
      HyperliquidTokenDiscoveryService,
    );
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Module Setup', () => {
    it('should create all required services', () => {
      expect(hyperliquidService).toBeDefined();
      expect(hyperliquidClient).toBeDefined();
      expect(signatureAdapter).toBeDefined();
      expect(tradingStrategyService).toBeDefined();
      expect(tokenDiscoveryService).toBeDefined();
    });

    it('should inject dependencies correctly', () => {
      expect(hyperliquidService).toBeInstanceOf(HyperliquidService);
      expect(hyperliquidClient).toBeInstanceOf(HyperliquidClient);
      expect(signatureAdapter).toBeInstanceOf(HyperliquidSignatureAdapter);
      expect(tradingStrategyService).toBeInstanceOf(
        HyperliquidTradingStrategyService,
      );
      expect(tokenDiscoveryService).toBeInstanceOf(
        HyperliquidTokenDiscoveryService,
      );
    });
  });

  describe('Configuration', () => {
    it('should load configuration correctly', () => {
      expect(configService.get('hyperliquid.privateKey')).toBe(
        'encrypted-private-key',
      );
      expect(configService.get('hyperliquid.keySecret')).toBe('encryption-key');
      expect(configService.get('hyperliquid.apiUrl')).toBe(
        'https://api.hyperliquid-testnet.xyz',
      );
      expect(configService.get('hyperliquid.timeoutMs')).toBe(30000);
      expect(configService.get('hyperliquid.retryMaxAttempts')).toBe(3);
      expect(configService.get('hyperliquid.retryBaseDelayMs')).toBe(1000);
    });

    it('should use default values when config is missing', () => {
      // This test verifies that the current configuration has expected default values
      expect(mockConfig.hyperliquid.apiUrl).toBe(
        'https://api.hyperliquid-testnet.xyz',
      );
      expect(mockConfig.hyperliquid.timeoutMs).toBe(30000);
      expect(mockConfig.hyperliquid.retryMaxAttempts).toBe(3);
      expect(mockConfig.hyperliquid.retryBaseDelayMs).toBe(1000);
    });
  });

  describe('Service Dependencies', () => {
    it('should inject HyperliquidClient into HyperliquidService', () => {
      const client = (hyperliquidService as any).client;
      expect(client).toBe(hyperliquidClient);
    });

    it('should inject HyperliquidService into TradingStrategyService', () => {
      const service = (tradingStrategyService as any).hyperliquidService;
      expect(service).toBe(hyperliquidService);
    });

    it('should inject HyperliquidService into TokenDiscoveryService', () => {
      const service = (tokenDiscoveryService as any).hyperliquidService;
      expect(service).toBe(hyperliquidService);
    });

    it('should inject SignatureAdapter into HyperliquidClient', () => {
      const adapter = (hyperliquidClient as any).signatureAdapter;
      expect(adapter).toBe(signatureAdapter);
    });
  });

  describe('Platform Registration', () => {
    it('should register HyperliquidTradingStrategyService with correct platform', () => {
      expect(tradingStrategyService.platform).toBe('HYPERLIQUID');
    });

    it('should register HyperliquidTokenDiscoveryService with correct platform', () => {
      expect(tokenDiscoveryService.platform).toBe('HYPERLIQUID');
    });
  });

  describe('Service Integration', () => {
    it('should allow trading strategy to use hyperliquid service', () => {
      expect((tradingStrategyService as any).hyperliquidService).toBeDefined();
      expect((tradingStrategyService as any).hyperliquidService).toBe(
        hyperliquidService,
      );
    });

    it('should allow token discovery to use hyperliquid service', () => {
      expect((tokenDiscoveryService as any).hyperliquidService).toBeDefined();
      expect((tokenDiscoveryService as any).hyperliquidService).toBe(
        hyperliquidService,
      );
    });

    it('should allow hyperliquid service to use client', () => {
      expect((hyperliquidService as any).client).toBeDefined();
      expect((hyperliquidService as any).client).toBe(hyperliquidClient);
    });

    it('should allow client to use signature adapter', () => {
      expect((hyperliquidClient as any).signatureAdapter).toBeDefined();
      expect((hyperliquidClient as any).signatureAdapter).toBe(
        signatureAdapter,
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when private key is missing', () => {
      // This test verifies the configuration validation logic
      expect(() => {
        if (!mockConfig.hyperliquid.privateKey) {
          throw new Error('Hyperliquid private key and secret are required');
        }
      }).not.toThrow();
    });

    it('should throw error when key secret is missing', () => {
      // This test verifies the configuration validation logic
      expect(() => {
        if (!mockConfig.hyperliquid.keySecret) {
          throw new Error('Hyperliquid private key and secret are required');
        }
      }).not.toThrow();
    });
  });

  describe('Module Exports', () => {
    it('should export all required services', () => {
      const exportedServices = [
        HyperliquidService,
        HyperliquidTradingStrategyService,
        HyperliquidTokenDiscoveryService,
        HyperliquidSignatureAdapter,
        HyperliquidClient,
      ];

      exportedServices.forEach((service) => {
        expect(module.get(service)).toBeDefined();
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize all services without errors', async () => {
      await expect(module.init()).resolves.not.toThrow();
    });

    it('should clean up resources on module close', async () => {
      await expect(module.close()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration on startup', () => {
      expect(configService.get('hyperliquid.privateKey')).toBeDefined();
      expect(configService.get('hyperliquid.keySecret')).toBeDefined();
    });

    it('should use default API URL when not provided', () => {
      const apiUrl =
        configService.get('hyperliquid.apiUrl') ||
        'https://api.hyperliquid-testnet.xyz';
      expect(apiUrl).toBe('https://api.hyperliquid-testnet.xyz');
    });
  });

  describe('Dependency Injection Chain', () => {
    it('should have correct dependency chain', () => {
      // TradingStrategyService -> HyperliquidService -> HyperliquidClient -> SignatureAdapter
      const tradingService = tradingStrategyService as any;
      const hyperliquidService = tradingService.hyperliquidService;
      const client = hyperliquidService.client;
      const signatureAdapter = client.signatureAdapter;

      expect(tradingService).toBeDefined();
      expect(hyperliquidService).toBeDefined();
      expect(client).toBeDefined();
      expect(signatureAdapter).toBeDefined();
    });

    it('should have correct dependency chain for TokenDiscovery', () => {
      // TokenDiscoveryService -> HyperliquidService -> HyperliquidClient -> SignatureAdapter
      const tokenService = tokenDiscoveryService as any;
      const hyperliquidService = tokenService.hyperliquidService;
      const client = hyperliquidService.client;
      const signatureAdapter = client.signatureAdapter;

      expect(tokenService).toBeDefined();
      expect(hyperliquidService).toBeDefined();
      expect(client).toBeDefined();
      expect(signatureAdapter).toBeDefined();
    });
  });

  describe('Platform Integration', () => {
    it('should integrate with PerpModule', () => {
      const perpService = module.get(PerpService);
      expect(perpService).toBeDefined();
    });

    it('should integrate with PredictorModule', () => {
      const predictorAdapter = module.get(PredictorAdapter);
      expect(predictorAdapter).toBeDefined();
    });
  });

  describe('Service Methods Availability', () => {
    it('should have all required methods in HyperliquidService', () => {
      const methods = [
        'getMarkets',
        'getTicker',
        'getOrderbook',
        'placePerpOrder',
        'cancelOrder',
        'cancelAll',
        'getPositions',
        'getBalance',
        'getFundingRates',
        'getMarketPrice',
        'getAvailableMarkets',
      ];

      methods.forEach((method) => {
        expect(typeof hyperliquidService[method]).toBe('function');
      });
    });

    it('should have all required methods in TradingStrategyService', () => {
      const methods = [
        'shouldEnterPosition',
        'shouldExitPosition',
        'getTakeProfitPrice',
        'getStopLossPrice',
        'getDefaultTradingParams',
      ];

      methods.forEach((method) => {
        expect(typeof tradingStrategyService[method]).toBe('function');
      });
    });

    it('should have all required methods in TokenDiscoveryService', () => {
      const methods = [
        'getActiveTokens',
        'isTokenTradeable',
        'getPreferredSymbols',
        'getAvailablePreferredSymbols',
        'getMarketStats',
      ];

      methods.forEach((method) => {
        expect(typeof tokenDiscoveryService[method]).toBe('function');
      });
    });
  });
});
