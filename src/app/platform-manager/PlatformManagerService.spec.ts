/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformManagerService } from './PlatformManagerService';
import { TradePositionService } from '../trade-position/TradePosition.service';
import {
  Platform,
  TradePositionStatus,
  PositionDirection,
  PositionType,
} from '../../shared';
import { PlatformTokenDiscoveryPort } from '../../shared/ports/trading/PlatformTokenDiscoveryPort';
import { PlatformTradingStrategyPort } from '../../shared/ports/trading/PlatformTradingStrategyPort';
import { BasePlatformService } from '../../infrastructure';

describe('PlatformManagerService', () => {
  let service: PlatformManagerService;
  let tradePositionService: jest.Mocked<TradePositionService>;

  const mockTokenDiscovery: jest.Mocked<PlatformTokenDiscoveryPort> = {
    platform: Platform.HYPERLIQUID,
    getTokensToTrade: jest.fn(),
    isTokenTradeable: jest.fn(),
  };

  const mockTradingStrategy: jest.Mocked<PlatformTradingStrategyPort> = {
    platform: Platform.HYPERLIQUID,
    shouldEnterPosition: jest.fn(),
    shouldExitPosition: jest.fn(),
    getTakeProfitPrice: jest.fn(),
    getStopLossPrice: jest.fn(),
    getDefaultTradingParams: jest.fn(),
  };

  const mockPlatformService: jest.Mocked<BasePlatformService> = {
    enterPosition: jest.fn(),
    exitPosition: jest.fn(),
    createStopLossAndTakeProfitOrders: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformManagerService,
        {
          provide: TradePositionService,
          useValue: {
            getTradePositionByToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlatformManagerService>(PlatformManagerService);
    tradePositionService = module.get(TradePositionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerPlatform', () => {
    it('should register platform when token discovery and trading strategy have same platform', () => {
      expect(() => {
        service.registerPlatform(
          mockTokenDiscovery,
          mockTradingStrategy,
          mockPlatformService,
        );
      }).not.toThrow();

      expect(service.getAvailablePlatforms()).toContain(Platform.HYPERLIQUID);
    });

    it('should throw error when token discovery and trading strategy have different platforms', () => {
      const mismatchedTokenDiscovery = {
        ...mockTokenDiscovery,
        platform: Platform.DRIFT,
      };

      expect(() => {
        service.registerPlatform(
          mismatchedTokenDiscovery as any,
          mockTradingStrategy,
          mockPlatformService,
        );
      }).toThrow('Platform mismatch');
    });
  });

  describe('getEnabledPlatforms', () => {
    it('should return only enabled platforms', () => {
      const enabledPlatforms = service.getEnabledPlatforms();
      expect(enabledPlatforms).toContain(Platform.HYPERLIQUID);
      expect(enabledPlatforms).not.toContain(Platform.DRIFT);
    });
  });

  describe('findTradingOpportunities', () => {
    const mockActiveTokens: string[] = ['token1', 'token2'];

    beforeEach(() => {
      service.registerPlatform(
        mockTokenDiscovery,
        mockTradingStrategy,
        mockPlatformService,
      );
      mockTokenDiscovery.getTokensToTrade.mockResolvedValue(mockActiveTokens);
    });

    it('should find trading opportunities when no existing positions exist', async () => {
      // Mock no existing positions
      tradePositionService.getTradePositionByToken.mockResolvedValue(null);

      // Mock trading decisions
      mockTradingStrategy.shouldEnterPosition
        .mockResolvedValueOnce({
          shouldTrade: true,
          reason: 'Good opportunity',
          confidence: 0.8,
          recommendedAmount: 100,
          metadata: { direction: PositionDirection.LONG },
        })
        .mockResolvedValueOnce({
          shouldTrade: true,
          reason: 'Another good opportunity',
          confidence: 0.7,
          recommendedAmount: 50,
          metadata: { direction: PositionDirection.LONG },
        });

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(2);
      expect(opportunities[0].token).toBe('token1');
      expect(opportunities[1].token).toBe('token2');
      expect(opportunities[0].tradingDecision.confidence).toBe(0.8);
      expect(opportunities[1].tradingDecision.confidence).toBe(0.7);
      expect(opportunities[0]).not.toHaveProperty('marketData');
      expect(opportunities[1]).not.toHaveProperty('marketData');
    });

    it('should skip tokens with existing open positions (rebuy prevention)', async () => {
      // Mock existing position for token1, but none for token2
      tradePositionService.getTradePositionByToken.mockImplementation(
        (token: string) => {
          if (token === 'token1') {
            return Promise.resolve({
              _id: 'existing-position-id',
              token: 'token1',
              status: TradePositionStatus.OPEN,
              platform: Platform.HYPERLIQUID,
            } as any);
          }
          return Promise.resolve(null);
        },
      );

      // Mock trading decision for token2 (token1 should be skipped)
      mockTradingStrategy.shouldEnterPosition.mockResolvedValue({
        shouldTrade: true,
        reason: 'Good opportunity',
        confidence: 0.7,
        recommendedAmount: 50,
        metadata: { direction: PositionDirection.LONG },
      });

      const opportunities = await service.findTradingOpportunities();

      // Should only find opportunity for token2, token1 should be skipped
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].token).toBe('token2');

      // Verify that getTradePositionByToken was called for both tokens
      expect(
        tradePositionService.getTradePositionByToken,
      ).toHaveBeenCalledTimes(2);
      expect(tradePositionService.getTradePositionByToken).toHaveBeenCalledWith(
        'token1',
        TradePositionStatus.OPEN,
      );
      expect(tradePositionService.getTradePositionByToken).toHaveBeenCalledWith(
        'token2',
        TradePositionStatus.OPEN,
      );

      // Verify shouldEnterPosition was only called for token2 (token1 was skipped)
      expect(mockTradingStrategy.shouldEnterPosition).toHaveBeenCalledTimes(1);
      expect(mockTradingStrategy.shouldEnterPosition).toHaveBeenCalledWith(
        'token2',
        expect.any(Object),
      );
    });

    it('should not recommend trades when trading strategy returns shouldTrade: false', async () => {
      // Mock no existing positions
      tradePositionService.getTradePositionByToken.mockResolvedValue(null);

      // Mock trading decisions that don't recommend trading
      mockTradingStrategy.shouldEnterPosition.mockResolvedValue({
        shouldTrade: false,
        reason: 'Low confidence',
        confidence: 0.3,
        recommendedAmount: 0,
        metadata: { direction: PositionDirection.LONG },
      });

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(0);
    });

    it('should handle errors gracefully and continue processing other platforms', async () => {
      // Make getTokensToTrade throw an error
      mockTokenDiscovery.getTokensToTrade.mockRejectedValue(
        new Error('Network error'),
      );

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(0);
      // Should not throw, error should be logged
    });
  });

  describe('evaluateExitDecision', () => {
    const mockOpenPosition = {
      _id: 'position-id',
      token: 'token1',
      platform: Platform.HYPERLIQUID,
      status: TradePositionStatus.OPEN,
      positionType: PositionType.PERPETUAL,
      positionDirection: PositionDirection.LONG,
      entryPrice: 100,
    } as any;

    beforeEach(() => {
      service.registerPlatform(
        mockTokenDiscovery,
        mockTradingStrategy,
        mockPlatformService,
      );
    });

    it('should evaluate exit decision for open position', async () => {
      mockTradingStrategy.shouldExitPosition.mockResolvedValue({
        shouldExit: true,
        reason: 'Stop loss triggered',
        confidence: 0.9,
        urgency: 'high',
      });

      const exitDecision = await service.evaluateExitDecision(mockOpenPosition);

      expect(exitDecision.shouldExit).toBe(true);
      expect(exitDecision.reason).toBe('Stop loss triggered');
    });

    it('should handle trading strategy that does not recommend exit', async () => {
      mockTradingStrategy.shouldExitPosition.mockResolvedValue({
        shouldExit: false,
        reason: 'Position remains favorable',
        confidence: 0.5,
        urgency: 'low',
      });

      const exitDecision = await service.evaluateExitDecision(mockOpenPosition);

      expect(exitDecision.shouldExit).toBe(false);
    });

    it('should return exit decision with urgency', async () => {
      mockTradingStrategy.shouldExitPosition.mockResolvedValue({
        shouldExit: true,
        reason: 'High urgency',
        confidence: 0.6,
        urgency: 'high',
      });

      const exitDecision = await service.evaluateExitDecision(mockOpenPosition);

      expect(exitDecision.shouldExit).toBe(true);
      expect(exitDecision.urgency).toBe('high');
    });
  });

  describe('getPlatformConfiguration', () => {
    it('should return configuration for existing platform', () => {
      const config = service.getPlatformConfiguration(Platform.HYPERLIQUID);

      expect(config).toBeDefined();
      expect(config.platform).toBe(Platform.HYPERLIQUID);
      expect(config.enabled).toBe(true);
    });

    it('should throw error for non-existent platform', () => {
      expect(() => {
        service.getPlatformConfiguration('UNKNOWN_PLATFORM' as Platform);
      }).toThrow('Platform configuration not found');
    });
  });

  describe('updatePlatformConfiguration', () => {
    it('should update platform configuration', async () => {
      await service.updatePlatformConfiguration(Platform.HYPERLIQUID, {
        enabled: false,
        tradingParams: {
          maxOpenPositions: 10,
          defaultAmountIn: 200,
          stopLossPercent: 20,
          takeProfitPercent: 30,
        },
      });

      const config = service.getPlatformConfiguration(Platform.HYPERLIQUID);
      expect(config.enabled).toBe(false);
      expect(config.tradingParams?.maxOpenPositions).toBe(10);
    });
  });

  describe('getTokenDiscoveryService and getTradingStrategyService', () => {
    beforeEach(() => {
      service.registerPlatform(
        mockTokenDiscovery,
        mockTradingStrategy,
        mockPlatformService,
      );
    });

    it('should return registered services', () => {
      const tokenDiscovery = service.getTokenDiscoveryService(
        Platform.HYPERLIQUID,
      );
      const tradingStrategy = service.getTradingStrategyService(
        Platform.HYPERLIQUID,
      );

      expect(tokenDiscovery).toBe(mockTokenDiscovery);
      expect(tradingStrategy).toBe(mockTradingStrategy);
    });

    it('should throw error for unregistered platforms', () => {
      expect(() => {
        service.getTokenDiscoveryService(Platform.DRIFT);
      }).toThrow('Token discovery service not found for platform: DRIFT');

      expect(() => {
        service.getTradingStrategyService(Platform.DRIFT);
      }).toThrow('Trading strategy service not found for platform: DRIFT');
    });
  });

  describe('createStopLossAndTakeProfitOrders', () => {
    beforeEach(() => {
      service.registerPlatform(
        mockTokenDiscovery,
        mockTradingStrategy,
        mockPlatformService,
      );
    });

    it('delegates to the platform service implementation', async () => {
      await service.createStopLossAndTakeProfitOrders(
        Platform.HYPERLIQUID,
        'SOL',
        PositionDirection.LONG,
        10,
        'position-id',
        90,
        120,
      );

      expect(
        mockPlatformService.createStopLossAndTakeProfitOrders,
      ).toHaveBeenCalledWith(
        'SOL',
        PositionDirection.LONG,
        10,
        'position-id',
        90,
        120,
      );
    });
  });
});
