import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtBlacklistService } from './JwtBlacklist.service';

describe('JwtBlacklistService', () => {
  let service: JwtBlacklistService;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    mockJwtService = {
      decode: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtBlacklistService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<JwtBlacklistService>(JwtBlacklistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addToBlacklist', () => {
    it('should add token to blacklist', () => {
      const token = 'test-jwt-token';

      service.addToBlacklist(token);

      expect(service.isBlacklisted(token)).toBe(true);
    });

    it('should allow multiple tokens in blacklist', () => {
      const token1 = 'token-1';
      const token2 = 'token-2';

      service.addToBlacklist(token1);
      service.addToBlacklist(token2);

      expect(service.isBlacklisted(token1)).toBe(true);
      expect(service.isBlacklisted(token2)).toBe(true);
    });
  });

  describe('isBlacklisted', () => {
    it('should return false for non-blacklisted token', () => {
      const token = 'non-blacklisted-token';

      expect(service.isBlacklisted(token)).toBe(false);
    });

    it('should return true for blacklisted token', () => {
      const token = 'blacklisted-token';
      service.addToBlacklist(token);

      expect(service.isBlacklisted(token)).toBe(true);
    });
  });

  describe('removeFromBlacklist', () => {
    it('should remove token from blacklist', () => {
      const token = 'test-token';
      service.addToBlacklist(token);

      expect(service.isBlacklisted(token)).toBe(true);

      service.removeFromBlacklist(token);

      expect(service.isBlacklisted(token)).toBe(false);
    });

    it('should not throw when removing non-existent token', () => {
      const token = 'non-existent-token';

      expect(() => service.removeFromBlacklist(token)).not.toThrow();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should remove expired tokens from blacklist', () => {
      const now = Date.now();
      const expiredToken = 'expired-token';
      const validToken = 'valid-token';

      // Mock expired token (expired 1 hour ago)
      mockJwtService.decode.mockImplementation((token: string) => {
        if (token === expiredToken) {
          return { exp: Math.floor((now - 3600000) / 1000) }; // 1 hour ago
        }
        if (token === validToken) {
          return { exp: Math.floor((now + 3600000) / 1000) }; // 1 hour from now
        }
        return null;
      });

      service.addToBlacklist(expiredToken);
      service.addToBlacklist(validToken);

      expect(service.isBlacklisted(expiredToken)).toBe(true);
      expect(service.isBlacklisted(validToken)).toBe(true);

      service.cleanupExpiredTokens();

      expect(service.isBlacklisted(expiredToken)).toBe(false);
      expect(service.isBlacklisted(validToken)).toBe(true);
    });

    it('should remove invalid tokens from blacklist', () => {
      const invalidToken = 'invalid-token';

      mockJwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      service.addToBlacklist(invalidToken);
      expect(service.isBlacklisted(invalidToken)).toBe(true);

      service.cleanupExpiredTokens();

      expect(service.isBlacklisted(invalidToken)).toBe(false);
    });

    it('should handle tokens without expiration', () => {
      const tokenWithoutExp = 'token-without-exp';

      mockJwtService.decode.mockReturnValue({}); // No exp field

      service.addToBlacklist(tokenWithoutExp);
      expect(service.isBlacklisted(tokenWithoutExp)).toBe(true);

      service.cleanupExpiredTokens();

      // Should remain in blacklist since no exp field
      expect(service.isBlacklisted(tokenWithoutExp)).toBe(true);
    });
  });

  describe('getBlacklistSize', () => {
    it('should return 0 for empty blacklist', () => {
      expect(service.getBlacklistSize()).toBe(0);
    });

    it('should return correct size for non-empty blacklist', () => {
      service.addToBlacklist('token-1');
      service.addToBlacklist('token-2');
      service.addToBlacklist('token-3');

      expect(service.getBlacklistSize()).toBe(3);
    });

    it('should update size when tokens are removed', () => {
      service.addToBlacklist('token-1');
      service.addToBlacklist('token-2');

      expect(service.getBlacklistSize()).toBe(2);

      service.removeFromBlacklist('token-1');

      expect(service.getBlacklistSize()).toBe(1);
    });
  });
});
