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

describe('PlatformManagerService', () => {
  let service: PlatformManagerService;
  let tradePositionService: jest.Mocked<TradePositionService>;

  const mockTokenDiscovery: jest.Mocked<PlatformTokenDiscoveryPort> = {
    platform: Platform.DRIFT,
    getActiveTokens: jest.fn(),
    isTokenTradeable: jest.fn(),
  };

  const mockTradingStrategy: jest.Mocked<PlatformTradingStrategyPort> = {
    platform: Platform.DRIFT,
    shouldEnterPosition: jest.fn(),
    shouldExitPosition: jest.fn(),
    getTakeProfitPrice: jest.fn(),
    getStopLossPrice: jest.fn(),
    getDefaultTradingParams: jest.fn(),
  };

  const mockPumpFunTokenDiscovery: jest.Mocked<PlatformTokenDiscoveryPort> = {
    platform: Platform.PUMP_FUN,
    getActiveTokens: jest.fn(),
    isTokenTradeable: jest.fn(),
  };

  const mockPumpFunTradingStrategy: jest.Mocked<PlatformTradingStrategyPort> = {
    platform: Platform.PUMP_FUN,
    shouldEnterPosition: jest.fn(),
    shouldExitPosition: jest.fn(),
    getTakeProfitPrice: jest.fn(),
    getStopLossPrice: jest.fn(),
    getDefaultTradingParams: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformManagerService,
        {
          provide: TradePositionService,
          useValue: {
            getTradePositionByTokenMint: jest.fn(),
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
        service.registerPlatform(mockTokenDiscovery, mockTradingStrategy);
      }).not.toThrow();

      expect(service.getAvailablePlatforms()).toContain(Platform.DRIFT);
    });

    it('should throw error when token discovery and trading strategy have different platforms', () => {
      const mismatchedStrategy = {
        ...mockTradingStrategy,
        platform: Platform.RAYDIUM,
      };

      expect(() => {
        service.registerPlatform(mockTokenDiscovery, mismatchedStrategy as any);
      }).toThrow('Platform mismatch');
    });
  });

  describe('getEnabledPlatforms', () => {
    it('should return only enabled platforms', () => {
      const enabledPlatforms = service.getEnabledPlatforms();

      // Based on the default configuration, only DRIFT is enabled
      expect(enabledPlatforms).toContain(Platform.DRIFT);
      expect(enabledPlatforms).not.toContain(Platform.PUMP_FUN);
      expect(enabledPlatforms).not.toContain(Platform.RAYDIUM);
      expect(enabledPlatforms).not.toContain(Platform.JUPITER);
    });
  });

  describe('findTradingOpportunities', () => {
    const mockActiveTokens: string[] = ['token1', 'token2'];

    beforeEach(() => {
      service.registerPlatform(mockTokenDiscovery, mockTradingStrategy);
      mockTokenDiscovery.getActiveTokens.mockResolvedValue(mockActiveTokens);
    });

    it('should find trading opportunities when no existing positions exist', async () => {
      // Mock no existing positions
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(null);

      // Mock trading decisions
      mockTradingStrategy.shouldEnterPosition
        .mockResolvedValueOnce({
          shouldTrade: true,
          reason: 'Good opportunity',
          confidence: 0.8,
          recommendedAmount: 100000000n,
          metadata: { direction: PositionDirection.LONG },
        })
        .mockResolvedValueOnce({
          shouldTrade: true,
          reason: 'Another good opportunity',
          confidence: 0.7,
          recommendedAmount: 50000000n,
          metadata: { direction: PositionDirection.LONG },
        });

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(2);
      expect(opportunities[0].tokenMintAddress).toBe('token1');
      expect(opportunities[1].tokenMintAddress).toBe('token2');
      expect(opportunities[0].tradingDecision.confidence).toBe(0.8);
      expect(opportunities[1].tradingDecision.confidence).toBe(0.7);
      expect(opportunities[0]).not.toHaveProperty('marketData');
      expect(opportunities[1]).not.toHaveProperty('marketData');
    });

    it('should skip tokens with existing open positions (rebuy prevention)', async () => {
      // Mock existing position for token1, but none for token2
      tradePositionService.getTradePositionByTokenMint.mockImplementation(
        (tokenMint: string) => {
          if (tokenMint === 'token1') {
            return Promise.resolve({
              _id: 'existing-position-id',
              tokenMint: 'token1',
              status: TradePositionStatus.OPEN,
              platform: Platform.DRIFT,
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
        recommendedAmount: 50000000n,
        metadata: { direction: PositionDirection.LONG },
      });

      const opportunities = await service.findTradingOpportunities();

      // Should only find opportunity for token2, token1 should be skipped
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].tokenMintAddress).toBe('token2');

      // Verify that getTradePositionByTokenMint was called for both tokens
      expect(
        tradePositionService.getTradePositionByTokenMint,
      ).toHaveBeenCalledTimes(2);
      expect(
        tradePositionService.getTradePositionByTokenMint,
      ).toHaveBeenCalledWith('token1', TradePositionStatus.OPEN);
      expect(
        tradePositionService.getTradePositionByTokenMint,
      ).toHaveBeenCalledWith('token2', TradePositionStatus.OPEN);

      // Verify shouldEnterPosition was only called for token2 (token1 was skipped)
      expect(mockTradingStrategy.shouldEnterPosition).toHaveBeenCalledTimes(1);
      expect(mockTradingStrategy.shouldEnterPosition).toHaveBeenCalledWith(
        'token2',
        expect.any(Object),
      );
    });

    it('should prevent rebuy across different platforms', async () => {
      // Register PUMP_FUN platform as well
      service.registerPlatform(
        mockPumpFunTokenDiscovery,
        mockPumpFunTradingStrategy,
      );

      // Enable PUMP_FUN for this test
      await service.updatePlatformConfiguration(Platform.PUMP_FUN, {
        enabled: true,
      });

      // Mock active tokens for both platforms
      mockPumpFunTokenDiscovery.getActiveTokens.mockResolvedValue([
        'token1', // Same token on different platform
      ]);

      // Mock existing position for token1 on DRIFT platform
      tradePositionService.getTradePositionByTokenMint.mockImplementation(
        (tokenMint: string) => {
          if (tokenMint === 'token1') {
            return Promise.resolve({
              _id: 'existing-position-id',
              tokenMint: 'token1',
              status: TradePositionStatus.OPEN,
              platform: Platform.DRIFT, // Existing position on DRIFT
            } as any);
          }
          return Promise.resolve(null);
        },
      );

      const opportunities = await service.findTradingOpportunities();

      // Should find no opportunities for token1 on any platform
      expect(
        opportunities.filter((op) => op.tokenMintAddress === 'token1'),
      ).toHaveLength(0);

      // Verify the existing position check was called for token1 on both platforms
      expect(
        tradePositionService.getTradePositionByTokenMint,
      ).toHaveBeenCalledWith('token1', TradePositionStatus.OPEN);
    });

    it('should not recommend trades when trading strategy returns shouldTrade: false', async () => {
      // Mock no existing positions
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(null);

      // Mock trading decisions that don't recommend trading
      mockTradingStrategy.shouldEnterPosition.mockResolvedValue({
        shouldTrade: false,
        reason: 'Low confidence',
        confidence: 0.3,
        recommendedAmount: 0n,
        metadata: { direction: PositionDirection.LONG },
      });

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(0);
    });

    it('should sort opportunities by priority and confidence', async () => {
      // Register multiple platforms with different priorities
      service.registerPlatform(
        mockPumpFunTokenDiscovery,
        mockPumpFunTradingStrategy,
      );
      await service.updatePlatformConfiguration(Platform.PUMP_FUN, {
        enabled: true,
        priority: 5,
      });

      // Mock active tokens for both platforms
      mockPumpFunTokenDiscovery.getActiveTokens.mockResolvedValue([
        'pumpfun_token',
      ]);

      // Mock no existing positions
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(null);

      // Mock trading decisions with different priorities and confidence
      mockTradingStrategy.shouldEnterPosition.mockResolvedValue({
        shouldTrade: true,
        reason: 'DRIFT opportunity',
        confidence: 0.9, // Higher confidence but lower platform priority
        recommendedAmount: 100000000n,
        metadata: { direction: PositionDirection.LONG },
      });

      mockPumpFunTradingStrategy.shouldEnterPosition.mockResolvedValue({
        shouldTrade: true,
        reason: 'PUMP_FUN opportunity',
        confidence: 0.6, // Lower confidence but higher platform priority
        recommendedAmount: 50000000n,
        metadata: { direction: PositionDirection.LONG },
      });

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(3); // 2 DRIFT + 1 PUMP_FUN
      // PUMP_FUN should be first due to higher priority (5 vs 1)
      expect(opportunities[0].platform).toBe(Platform.PUMP_FUN);
    });

    it('should handle errors gracefully and continue processing other platforms', async () => {
      // Make getActiveTokens throw an error
      mockTokenDiscovery.getActiveTokens.mockRejectedValue(
        new Error('Network error'),
      );

      const opportunities = await service.findTradingOpportunities();

      expect(opportunities).toHaveLength(0);
      // Should not throw, error should be logged
    });
  });

  describe('evaluateExitDecisions', () => {
    const mockOpenPosition = {
      _id: 'position-id',
      tokenMint: 'token1',
      platform: Platform.DRIFT,
      status: TradePositionStatus.OPEN,
      positionType: PositionType.PERPETUAL,
      positionDirection: PositionDirection.LONG,
      entryPrice: 100n,
    } as any;

    beforeEach(() => {
      service.registerPlatform(mockTokenDiscovery, mockTradingStrategy);
    });

    it('should evaluate exit decisions for open positions', async () => {
      mockTradingStrategy.shouldExitPosition.mockResolvedValue({
        shouldExit: true,
        reason: 'Stop loss triggered',
        confidence: 0.9,
        urgency: 'high',
      });

      const exitDecisions = await service.evaluateExitDecisions([
        mockOpenPosition,
      ]);

      expect(exitDecisions).toHaveLength(1);
      expect(exitDecisions[0].decision.shouldExit).toBe(true);
      expect(exitDecisions[0].decision.reason).toBe('Stop loss triggered');
      expect(exitDecisions[0].position).toBe(mockOpenPosition);
    });

    it('should handle trading strategy that does not recommend exit', async () => {
      mockTradingStrategy.shouldExitPosition.mockResolvedValue({
        shouldExit: false,
        reason: 'Position remains favorable',
        confidence: 0.5,
        urgency: 'low',
      });

      const exitDecisions = await service.evaluateExitDecisions([
        mockOpenPosition,
      ]);

      expect(exitDecisions).toHaveLength(0);
    });

    it('should sort exit decisions by urgency and confidence', async () => {
      const positions = [
        { ...mockOpenPosition, _id: 'pos1', tokenMint: 'token1' },
        { ...mockOpenPosition, _id: 'pos2', tokenMint: 'token2' },
      ];

      mockTradingStrategy.shouldExitPosition
        .mockResolvedValueOnce({
          shouldExit: true,
          reason: 'Medium urgency',
          confidence: 0.7,
          urgency: 'medium',
        })
        .mockResolvedValueOnce({
          shouldExit: true,
          reason: 'High urgency',
          confidence: 0.6,
          urgency: 'high',
        });

      const exitDecisions = await service.evaluateExitDecisions(
        positions as any,
      );

      expect(exitDecisions).toHaveLength(2);
      // High urgency should come first even with lower confidence
      expect(exitDecisions[0].decision.urgency).toBe('high');
      expect(exitDecisions[1].decision.urgency).toBe('medium');
    });
  });

  describe('getPlatformConfiguration', () => {
    it('should return configuration for existing platform', () => {
      const config = service.getPlatformConfiguration(Platform.DRIFT);

      expect(config).toBeDefined();
      expect(config.platform).toBe(Platform.DRIFT);
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
      await service.updatePlatformConfiguration(Platform.PUMP_FUN, {
        enabled: true,
        maxOpenPositions: 10,
      });

      const config = service.getPlatformConfiguration(Platform.PUMP_FUN);
      expect(config.enabled).toBe(true);
      expect(config.maxOpenPositions).toBe(10);
    });
  });

  describe('getTokenDiscoveryService and getTradingStrategyService', () => {
    beforeEach(() => {
      service.registerPlatform(mockTokenDiscovery, mockTradingStrategy);
    });

    it('should return registered services', () => {
      const tokenDiscovery = service.getTokenDiscoveryService(Platform.DRIFT);
      const tradingStrategy = service.getTradingStrategyService(Platform.DRIFT);

      expect(tokenDiscovery).toBe(mockTokenDiscovery);
      expect(tradingStrategy).toBe(mockTradingStrategy);
    });

    it('should throw error for unregistered platforms', () => {
      expect(() => {
        service.getTokenDiscoveryService(Platform.RAYDIUM);
      }).toThrow('Token discovery service not found for platform: RAYDIUM');

      expect(() => {
        service.getTradingStrategyService(Platform.RAYDIUM);
      }).toThrow('Trading strategy service not found for platform: RAYDIUM');
    });
  });
});
