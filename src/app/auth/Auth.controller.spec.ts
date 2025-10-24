/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './Auth.controller';
import { AuthService } from './Auth.service';
import { createTestingModuleWithProviders } from '../../shared';
import { GoogleProfile } from './strategies/Google.strategy';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let module: TestingModule;

  const mockGoogleProfile: GoogleProfile = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'https://example.com/picture.jpg',
    accessToken: 'google-access-token',
  };

  const mockAuthUser = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'https://example.com/picture.jpg',
  };

  const mockTokens = {
    accessToken: 'jwt-token',
    expiresIn: '7d',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
  };

  beforeEach(async () => {
    mockAuthService = {
      validateGoogleUser: jest.fn().mockResolvedValue(mockAuthUser),
      generateTokens: jest.fn().mockResolvedValue(mockTokens),
      generateCsrfToken: jest.fn().mockReturnValue('csrf-token'),
    } as any;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.dashboardUrl') return 'http://localhost:3000';
        return undefined;
      }),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        AuthController,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('googleAuth', () => {
    it('should initiate Google OAuth flow', async () => {
      const mockReq = {} as any;

      // This endpoint just returns void as the guard handles the redirect
      await controller.googleAuth(mockReq);

      // No assertions needed - guard handles redirect to Google
    });
  });

  describe('googleAuthRedirect', () => {
    it('should redirect to dashboard with JWT token', async () => {
      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockAuthService.validateGoogleUser).toHaveBeenCalledWith(
        mockGoogleProfile,
      );
      expect(mockAuthService.generateTokens).toHaveBeenCalledWith(mockAuthUser);
      expect(mockAuthService.generateCsrfToken).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledTimes(2); // auth cookie and csrf cookie
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/auth/callback',
      );
    });

    it('should use configured dashboard URL', async () => {
      mockConfigService.get.mockReturnValue('https://dashboard.example.com');

      const mockReq = {
        user: mockGoogleProfile,
      } as any;

      const mockRes = {
        redirect: jest.fn(),
        cookie: jest.fn(),
      } as any;

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        'https://dashboard.example.com/auth/callback',
      );
    });
  });

  describe('getProfile', () => {
    it('should return current user from request', async () => {
      const mockUser = {
        email: 'test@example.com',
        sub: 'test@example.com',
      };

      const mockReq = {
        user: mockUser,
      } as any;

      const result = await controller.getProfile(mockReq);

      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should return logout success message', async () => {
      const mockRes = {
        json: jest.fn(),
        clearCookie: jest.fn(),
      } as any;

      await controller.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2); // auth and csrf cookies
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });
  });
});
