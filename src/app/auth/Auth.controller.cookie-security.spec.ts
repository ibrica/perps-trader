import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './Auth.controller';
import { AuthService } from './Auth.service';
import { JwtBlacklistService } from './JwtBlacklist.service';

describe('AuthController Cookie Security', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let module: TestingModule;

  const mockGoogleProfile = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'https://example.com/photo.jpg',
    accessToken: 'google-access-token',
  };

  const mockAuthUser = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'https://example.com/photo.jpg',
  };

  const mockTokens = {
    accessToken: 'jwt-token',
    expiresIn: '7d',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  beforeEach(async () => {
    mockAuthService = {
      validateGoogleUser: jest.fn().mockResolvedValue(mockAuthUser),
      generateTokens: jest.fn().mockResolvedValue(mockTokens),
      generateCsrfToken: jest.fn().mockReturnValue('csrf-token'),
      blacklistToken: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.dashboardUrl') return 'http://localhost:3000';
        if (key === 'auth.cookieDomain') return undefined;
        if (key === 'auth.cookieSecure') return false;
        if (key === 'auth.cookieSameSite') return 'lax';
        if (key === 'auth.authCookieName') return 'perps_trader_dashboard_auth';
        if (key === 'auth.csrfCookieName') return 'perps_trader_dashboard_csrf';
        return undefined;
      }),
    } as any;

    module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtBlacklistService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('Cookie Security in Development', () => {
    beforeEach(() => {
      // Mock development environment
      process.env.NODE_ENV = 'development';
    });

    it('should use secure=false in development', async () => {
      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      // Check that cookies are set with secure=false in development
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_auth',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          secure: false, // Should be false in development
          sameSite: 'lax', // Should be lax in development
        }),
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_csrf',
        'csrf-token',
        expect.objectContaining({
          httpOnly: false,
          secure: false, // Should be false in development
          sameSite: 'lax', // Should be lax in development
        }),
      );
    });
  });

  describe('Cookie Security in Production', () => {
    beforeEach(() => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Override the config service to return production values
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.dashboardUrl') return 'http://localhost:3000';
        if (key === 'auth.cookieDomain') return undefined;
        if (key === 'auth.cookieSecure') return true; // Force true in production
        if (key === 'auth.cookieSameSite') return 'strict'; // Force strict in production
        if (key === 'auth.authCookieName') return 'perps_trader_dashboard_auth';
        if (key === 'auth.csrfCookieName') return 'perps_trader_dashboard_csrf';
        return undefined;
      });
    });

    it('should use secure=true in production', async () => {
      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      // Check that cookies are set with secure=true in production
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_auth',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true, // Should be true in production
          sameSite: 'strict', // Should be strict in production
        }),
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_csrf',
        'csrf-token',
        expect.objectContaining({
          httpOnly: false,
          secure: true, // Should be true in production
          sameSite: 'strict', // Should be strict in production
        }),
      );
    });
  });

  describe('Cookie Configuration Override', () => {
    it('should use configured cookie settings when provided', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.dashboardUrl') return 'http://localhost:3000';
        if (key === 'auth.cookieDomain') return '.example.com';
        if (key === 'auth.cookieSecure') return true;
        if (key === 'auth.cookieSameSite') return 'strict';
        if (key === 'auth.authCookieName') return 'custom_auth_cookie';
        if (key === 'auth.csrfCookieName') return 'custom_csrf_cookie';
        return undefined;
      });

      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      // Check that custom configuration is used
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'custom_auth_cookie',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          domain: '.example.com',
        }),
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'custom_csrf_cookie',
        'csrf-token',
        expect.objectContaining({
          httpOnly: false,
          secure: true,
          sameSite: 'strict',
          domain: '.example.com',
        }),
      );
    });
  });

  describe('Logout Cookie Clearing', () => {
    it('should clear cookies with same security settings on logout', async () => {
      const mockReq = {
        user: { email: 'test@example.com' },
        headers: {
          authorization: 'Bearer jwt-token',
        },
      } as any;

      const mockRes = {
        json: jest.fn(),
        clearCookie: jest.fn(),
      } as any;

      await controller.logout(mockReq, mockRes);

      // Check that cookies are cleared with same security settings
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_auth',
        expect.objectContaining({
          httpOnly: true,
          secure: false, // Should match the set cookie settings
          sameSite: 'lax',
        }),
      );

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_csrf',
        expect.objectContaining({
          httpOnly: false,
          secure: false, // Should match the set cookie settings
          sameSite: 'lax',
        }),
      );
    });

    it('should blacklist JWT token on logout', async () => {
      const mockReq = {
        user: { email: 'test@example.com' },
        headers: {
          authorization: 'Bearer jwt-token',
        },
      } as any;

      const mockRes = {
        json: jest.fn(),
        clearCookie: jest.fn(),
      } as any;

      await controller.logout(mockReq, mockRes);

      // Check that JWT token is blacklisted
      expect(mockAuthService.blacklistToken).toHaveBeenCalledWith('jwt-token');
    });
  });

  describe('Cookie Security Best Practices', () => {
    it('should set httpOnly=true for auth cookies', async () => {
      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      // Auth cookie should be httpOnly
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_auth',
        'jwt-token',
        expect.objectContaining({
          httpOnly: true,
        }),
      );

      // CSRF cookie should be accessible to JavaScript
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'perps_trader_dashboard_csrf',
        'csrf-token',
        expect.objectContaining({
          httpOnly: false,
        }),
      );
    });

    it('should set appropriate maxAge for cookies', async () => {
      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      // Both cookies should have the same maxAge
      const authCookieCall = mockRes.cookie.mock.calls.find(
        (call) => call[0] === 'perps_trader_dashboard_auth',
      );
      const csrfCookieCall = mockRes.cookie.mock.calls.find(
        (call) => call[0] === 'perps_trader_dashboard_csrf',
      );

      expect(authCookieCall[2].maxAge).toBeDefined();
      expect(csrfCookieCall[2].maxAge).toBeDefined();
      expect(authCookieCall[2].maxAge).toBe(csrfCookieCall[2].maxAge);
    });
  });
});
