import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './Google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.googleClientId') return 'test-client-id';
        if (key === 'auth.googleClientSecret') return 'test-client-secret';
        if (key === 'auth.googleCallbackUrl')
          return 'http://localhost:7777/api/auth/google/callback';
        if (key === 'auth.allowedEmails')
          return ['admin@example.com', 'user@example.com'];
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    const mockProfile = {
      name: {
        givenName: 'John',
        familyName: 'Doe',
      },
      emails: [{ value: 'admin@example.com' }],
      photos: [{ value: 'https://example.com/photo.jpg' }],
    };

    const mockDone = jest.fn();

    beforeEach(() => {
      mockDone.mockClear();
    });

    it('should validate user with allowed email', async () => {
      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(null, {
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/photo.jpg',
        accessToken: 'access-token',
      });
    });

    it('should reject user with disallowed email', async () => {
      const profileWithDisallowedEmail = {
        ...mockProfile,
        emails: [{ value: 'hacker@example.com' }],
      };

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithDisallowedEmail,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        null,
      );
      expect(mockDone.mock.calls[0][0].message).toBe(
        'Email hacker@example.com is not authorized',
      );
    });

    it('should reject when no email is found in profile', async () => {
      const profileWithoutEmail = {
        ...mockProfile,
        emails: [],
      };

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithoutEmail,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        null,
      );
      expect(mockDone.mock.calls[0][0].message).toBe(
        'No email found in Google profile',
      );
    });

    it('should reject when no allowed emails are configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.allowedEmails') return [];
        return 'test-value';
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        null,
      );
      expect(mockDone.mock.calls[0][0].message).toBe(
        'No allowed emails configured',
      );
    });

    it('should reject when allowed emails config is null/undefined', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.allowedEmails') return null;
        return 'test-value';
      });

      await strategy.validate(
        'access-token',
        'refresh-token',
        mockProfile,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        null,
      );
      expect(mockDone.mock.calls[0][0].message).toBe(
        'No allowed emails configured',
      );
    });

    it('should handle missing photos gracefully', async () => {
      const profileWithoutPhotos = {
        ...mockProfile,
        photos: [],
      };

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithoutPhotos,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(null, {
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: '',
        accessToken: 'access-token',
      });
    });

    it('should handle case-sensitive email matching', async () => {
      const profileWithUpperCaseEmail = {
        ...mockProfile,
        emails: [{ value: 'ADMIN@EXAMPLE.COM' }],
      };

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithUpperCaseEmail,
        mockDone,
      );

      // Should still be rejected because email matching is case-sensitive
      expect(mockDone).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        null,
      );
    });

    it('should work with multiple allowed emails', async () => {
      const profileWithSecondAllowedEmail = {
        ...mockProfile,
        emails: [{ value: 'user@example.com' }],
      };

      await strategy.validate(
        'access-token',
        'refresh-token',
        profileWithSecondAllowedEmail,
        mockDone,
      );

      expect(mockDone).toHaveBeenCalledWith(null, {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/photo.jpg',
        accessToken: 'access-token',
      });
    });
  });
});
