import { Test, TestingModule } from '@nestjs/testing';
import {
  HyperliquidClient,
  HyperliquidClientConfig,
  HyperliquidError,
} from './HyperliquidClient';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';
import { Tif } from 'hyperliquid';

// Mock the hyperliquid SDK
jest.mock('hyperliquid', () => ({
  Hyperliquid: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    info: {
      perpetuals: {
        getMeta: jest.fn(),
        getMetaAndAssetCtxs: jest.fn(),
        getClearinghouseState: jest.fn(),
        getFundingHistory: jest.fn(),
      },
      getAllMids: jest.fn(),
      getL2Book: jest.fn(),
      getUserOpenOrders: jest.fn(),
      getUserFills: jest.fn(),
    },
    exchange: {
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      updateLeverage: jest.fn(),
    },
    isAuthenticated: jest.fn().mockReturnValue(true),
  })),
}));

describe('HyperliquidClient', () => {
  let client: HyperliquidClient;
  let mockSignatureAdapter: jest.Mocked<HyperliquidSignatureAdapter>;
  let config: HyperliquidClientConfig;

  beforeEach(async () => {
    config = {
      testnet: true,
      privateKey:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      enableWs: false,
      maxReconnectAttempts: 3,
    };

    mockSignatureAdapter = {
      signRequest: jest.fn(),
      getPublicAddress: jest
        .fn()
        .mockReturnValue('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: HyperliquidClient,
          useFactory: () => new HyperliquidClient(config, mockSignatureAdapter),
        },
      ],
    }).compile();

    client = module.get<HyperliquidClient>(HyperliquidClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with correct config', () => {
      expect(client).toBeDefined();
      expect(client.getSdk()).toBeDefined();
    });
  });

  describe('getInfo', () => {
    it('should handle meta request', async () => {
      const mockMeta = { universe: [{ name: 'BTC', maxLeverage: 50 }] };
      const sdk = client.getSdk();
      (sdk.info.perpetuals.getMeta as jest.Mock).mockResolvedValue(mockMeta);

      const result = await client.getInfo('meta');
      expect(result).toEqual(mockMeta);
      expect(sdk.info.perpetuals.getMeta).toHaveBeenCalled();
    });

    it('should handle allMids request', async () => {
      const mockMids = { BTC: '50000.0', ETH: '3000.0' };
      const sdk = client.getSdk();
      (sdk.info.getAllMids as jest.Mock).mockResolvedValue(mockMids);

      const result = await client.getInfo('allMids');
      expect(result).toEqual(mockMids);
      expect(sdk.info.getAllMids).toHaveBeenCalled();
    });

    it('should handle userState request', async () => {
      const mockUserState = {
        assetPositions: [],
        marginSummary: { accountValue: '1000.0' },
      };
      const sdk = client.getSdk();
      (
        sdk.info.perpetuals.getClearinghouseState as jest.Mock
      ).mockResolvedValue(mockUserState);

      const result = await client.getInfo('userState', { user: '0x123' });
      expect(result).toEqual(mockUserState);
      expect(sdk.info.perpetuals.getClearinghouseState).toHaveBeenCalledWith(
        '0x123',
      );
    });

    it('should throw error for unsupported info type', async () => {
      await expect(client.getInfo('unsupportedType' as any)).rejects.toThrow(
        HyperliquidError,
      );
    });

    it('should throw error for userState without user parameter', async () => {
      await expect(client.getInfo('userState' as any)).rejects.toThrow(
        'User parameter required for userState',
      );
    });
  });

  describe('exchangeAction', () => {
    it('should handle order placement', async () => {
      const mockOrderResponse = {
        status: 'ok',
        response: { data: { statuses: [{ resting: { oid: 123 } }] } },
      };
      const sdk = client.getSdk();
      (sdk.exchange.placeOrder as jest.Mock).mockResolvedValue(
        mockOrderResponse,
      );

      const orderAction = {
        type: 'order' as const,
        order: {
          coin: 'BTC',
          is_buy: true,
          sz: '0.1',
          limit_px: '50000',
          order_type: { limit: { tif: 'Gtc' as Tif } },
          reduce_only: false,
        },
      };

      const result = await client.exchangeAction(orderAction);
      expect(result).toEqual(mockOrderResponse);
      expect(sdk.exchange.placeOrder).toHaveBeenCalledWith(orderAction.order);
    });

    it('should handle order cancellation', async () => {
      const mockCancelResponse = { status: 'ok' };
      const sdk = client.getSdk();
      (sdk.exchange.cancelOrder as jest.Mock).mockResolvedValue(
        mockCancelResponse,
      );

      const cancelAction = {
        type: 'cancel' as const,
        cancels: [{ coin: 'BTC', o: 123 }],
      };

      const result = await client.exchangeAction(cancelAction);
      expect(result).toEqual(mockCancelResponse);
      expect(sdk.exchange.cancelOrder).toHaveBeenCalledWith(
        cancelAction.cancels,
      );
    });

    it('should throw error when not authenticated', async () => {
      const sdk = client.getSdk();
      (sdk.isAuthenticated as jest.Mock).mockReturnValue(false);

      const orderAction = { type: 'order' as any };

      await expect((client.exchangeAction as any)(orderAction)).rejects.toThrow(
        'Client not authenticated. Private key required for exchange actions.',
      );
    });

    it('should throw error for unsupported action type', async () => {
      const unsupportedAction = { type: 'unsupportedAction' as any };

      await expect(
        (client.exchangeAction as any)(unsupportedAction),
      ).rejects.toThrow('Unsupported action type: unsupportedAction');
    });
  });

  describe('isAuthenticated', () => {
    it('should return authentication status from SDK', () => {
      const sdk = client.getSdk();
      (sdk.isAuthenticated as jest.Mock).mockReturnValue(true);

      expect(client.isAuthenticated()).toBe(true);
      expect(sdk.isAuthenticated).toHaveBeenCalled();
    });
  });
});
