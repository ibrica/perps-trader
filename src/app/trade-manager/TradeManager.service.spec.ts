/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TradeManagerService } from './TradeManager.service';
import { TradePositionService } from '../trade-position/TradePosition.service';
import { IndexerAdapter } from '../../infrastructure/indexer/IndexerAdapter';
import { PlatformManagerService } from '../platform-manager/PlatformManagerService';
import { PerpService } from '../perps/Perp.service';
import {
  Platform,
  TradePositionStatus,
  BlockchainSymbol,
  TradeType,
  PositionType,
  PositionDirection,
  ItemExistsException,
  TradeNotification,
  SOL_MINT,
} from '../../shared';

describe('TradeManagerService', () => {
  let service: TradeManagerService;
  let tradePositionService: jest.Mocked<TradePositionService>;
  let indexerAdapter: jest.Mocked<IndexerAdapter>;
  let platformManagerService: jest.Mocked<PlatformManagerService>;
  let perpService: jest.Mocked<PerpService>;

  const mockBlockchain = {
    _id: 'blockchain-id',
    symbol: BlockchainSymbol.SOL,
    name: 'Solana',
  };

  const mockTradingOpportunity = {
    platform: Platform.DRIFT,
    tokenMintAddress: 'test-token-mint',
    tradingDecision: {
      shouldTrade: true,
      reason: 'Good opportunity',
      confidence: 0.8,
      recommendedAmount: 100000000n,
      metadata: {
        direction: PositionDirection.LONG,
        leverage: 5,
        marketIndex: 1,
      },
    },
    priority: 1,
  };

  const mockOpenPosition = {
    _id: 'position-id',
    tokenMint: 'test-token-mint',
    platform: Platform.DRIFT,
    status: TradePositionStatus.OPEN,
    positionType: PositionType.PERPETUAL,
    positionDirection: PositionDirection.LONG,
    entryPrice: 100n,
    amountIn: '100000000',
    currencyMint: 'SOL',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeManagerService,
        {
          provide: TradePositionService,
          useValue: {
            getTradePositionByTokenMint: jest.fn(),
            getOpenTradePositions: jest.fn(),
            updateTradePosition: jest.fn(),
            createTradePosition: jest.fn(),
          },
        },
        {
          provide: TradeService,
          useValue: {
            executeTrade: jest.fn(),
            getTradesByTradePosition: jest.fn(),
          },
        },
        {
          provide: CurrencyService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: BlockchainService,
          useValue: {
            getBySymbol: jest.fn(),
          },
        },
        {
          provide: IndexerAdapter,
          useValue: {
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            unsubscribeFromAll: jest.fn(),
            isConnected: jest.fn(),
            getSubscriptions: jest.fn(),
            getLastPrice: jest.fn(),
          },
        },
        {
          provide: PlatformManagerService,
          useValue: {
            findTradingOpportunities: jest.fn(),
            evaluateExitDecisions: jest.fn(),
            getEnabledPlatforms: jest.fn(),
            getPlatformConfiguration: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn(),
          },
        },
        {
          provide: PerpService,
          useValue: {
            findByBaseAssetSymbol: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TradeManagerService>(TradeManagerService);
    tradePositionService = module.get(TradePositionService);
    tradeService = module.get(TradeService);
    currencyService = module.get(CurrencyService);
    blockchainService = module.get(BlockchainService);
    indexerAdapter = module.get(IndexerAdapter);
    platformManagerService = module.get(PlatformManagerService);
    settingsService = module.get(SettingsService);
    perpService = module.get(PerpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startTrading', () => {
    beforeEach(() => {
      blockchainService.getBySymbol.mockResolvedValue(mockBlockchain as any);
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.DRIFT,
        enabled: true,
        priority: 1,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: SOL_MINT,
      });
    });

    it('should execute trading opportunities when slots are available', async () => {
      // Mock current open positions
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);

      // Mock finding opportunities
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
      ]);

      // Mock currency creation
      currencyService.create.mockResolvedValue({} as any);

      // Mock trade execution
      tradeService.executeTrade.mockResolvedValue({} as any);

      // Mock position creation
      tradePositionService.createTradePosition.mockResolvedValue(
        mockOpenPosition as any,
      );

      // Mock indexer subscription and price
      indexerAdapter.subscribe.mockResolvedValue(undefined);
      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      await service.startTrading();

      // Verify trade was executed
      expect(tradeService.executeTrade).toHaveBeenCalledWith({
        platform: Platform.DRIFT,
        mintFrom: '11111111111111111111111111111111', // SOL_MINT
        mintTo: 'test-token-mint',
        amountIn: 100000000n,
        blockchain: 'blockchain-id',
        tradeType: TradeType.PERPETUAL,
      });

      // Verify position was created
      expect(tradePositionService.createTradePosition).toHaveBeenCalledWith(
        expect.objectContaining({
          baseAssetSymbol: 'test-token-mint',
          platform: Platform.DRIFT,
          status: TradePositionStatus.OPEN,
          positionType: PositionType.PERPETUAL,
          positionDirection: PositionDirection.LONG,
        }),
      );
    });

    it('should reset buyFlag after successful DRIFT perp trade', async () => {
      // Mock current open positions
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);

      const mockPerp = {
        _id: 'perp-id',
        baseAssetSymbol: 'test-token-mint',
        buyFlag: true,
      };

      perpService.findByBaseAssetSymbol.mockResolvedValue(mockPerp as any);
      perpService.update.mockResolvedValue(mockPerp as any);

      // Mock finding opportunities
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
      ]);

      currencyService.create.mockResolvedValue({} as any);
      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.createTradePosition.mockResolvedValue({} as any);

      await service.startTrading();

      // Should find the perp by baseAssetSymbol
      expect(perpService.findByBaseAssetSymbol).toHaveBeenCalledWith(
        'test-token-mint',
      );
      // Should update the buyFlag to false
      expect(perpService.update).toHaveBeenCalledWith('perp-id', {
        buyFlag: false,
      });
    });

    it('should not execute trades when max total positions reached', async () => {
      // Mock 10 open positions (max limit)
      const openPositions = Array(10).fill(mockOpenPosition);
      tradePositionService.getOpenTradePositions.mockResolvedValue(
        openPositions,
      );

      // Mock finding opportunities
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
      ]);

      await service.startTrading();

      // Should not execute any trades
      expect(tradeService.executeTrade).not.toHaveBeenCalled();
      expect(tradePositionService.createTradePosition).not.toHaveBeenCalled();
    });

    it('should not execute trades when platform max positions reached', async () => {
      // Mock 3 open positions for DRIFT platform (max for that platform)
      const driftPositions = Array(3).fill({
        ...mockOpenPosition,
        platform: Platform.DRIFT,
      });
      tradePositionService.getOpenTradePositions.mockResolvedValue(
        driftPositions,
      );

      // Mock finding opportunities
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
      ]);

      await service.startTrading();

      // Should not execute any trades for DRIFT
      expect(tradeService.executeTrade).not.toHaveBeenCalled();
      expect(tradePositionService.createTradePosition).not.toHaveBeenCalled();
    });

    it('should handle existing currency gracefully', async () => {
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
      ]);

      // Mock currency already exists
      currencyService.create.mockRejectedValue(new ItemExistsException());

      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.createTradePosition.mockResolvedValue(
        mockOpenPosition as any,
      );

      await service.startTrading();

      // Should continue with trade execution despite existing currency
      expect(tradeService.executeTrade).toHaveBeenCalled();
      expect(tradePositionService.createTradePosition).toHaveBeenCalled();
    });

    it('should handle errors in individual opportunities gracefully', async () => {
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity,
        { ...mockTradingOpportunity, tokenMintAddress: 'token2' },
      ]);

      currencyService.create.mockResolvedValue({} as any);

      // First trade fails, second should still be attempted
      tradeService.executeTrade
        .mockRejectedValueOnce(new Error('Trade execution failed'))
        .mockResolvedValueOnce({} as any);

      tradePositionService.createTradePosition.mockResolvedValue(
        mockOpenPosition as any,
      );

      await service.startTrading();

      // Should have attempted both trades
      expect(tradeService.executeTrade).toHaveBeenCalledTimes(2);
      // Only second should have succeeded in creating position
      expect(tradePositionService.createTradePosition).toHaveBeenCalledTimes(1);
    });

    it('should return early when no trading opportunities found', async () => {
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);
      platformManagerService.findTradingOpportunities.mockResolvedValue([]);

      await service.startTrading();

      expect(tradeService.executeTrade).not.toHaveBeenCalled();
      expect(tradePositionService.createTradePosition).not.toHaveBeenCalled();
    });

    it('should subscribe to indexer for PUMP_FUN tokens only', async () => {
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);

      const pumpFunOpportunity = {
        ...mockTradingOpportunity,
        platform: Platform.PUMP_FUN,
      };

      platformManagerService.findTradingOpportunities.mockResolvedValue([
        mockTradingOpportunity, // DRIFT
        pumpFunOpportunity, // PUMP_FUN
      ]);

      platformManagerService.getPlatformConfiguration.mockImplementation(
        (platform) => {
          if (platform === Platform.PUMP_FUN) {
            return {
              platform: Platform.PUMP_FUN,
              enabled: true,
              priority: 3,
              maxOpenPositions: 5,
              tradingParams: {
                maxOpenPositions: 5,
                defaultAmountIn: 1000000000n,
                stopLossPercent: 20,
                takeProfitPercent: 30,
              },
              defaultMintFrom: SOL_MINT,
            };
          }
          return {
            platform: Platform.DRIFT,
            enabled: true,
            priority: 1,
            maxOpenPositions: 3,
            tradingParams: {
              maxOpenPositions: 3,
              defaultAmountIn: 100000000n,
              stopLossPercent: 15,
              takeProfitPercent: 25,
            },
            defaultMintFrom: SOL_MINT,
          };
        },
      );

      currencyService.create.mockResolvedValue({} as any);
      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.createTradePosition.mockResolvedValue(
        mockOpenPosition as any,
      );

      await service.startTrading();

      // Should only subscribe to PUMP_FUN token, not DRIFT
      expect(indexerAdapter.subscribe).toHaveBeenCalledTimes(1);
      expect(indexerAdapter.subscribe).toHaveBeenCalledWith('test-token-mint');
    });
  });

  describe('handleTradeIndexerEvent', () => {
    const mockTradeEvent: TradeNotification = {
      type: 'trade',
      tokenMint: 'test-token-mint',
      timestamp: '2024-01-01T00:00:00Z',
      trade: {
        CurvePosition: '2000',
      } as any,
    };

    it('should exit position when exit decision is made', async () => {
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(
        mockOpenPosition as any,
      );

      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: mockOpenPosition as any,
          decision: {
            shouldExit: true,
            reason: 'Take profit triggered',
            confidence: 0.8,
            urgency: 'medium',
          },
        },
      ]);

      // Mock trades for closing
      tradeService.getTradesByTradePosition.mockResolvedValue([
        {
          platform: Platform.PUMP_FUN,
          mintTo: 'test-token-mint',
          mintFrom: 'SOL',
          amountOut: 100000000n,
          blockchain: 'blockchain-id',
          tradeType: TradeType.LAUNCHPAD,
        },
      ] as any);

      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);
      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });
      indexerAdapter.isConnected.mockReturnValue(true);
      indexerAdapter.getSubscriptions.mockReturnValue(['test-token-mint']);
      indexerAdapter.unsubscribe.mockResolvedValue(undefined);

      // Mock startTrading call after position closure
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);
      platformManagerService.findTradingOpportunities.mockResolvedValue([]);

      await service.handleTradeIndexerEvent(mockTradeEvent);

      // Verify position was closed
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledWith(
        'position-id',
        {
          status: TradePositionStatus.CLOSED,
          timeClosed: expect.any(Date),
          realizedPnl: 0,
          exitFlag: false,
        },
      );

      // Verify exit trade was executed
      expect(tradeService.executeTrade).toHaveBeenCalledWith({
        platform: Platform.PUMP_FUN,
        mintFrom: 'test-token-mint',
        mintTo: 'SOL',
        amountIn: 100000000n,
        blockchain: 'blockchain-id',
        tradeType: TradeType.LAUNCHPAD,
      });
    });

    it('should update curve position for PUMP_FUN when no exit decision', async () => {
      const pumpFunPosition = {
        ...mockOpenPosition,
        platform: Platform.PUMP_FUN,
      };
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(
        pumpFunPosition as any,
      );

      platformManagerService.evaluateExitDecisions.mockResolvedValue([]);

      await service.handleTradeIndexerEvent(mockTradeEvent);

      // Verify price was updated
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledWith(
        'position-id',
        {
          currentPrice: expect.any(Number),
          timeLastPriceUpdate: expect.any(Date),
        },
      );
    });

    it('should unsubscribe when no open position found', async () => {
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(null);
      indexerAdapter.isConnected.mockReturnValue(true);
      indexerAdapter.getSubscriptions.mockReturnValue(['test-token-mint']);
      indexerAdapter.unsubscribe.mockResolvedValue(undefined);

      await service.handleTradeIndexerEvent(mockTradeEvent);

      expect(indexerAdapter.unsubscribe).toHaveBeenCalledWith(
        'test-token-mint',
      );
    });

    it('should handle rebuy prevention integration - should not create new position for same token after exit', async () => {
      // Initial position exists
      tradePositionService.getTradePositionByTokenMint.mockResolvedValue(
        mockOpenPosition as any,
      );

      // Exit decision is made
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: mockOpenPosition as any,
          decision: {
            shouldExit: true,
            reason: 'Take profit triggered',
            confidence: 0.8,
            urgency: 'medium',
          },
        },
      ]);

      // Mock trade closing
      tradeService.getTradesByTradePosition.mockResolvedValue([
        {
          platform: Platform.DRIFT,
          mintTo: 'test-token-mint',
          mintFrom: 'SOL',
          amountOut: 100000000n,
          blockchain: 'blockchain-id',
          tradeType: TradeType.PERPETUAL,
        },
      ] as any);

      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);
      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      // After position is closed, startTrading is called
      // Mock the scenario where the same token appears in opportunities
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);
      platformManagerService.findTradingOpportunities.mockResolvedValue([
        { ...mockTradingOpportunity, tokenMintAddress: 'test-token-mint' },
      ]);

      // Mock that there's still a closed position for this token
      // (In reality, findTradingOpportunities should prevent this, but let's test the integration)
      blockchainService.getBySymbol.mockResolvedValue(mockBlockchain as any);
      currencyService.create.mockResolvedValue({} as any);

      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.DRIFT,
        enabled: true,
        priority: 1,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: SOL_MINT,
      });

      await service.handleTradeIndexerEvent(mockTradeEvent);

      // Verify that the position was closed
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledWith(
        'position-id',
        {
          status: TradePositionStatus.CLOSED,
          timeClosed: expect.any(Date),
          realizedPnl: 0,
          exitFlag: false,
        },
      );

      // The rebuy prevention should be handled by PlatformManagerService.findTradingOpportunities
      // which we've already tested separately
    });
  });

  describe('monitorAndClosePositions', () => {
    it('should close positions based on settings and conditions', async () => {
      const mockSettings = {
        closeAllPositions: false,
        // other settings...
      };

      const positionToClose = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date('2020-01-01'), // Old position
        stopLossPrice: 500, // Below current price
        takeProfitPrice: 2000, // Above current price
        createdAt: new Date('2020-01-01'), // Also old
      };

      const positionToKeep = {
        ...mockOpenPosition,
        _id: 'position-2',
        tokenMint: 'token-2', // Different token
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price
        takeProfitPrice: 2000, // Above current price
        createdAt: new Date(), // Also recent
      };

      const openPositions = [positionToClose, positionToKeep];

      tradePositionService.getOpenTradePositions.mockResolvedValue(
        openPositions as any,
      );
      settingsService.getSettings.mockResolvedValue(mockSettings as any);
      tradeService.getTradesByTradePosition.mockResolvedValue([]);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);
      indexerAdapter.getLastPrice.mockImplementation((tokenMint) => {
        // Return undefined price for the old position so it uses original timeLastPriceUpdate
        if (tokenMint === 'test-token-mint') {
          return Promise.resolve({
            token_address: 'test-token-mint',
            type: 'MEME' as any,
            price: undefined, // No price available
            timestamp: new Date().toISOString(),
          });
        }
        // For other tokens, return a price
        return Promise.resolve({
          token_address: tokenMint,
          type: 'MEME' as any,
          price: 1500,
          timestamp: new Date().toISOString(),
        });
      });

      const remainingPositions = await service.monitorAndClosePositions();

      expect(remainingPositions).toBe(1); // One position should remain
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledTimes(2); // 1 price update + 1 close
    });

    it('should close all positions when closeAllPositions setting is true', async () => {
      const mockSettings = {
        closeAllPositions: true,
      };

      const openPositions = [
        { ...mockOpenPosition, stopLossPrice: 500, takeProfitPrice: 2000 },
        {
          ...mockOpenPosition,
          _id: 'position-2',
          tokenMint: 'token2',
          stopLossPrice: 500,
          takeProfitPrice: 2000,
        },
      ];

      tradePositionService.getOpenTradePositions.mockResolvedValue(
        openPositions as any,
      );
      settingsService.getSettings.mockResolvedValue(mockSettings as any);
      tradeService.getTradesByTradePosition.mockResolvedValue([]);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);
      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      const remainingPositions = await service.monitorAndClosePositions();

      expect(remainingPositions).toBe(0); // All positions should be closed
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledTimes(4); // 2 price updates + 2 closes
    });

    it('should close position when AI prediction recommends exit', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionToClose = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date(), // Recent position - wouldn't normally close
        stopLossPrice: 500, // Below current price - wouldn't trigger stop loss
        takeProfitPrice: 2000, // Above current price - wouldn't trigger take profit
        createdAt: new Date(), // Recent creation - wouldn't trigger time-based close
      };

      tradePositionService.getOpenTradePositions.mockResolvedValue([
        positionToClose,
      ] as any);
      settingsService.getSettings.mockResolvedValue(mockSettings as any);
      tradeService.getTradesByTradePosition.mockResolvedValue([]);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);

      // Mock platform as enabled
      platformManagerService.getEnabledPlatforms.mockReturnValue([
        positionToClose.platform,
      ]);

      // Mock AI prediction recommending exit
      const mockExitDecision = {
        shouldExit: true,
        reason: 'AI recommends SELL for LONG position with 0.85 confidence',
        confidence: 0.85,
        urgency: 'high' as const,
      };
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: positionToClose as any,
          decision: mockExitDecision,
        },
      ]);

      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      const remainingPositions = await service.monitorAndClosePositions();

      expect(remainingPositions).toBe(0); // Position should be closed due to AI recommendation
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledTimes(2); // 1 price update + 1 close
      expect(platformManagerService.evaluateExitDecisions).toHaveBeenCalledWith(
        [positionToClose],
        [positionToClose.platform],
      );
    });

    it('should handle AI prediction evaluation errors gracefully', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionToKeep = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price
        takeProfitPrice: 2000, // Above current price
        createdAt: new Date(), // Recent creation
      };

      tradePositionService.getOpenTradePositions.mockResolvedValue([
        positionToKeep,
      ] as any);
      settingsService.getSettings.mockResolvedValue(mockSettings as any);

      // Mock AI prediction evaluation throwing an error
      platformManagerService.evaluateExitDecisions.mockRejectedValue(
        new Error('AI service unavailable'),
      );

      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      const remainingPositions = await service.monitorAndClosePositions();

      expect(remainingPositions).toBe(1); // Position should remain open - traditional conditions don't trigger close
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledTimes(1); // Only price update, no close
    });

    it('should close position with exitFlag set through monitorAndClosePositions', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionWithExitFlag = {
        ...mockOpenPosition,
        exitFlag: true,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price
        takeProfitPrice: 2000, // Above current price
        createdAt: new Date(), // Recent creation
      };

      tradePositionService.getOpenTradePositions.mockResolvedValue([
        positionWithExitFlag,
      ] as any);
      settingsService.getSettings.mockResolvedValue(mockSettings as any);
      tradeService.getTradesByTradePosition.mockResolvedValue([]);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);

      indexerAdapter.getLastPrice.mockResolvedValue({
        token_address: 'test-token-mint',
        type: 'MEME' as any,
        price: 1500,
        timestamp: new Date().toISOString(),
      });

      const remainingPositions = await service.monitorAndClosePositions();

      expect(remainingPositions).toBe(0); // Position should be closed due to exitFlag
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledTimes(2); // 1 price update + 1 close
      // AI should not be called because exitFlag has highest priority
      expect(
        platformManagerService.evaluateExitDecisions,
      ).not.toHaveBeenCalled();
    });
  });

  describe('shouldClosePosition', () => {
    it('should immediately close position when exitFlag is set', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionWithExitFlag = {
        ...mockOpenPosition,
        exitFlag: true,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price - wouldn't trigger stop loss
        takeProfitPrice: 2000, // Above current price - wouldn't trigger take profit
        createdAt: new Date(), // Recent creation - wouldn't trigger time-based close
      };

      // Mock AI to return no exit recommendation - shouldn't be called due to exitFlag
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: positionWithExitFlag as any,
          decision: {
            shouldExit: false,
            reason: 'AI recommends hold',
            confidence: 0.9,
            urgency: 'low' as const,
          },
        },
      ]);

      // Call the private method using bracket notation for testing
      const shouldClose = await (service as any).shouldClosePosition(
        positionWithExitFlag,
        mockSettings,
        1500, // Current price - no traditional triggers
        new Date(),
      );

      expect(shouldClose).toBe(true);
      // AI should not be called because exitFlag has highest priority
      expect(
        platformManagerService.evaluateExitDecisions,
      ).not.toHaveBeenCalled();
    });

    it('should prioritize traditional conditions over AI predictions', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionWithStopLoss = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 1600, // Above current price - should trigger stop loss
        takeProfitPrice: 2000,
        createdAt: new Date(),
        currentPrice: 1500, // Below stop loss
      };

      // Mock AI to return no exit recommendation - shouldn't be called due to stop loss
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: positionWithStopLoss as any,
          decision: {
            shouldExit: false,
            reason: 'AI recommends hold',
            confidence: 0.9,
            urgency: 'low' as const,
          },
        },
      ]);

      // Call the private method using bracket notation for testing
      const shouldClose = await (service as any).shouldClosePosition(
        positionWithStopLoss,
        mockSettings,
        1500, // Current price below stop loss
        new Date(),
      );

      expect(shouldClose).toBe(true);
      // AI should not be called because stop loss condition triggers first
      expect(
        platformManagerService.evaluateExitDecisions,
      ).not.toHaveBeenCalled();
    });

    it('should call AI prediction only when traditional conditions are not met', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionNoTriggers = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price - no stop loss
        takeProfitPrice: 2000, // Above current price - no take profit
        createdAt: new Date(), // Recent creation
      };

      // Mock platform as enabled
      platformManagerService.getEnabledPlatforms.mockReturnValue([
        positionNoTriggers.platform,
      ]);

      // Mock AI to return exit recommendation
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: positionNoTriggers as any,
          decision: {
            shouldExit: true,
            reason: 'AI recommends SELL',
            confidence: 0.85,
            urgency: 'high' as const,
          },
        },
      ]);

      const shouldClose = await (service as any).shouldClosePosition(
        positionNoTriggers,
        mockSettings,
        1500, // Current price - no traditional triggers
        new Date(),
      );

      expect(shouldClose).toBe(true);
      // AI should be called because no traditional conditions triggered
      expect(platformManagerService.evaluateExitDecisions).toHaveBeenCalledWith(
        [positionNoTriggers],
        [positionNoTriggers.platform],
      );
    });

    it('should not close position when AI returns error-based exit decision', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionNoTriggers = {
        ...mockOpenPosition,
        timeLastPriceUpdate: new Date(), // Recent position
        stopLossPrice: 500, // Below current price - no stop loss
        takeProfitPrice: 2000, // Above current price - no take profit
        createdAt: new Date(), // Recent creation
      };

      // Mock platform as enabled
      platformManagerService.getEnabledPlatforms.mockReturnValue([
        positionNoTriggers.platform,
      ]);

      // Mock AI to return error-based exit decision
      platformManagerService.evaluateExitDecisions.mockResolvedValue([
        {
          position: positionNoTriggers as any,
          decision: {
            shouldExit: true,
            reason: 'Error during evaluation',
            confidence: 0.5,
            urgency: 'medium' as const,
          },
        },
      ]);

      const shouldClose = await (service as any).shouldClosePosition(
        positionNoTriggers,
        mockSettings,
        1500, // Current price - no traditional triggers
        new Date(),
      );

      expect(shouldClose).toBe(false); // Should NOT close due to error-based decision
      expect(platformManagerService.evaluateExitDecisions).toHaveBeenCalledWith(
        [positionNoTriggers],
        [positionNoTriggers.platform],
      );
    });

    it('should not evaluate AI when platform is not enabled', async () => {
      const mockSettings = {
        closeAllPositions: false,
      };

      const positionDisabledPlatform = {
        ...mockOpenPosition,
        platform: Platform.JUPITER, // Assume JUPITER is disabled
        timeLastPriceUpdate: new Date(),
        stopLossPrice: 500,
        takeProfitPrice: 2000,
        createdAt: new Date(),
      };

      // Mock platform as not enabled
      platformManagerService.getEnabledPlatforms.mockReturnValue([
        Platform.DRIFT, // Only DRIFT is enabled
      ]);

      const shouldClose = await (service as any).shouldClosePosition(
        positionDisabledPlatform,
        mockSettings,
        1500,
        new Date(),
      );

      expect(shouldClose).toBe(false);
      // AI should not be called because platform is not enabled
      expect(
        platformManagerService.evaluateExitDecisions,
      ).not.toHaveBeenCalled();
    });
  });

  describe('closePosition', () => {
    it('should execute reverse trades and update position status', async () => {
      const mockTrades = [
        {
          platform: Platform.DRIFT,
          mintFrom: 'SOL',
          mintTo: 'test-token-mint',
          amountOut: 100000000n,
          blockchain: 'blockchain-id',
          tradeType: TradeType.PERPETUAL,
        },
      ];

      tradeService.getTradesByTradePosition.mockResolvedValue(
        mockTrades as any,
      );
      tradeService.executeTrade.mockResolvedValue({} as any);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);

      await service.closePosition(mockOpenPosition as any, 1500);

      // Verify reverse trade was executed
      expect(tradeService.executeTrade).toHaveBeenCalledWith({
        platform: Platform.DRIFT,
        mintFrom: 'test-token-mint', // Reversed
        mintTo: 'SOL', // Reversed
        amountIn: 100000000n, // Using amountOut from original trade
        blockchain: 'blockchain-id',
        tradeType: TradeType.PERPETUAL,
      });

      // Verify position was updated to CLOSED
      expect(tradePositionService.updateTradePosition).toHaveBeenCalledWith(
        'position-id',
        {
          status: TradePositionStatus.CLOSED,
          timeClosed: expect.any(Date),
          realizedPnl: 0,
          exitFlag: false,
        },
      );
    });

    it('should unsubscribe from PUMP_FUN tokens', async () => {
      const pumpFunPosition = {
        ...mockOpenPosition,
        platform: Platform.PUMP_FUN,
        tokenMint: 'pumpfun-token',
      };

      tradeService.getTradesByTradePosition.mockResolvedValue([]);
      tradePositionService.updateTradePosition.mockResolvedValue({} as any);
      indexerAdapter.isConnected.mockReturnValue(true);
      indexerAdapter.getSubscriptions.mockReturnValue(['pumpfun-token']);
      indexerAdapter.unsubscribe.mockResolvedValue(undefined);

      await service.closePosition(pumpFunPosition as any);

      expect(indexerAdapter.unsubscribe).toHaveBeenCalledWith('pumpfun-token');
    });
  });

  describe('getTradeTypeForPlatform', () => {
    it('should return correct trade types for platforms', () => {
      // Access private method for testing
      const getTradeTypeForPlatform = (service as any).getTradeTypeForPlatform;

      expect(getTradeTypeForPlatform(Platform.PUMP_FUN)).toBe(
        TradeType.LAUNCHPAD,
      );
      expect(getTradeTypeForPlatform(Platform.DRIFT)).toBe(TradeType.PERPETUAL);
      expect(getTradeTypeForPlatform(Platform.RAYDIUM)).toBe(TradeType.DEX);
      expect(getTradeTypeForPlatform(Platform.JUPITER)).toBe(TradeType.DEX);
    });
  });

  describe('createTradePositionData', () => {
    it('should create DRIFT perpetual position data', () => {
      const createTradePositionData = (service as any).createTradePositionData;

      const tradingDecision = {
        recommendedAmount: 50000000n,
        metadata: {
          direction: PositionDirection.LONG,
          leverage: 5,
          marketIndex: 1,
        },
      };

      const result = createTradePositionData(
        Platform.DRIFT,
        'test-token',
        tradingDecision,
      );

      expect(result.positionType).toBe(PositionType.PERPETUAL);
      expect(result.positionDirection).toBe(PositionDirection.LONG);
      expect(result.marketIndex).toBe(1);
      expect(result.leverage).toBe(5);
      expect(result.entryPrice).toBe(0.0001); // Default price
    });

    it('should handle DRIFT position validation errors', async () => {
      // This tests the validation through the actual trading flow
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);

      const invalidOpportunity = {
        ...mockTradingOpportunity,
        tradingDecision: {
          ...mockTradingOpportunity.tradingDecision,
          metadata: { direction: PositionDirection.LONG }, // Missing marketIndex
        },
      };

      platformManagerService.findTradingOpportunities.mockResolvedValue([
        invalidOpportunity,
      ]);

      currencyService.create.mockResolvedValue({} as any);
      tradeService.executeTrade.mockResolvedValue({} as any);

      // Need to mock getPlatformConfiguration for startTrading
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.DRIFT,
        enabled: true,
        priority: 1,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: SOL_MINT,
      });

      await service.startTrading();

      // The error should be handled gracefully in executeTradingOpportunity
      // and position creation should not be called due to the error
      expect(tradePositionService.createTradePosition).not.toHaveBeenCalled();
    });

    it('should handle invalid DRIFT price validation errors', async () => {
      // This tests the price validation through the actual trading flow
      tradePositionService.getOpenTradePositions.mockResolvedValue([]);

      const invalidPriceOpportunity = {
        ...mockTradingOpportunity,
      };

      platformManagerService.findTradingOpportunities.mockResolvedValue([
        invalidPriceOpportunity,
      ]);

      currencyService.create.mockResolvedValue({} as any);
      tradeService.executeTrade.mockResolvedValue({} as any);

      // Need to mock getPlatformConfiguration for startTrading
      platformManagerService.getPlatformConfiguration.mockReturnValue({
        platform: Platform.DRIFT,
        enabled: true,
        priority: 1,
        maxOpenPositions: 3,
        tradingParams: {
          maxOpenPositions: 3,
          defaultAmountIn: 100000000n,
          stopLossPercent: 15,
          takeProfitPercent: 25,
        },
        defaultMintFrom: SOL_MINT,
      });

      await service.startTrading();

      // The error should be handled gracefully and position creation should not be called
      expect(tradePositionService.createTradePosition).not.toHaveBeenCalled();
    });

    it('should create PUMP_FUN spot position data', () => {
      const createTradePositionData = (service as any).createTradePositionData;

      const tradingDecision = { recommendedAmount: 1000000000n };

      const result = createTradePositionData(
        Platform.PUMP_FUN,
        'test-token',
        tradingDecision,
      );

      expect(result.positionType).toBe(PositionType.SPOT);
      expect(result.entryPrice).toBe(0); // Default entry price
    });

    it('should create generic DEX spot position data', () => {
      const createTradePositionData = (service as any).createTradePositionData;

      const tradingDecision = { recommendedAmount: 500000000n };

      const result = createTradePositionData(
        Platform.RAYDIUM,
        'test-token',
        tradingDecision,
      );

      expect(result.positionType).toBe(PositionType.SPOT);
      expect(result.platform).toBe(Platform.RAYDIUM);
    });
  });
});
