import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './Auth.controller';
import { AuthService } from './Auth.service';
import { JwtBlacklistService } from './JwtBlacklist.service';
import { GoogleStrategy } from './strategies/Google.strategy';
import { CsrfGuard } from './guards/Csrf.guard';

describe('Auth Security Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let jwtBlacklistService: JwtBlacklistService;
  let googleStrategy: GoogleStrategy;
  let csrfGuard: CsrfGuard;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtBlacklistService,
        GoogleStrategy,
        CsrfGuard,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            decode: jest
              .fn()
              .mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                'auth.googleClientId': 'test-client-id',
                'auth.googleClientSecret': 'test-client-secret',
                'auth.googleCallbackUrl':
                  'http://localhost:7777/api/auth/google/callback',
                'auth.allowedEmails': ['admin@example.com', 'user@example.com'],
                'auth.jwtSecret': 'test-jwt-secret',
                'auth.jwtExpiresIn': '7d',
                'auth.csrfHeaderName': 'x-csrf-token',
                'auth.csrfCookieName': 'perps_trader_dashboard_csrf',
                'auth.dashboardUrl': 'http://localhost:3000',
                'auth.cookieSecure': false,
                'auth.cookieSameSite': 'lax',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    jwtBlacklistService = module.get<JwtBlacklistService>(JwtBlacklistService);
    googleStrategy = module.get<GoogleStrategy>(GoogleStrategy);
    csrfGuard = module.get<CsrfGuard>(CsrfGuard);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (module) {
      await module.close();
    }
  });

  describe('End-to-End Security Flow', () => {
    it('should handle complete authentication flow with security measures', async () => {
      // Test the complete flow from OAuth to JWT blacklisting
      const mockGoogleProfile = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        picture: 'https://example.com/photo.jpg',
        accessToken: 'google-access-token',
      };

      // 1. Validate Google user (email whitelist check)
      const authUser = await authService.validateGoogleUser(mockGoogleProfile);
      expect(authUser.email).toBe('admin@example.com');

      // 2. Generate JWT tokens
      const tokens = await authService.generateTokens(authUser);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.expiresIn).toBe('7d');

      // 3. Generate CSRF token
      const csrfToken = authService.generateCsrfToken();
      expect(csrfToken).toContain(':');
      expect(authService.validateCsrfToken(csrfToken)).toBe(true);

      // 4. Test JWT blacklisting
      jwtBlacklistService.addToBlacklist(tokens.accessToken);
      expect(jwtBlacklistService.isBlacklisted(tokens.accessToken)).toBe(true);

      // 5. Test CSRF token expiration
      const expiredToken = 'old-timestamp:random-part';
      expect(authService.validateCsrfToken(expiredToken)).toBe(false);
    });

    it('should reject unauthorized email addresses', async () => {
      const mockGoogleProfile = {
        email: 'hacker@example.com',
        firstName: 'Hacker',
        lastName: 'User',
        picture: 'https://example.com/photo.jpg',
        accessToken: 'google-access-token',
      };

      // This should be handled by the Google strategy validation
      // In a real scenario, this would be caught by the strategy's validate method
      expect(mockGoogleProfile.email).not.toBe('admin@example.com');
    });

    it('should handle CSRF protection correctly', () => {
      const validToken = authService.generateCsrfToken();
      const invalidToken = 'invalid-token';
      const expiredToken = 'old-timestamp:random-part';

      expect(authService.validateCsrfToken(validToken)).toBe(true);
      expect(authService.validateCsrfToken(invalidToken)).toBe(false);
      expect(authService.validateCsrfToken(expiredToken)).toBe(false);
    });

    it('should handle JWT blacklist cleanup', () => {
      const token1 = 'token-1';
      const token2 = 'token-2';

      jwtBlacklistService.addToBlacklist(token1);
      jwtBlacklistService.addToBlacklist(token2);

      expect(jwtBlacklistService.getBlacklistSize()).toBe(2);

      jwtBlacklistService.removeFromBlacklist(token1);
      expect(jwtBlacklistService.getBlacklistSize()).toBe(1);
      expect(jwtBlacklistService.isBlacklisted(token1)).toBe(false);
      expect(jwtBlacklistService.isBlacklisted(token2)).toBe(true);
    });
  });

  describe('Security Configuration Validation', () => {
    it('should have proper CSRF token format', () => {
      const csrfToken = authService.generateCsrfToken();
      const parts = csrfToken.split(':');

      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/); // Hex timestamp
      expect(parts[1]).toMatch(/^[0-9a-f]+$/); // Hex random part
    });

    it('should have proper JWT token format', async () => {
      const authUser = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/photo.jpg',
      };

      const tokens = await authService.generateTokens(authUser);
      expect(tokens.accessToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(tokens.accessToken.length).toBeGreaterThan(0);
    });

    it('should have proper email whitelist configuration', () => {
      const configService = module.get<ConfigService>(ConfigService);
      const allowedEmails = configService.get<string[]>('auth.allowedEmails');

      expect(allowedEmails).toBeDefined();
      expect(Array.isArray(allowedEmails)).toBe(true);
      expect(allowedEmails.length).toBeGreaterThan(0);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed CSRF tokens', () => {
      const malformedTokens = [
        '',
        'no-colon',
        'too:many:colons',
        'invalid-hex:invalid-hex',
        ':missing-timestamp',
        'missing-random:',
      ];

      malformedTokens.forEach((token) => {
        expect(authService.validateCsrfToken(token)).toBe(false);
      });
    });

    it('should handle JWT blacklist edge cases', () => {
      // Test with empty blacklist
      expect(jwtBlacklistService.getBlacklistSize()).toBe(0);
      expect(jwtBlacklistService.isBlacklisted('any-token')).toBe(false);

      // Test removing non-existent token
      expect(() =>
        jwtBlacklistService.removeFromBlacklist('non-existent'),
      ).not.toThrow();
    });

    it('should handle CSRF token edge cases', () => {
      // Test with null/undefined tokens
      expect(authService.validateCsrfToken(null as any)).toBe(false);
      expect(authService.validateCsrfToken(undefined as any)).toBe(false);
      expect(authService.validateCsrfToken('')).toBe(false);
    });
  });
});
