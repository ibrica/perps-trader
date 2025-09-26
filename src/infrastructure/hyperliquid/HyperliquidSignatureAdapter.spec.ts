import { ethers } from 'ethers';
import { HyperliquidSignatureAdapter } from './HyperliquidSignatureAdapter';
import { HL_HEADERS } from '../../shared/constants2/hyperliquid';

describe('HyperliquidSignatureAdapter', () => {
  let adapter: HyperliquidSignatureAdapter;
  let mockWallet: jest.Mocked<ethers.Wallet>;

  const testPrivateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const testPublicAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';

  beforeEach(async () => {
    // Mock ethers wallet
    mockWallet = {
      address: testPublicAddress,
      signMessage: jest.fn(),
      _signTypedData: jest.fn(),
    } as any;

    // Mock ethers.Wallet constructor
    jest.spyOn(ethers, 'Wallet').mockImplementation(() => mockWallet);

    // Create adapter directly without NestJS module
    adapter = new HyperliquidSignatureAdapter(testPrivateKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create wallet with provided private key', () => {
      expect(ethers.Wallet).toHaveBeenCalledWith(testPrivateKey);
    });

    it('should set public address to lowercase', () => {
      expect(adapter.getPublicAddress()).toBe(testPublicAddress.toLowerCase());
    });
  });

  describe('getPublicAddress', () => {
    it('should return the public address', () => {
      const address = adapter.getPublicAddress();
      expect(address).toBe(testPublicAddress.toLowerCase());
    });
  });

  describe('signRequest', () => {
    const mockSignature = '0x1234567890abcdef';
    const mockTimestamp = 1234567890000;
    const mockNonce = 'test-nonce-123';

    beforeEach(() => {
      mockWallet.signMessage.mockResolvedValue(mockSignature);
    });

    it('should sign a GET request without body', async () => {
      const input = {
        method: 'GET' as const,
        path: '/api/v1/markets',
        query: { limit: 10 },
      };

      const result = await adapter.signRequest(input);

      expect(result.headers).toEqual({
        [HL_HEADERS.SIGNATURE]: mockSignature,
        [HL_HEADERS.TIMESTAMP]: expect.any(String),
        [HL_HEADERS.ADDRESS]: testPublicAddress.toLowerCase(),
        [HL_HEADERS.NONCE]: expect.any(String),
      });

      expect(result.timestampMs).toBeGreaterThan(0);
      expect(result.nonce).toBeDefined();
      expect(mockWallet.signMessage).toHaveBeenCalledWith(
        expect.stringContaining('GET:/api/v1/markets'),
      );
    });

    it('should sign a POST request with body', async () => {
      const input = {
        method: 'POST' as const,
        path: '/api/v1/orders',
        body: { symbol: 'BTC', side: 'buy', amount: 1 },
        timestampMs: mockTimestamp,
        nonce: mockNonce,
      };

      const result = await adapter.signRequest(input);

      expect(result.headers).toEqual({
        [HL_HEADERS.SIGNATURE]: mockSignature,
        [HL_HEADERS.TIMESTAMP]: mockTimestamp.toString(),
        [HL_HEADERS.ADDRESS]: testPublicAddress.toLowerCase(),
        [HL_HEADERS.NONCE]: mockNonce,
        [HL_HEADERS.CONTENT_TYPE]: 'application/json',
      });

      expect(result.timestampMs).toBe(mockTimestamp);
      expect(result.nonce).toBe(mockNonce);
      expect(mockWallet.signMessage).toHaveBeenCalledWith(
        expect.stringContaining('POST:/api/v1/orders'),
      );
    });

    it('should sign a DELETE request', async () => {
      const input = {
        method: 'DELETE' as const,
        path: '/api/v1/orders/123',
      };

      const result = await adapter.signRequest(input);

      expect(result.headers).toEqual({
        [HL_HEADERS.SIGNATURE]: mockSignature,
        [HL_HEADERS.TIMESTAMP]: expect.any(String),
        [HL_HEADERS.ADDRESS]: testPublicAddress.toLowerCase(),
        [HL_HEADERS.NONCE]: expect.any(String),
      });

      expect(mockWallet.signMessage).toHaveBeenCalledWith(
        expect.stringContaining('DELETE:/api/v1/orders/123'),
      );
    });

    it('should handle signing errors', async () => {
      const signingError = new Error('Signing failed');
      mockWallet.signMessage.mockRejectedValue(signingError);

      const input = {
        method: 'GET' as const,
        path: '/api/v1/markets',
      };

      await expect(adapter.signRequest(input)).rejects.toThrow(
        'Signing failed',
      );
    });
  });

  describe('buildCanonicalMessage', () => {
    it('should build message with all components', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/orders',
        query: { limit: 10, offset: 0 },
        body: { symbol: 'BTC' },
        timestampMs: 1234567890000,
        nonce: 'test-nonce',
      };

      // Access private method through any cast for testing
      const message = (adapter as any).buildCanonicalMessage(params);

      expect(message).toContain('1234567890000');
      expect(message).toContain('POST');
      expect(message).toContain('/api/v1/orders');
      expect(message).toContain('limit=10');
      expect(message).toContain('offset=0');
      expect(message).toContain('test-nonce');
    });

    it('should handle empty query parameters', () => {
      const params = {
        method: 'GET',
        path: '/api/v1/markets',
        timestampMs: 1234567890000,
      };

      const message = (adapter as any).buildCanonicalMessage(params);

      expect(message).toContain('1234567890000:GET:/api/v1/markets::');
    });

    it('should handle empty body', () => {
      const params = {
        method: 'POST',
        path: '/api/v1/orders',
        timestampMs: 1234567890000,
      };

      const message = (adapter as any).buildCanonicalMessage(params);

      expect(message).toContain('1234567890000:POST:/api/v1/orders::');
    });

    it('should sort query parameters', () => {
      const params = {
        method: 'GET',
        path: '/api/v1/markets',
        query: { z: 'last', a: 'first', m: 'middle' },
        timestampMs: 1234567890000,
      };

      const message = (adapter as any).buildCanonicalMessage(params);

      expect(message).toContain('a=first&m=middle&z=last');
    });

    it('should hash JSON body', () => {
      const body = { symbol: 'BTC', amount: 1 };
      const params = {
        method: 'POST',
        path: '/api/v1/orders',
        body,
        timestampMs: 1234567890000,
      };

      const message = (adapter as any).buildCanonicalMessage(params);

      // Should contain a hash of the JSON body
      expect(message).toMatch(
        /1234567890000:POST:\/api\/v1\/orders::[a-f0-9]{64}/,
      );
    });

    it('should handle string body', () => {
      const body = '{"symbol":"BTC","amount":1}';
      const params = {
        method: 'POST',
        path: '/api/v1/orders',
        body,
        timestampMs: 1234567890000,
      };

      const message = (adapter as any).buildCanonicalMessage(params);

      expect(message).toMatch(
        /1234567890000:POST:\/api\/v1\/orders::[a-f0-9]{64}/,
      );
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const nonce1 = (adapter as any).generateNonce();
      const nonce2 = (adapter as any).generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    });
  });

  describe('constructTypedData', () => {
    it('should construct EIP-712 typed data structure', () => {
      const message = 'test message';
      const typedData = (adapter as any).constructTypedData(message);

      expect(typedData).toEqual({
        domain: {
          name: 'Hyperliquid',
          version: '1',
          chainId: 1337,
        },
        types: {
          Message: [
            { name: 'content', type: 'string' },
            { name: 'timestamp', type: 'uint256' },
            { name: 'nonce', type: 'string' },
          ],
        },
        primaryType: 'Message',
        value: {
          content: message,
          timestamp: expect.any(Number),
          nonce: expect.any(String),
        },
      });
    });
  });
});
