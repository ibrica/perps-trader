/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './Auth.service';
import { JwtBlacklistService } from './JwtBlacklist.service';
import { createTestingModuleWithProviders } from '../../shared';
import { GoogleProfile } from './strategies/Google.strategy';

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockJwtBlacklistService: jest.Mocked<JwtBlacklistService>;
  let module: TestingModule;

  const mockGoogleProfile: GoogleProfile = {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    picture: 'https://example.com/picture.jpg',
    accessToken: 'google-access-token',
  };

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
      decode: jest.fn().mockReturnValue({
        email: 'test@example.com',
        sub: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days from now
      }),
    } as any;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.jwtExpiresIn') return '7d';
        return undefined;
      }),
    } as any;

    mockJwtBlacklistService = {
      isBlacklisted: jest.fn().mockReturnValue(false),
      addToBlacklist: jest.fn(),
      removeFromBlacklist: jest.fn(),
      cleanupExpiredTokens: jest.fn(),
      getBlacklistSize: jest.fn().mockReturnValue(0),
    } as any;

    module = await createTestingModuleWithProviders({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtBlacklistService,
          useValue: mockJwtBlacklistService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('validateGoogleUser', () => {
    it('should return auth user from Google profile', async () => {
      const result = await service.validateGoogleUser(mockGoogleProfile);

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('Test');
      expect(result.lastName).toBe('User');
      expect(result.picture).toBe('https://example.com/picture.jpg');
    });

    it('should handle Google profile with all fields', async () => {
      const result = await service.validateGoogleUser(mockGoogleProfile);

      expect(result).toEqual({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
      });
    });
  });

  describe('generateTokens', () => {
    it('should generate JWT access token', async () => {
      const user = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
      };

      const result = await service.generateTokens(user);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('jwt-token');
      expect(result.expiresIn).toBe('7d');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: 'test@example.com',
        sub: 'test@example.com',
      });
    });

    it('should use email as subject in JWT payload', async () => {
      const user = {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        picture: '',
      };

      await service.generateTokens(user);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: 'admin@example.com',
        sub: 'admin@example.com',
      });
    });

    it('should get expiration from config service', async () => {
      mockConfigService.get.mockReturnValue('30d');

      const user = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        picture: '',
      };

      const result = await service.generateTokens(user);

      expect(result.expiresIn).toBe('30d');
      expect(mockConfigService.get).toHaveBeenCalledWith(
        'auth.jwtExpiresIn',
        '7d',
      );
    });
  });

  describe('validateUser', () => {
    it('should return user from JWT payload', async () => {
      const payload = {
        email: 'test@example.com',
        sub: 'test@example.com',
      };

      const result = await service.validateUser(payload);

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(result?.firstName).toBe('');
      expect(result?.lastName).toBe('');
      expect(result?.picture).toBe('');
    });

    it('should handle different email in payload', async () => {
      const payload = {
        email: 'admin@example.com',
        sub: 'admin@example.com',
      };

      const result = await service.validateUser(payload);

      expect(result?.email).toBe('admin@example.com');
    });
  });
});
