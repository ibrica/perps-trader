/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { IndexerAdapter } from './IndexerAdapter';

describe('IndexerAdapter', () => {
  let adapter: IndexerAdapter;
  const testHost = 'localhost';
  const testApiPort = 7071;
  const testTokenMint = 'AWcvL1GSNX8VDLm1nFWzB9u2o4guAmXM341imLaHpump';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: IndexerAdapter,
          useFactory: () => new IndexerAdapter(testHost, testApiPort),
        },
      ],
    }).compile();

    adapter = module.get<IndexerAdapter>(IndexerAdapter);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('getLastPrice', () => {
    it('should fetch last price for a token', async () => {
      // Arrange
      const mockResponse = {
        token_symbol: testTokenMint,
        type: 'meme' as const,
        position: '500000000',
        timestamp: '2024-01-15T10:30:45.123Z',
      };

      // Mock the global fetch function
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Act
      const result = await adapter.getLastPrice(testTokenMint);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `http://${testHost}:${testApiPort}/last-price?token-symbol=${testTokenMint}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Token not found' }),
      } as Response);

      // Act & Assert
      await expect(adapter.getLastPrice(testTokenMint)).rejects.toThrow(
        'HTTP 404: Not Found',
      );
    });

    it('should handle network errors', async () => {
      // Arrange
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(adapter.getLastPrice(testTokenMint)).rejects.toThrow(
        'Network error',
      );
    });
  });
});
