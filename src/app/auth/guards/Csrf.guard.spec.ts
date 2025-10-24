import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './Csrf.guard';
import { AuthService } from '../Auth.service';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.csrfHeaderName') return 'x-csrf-token';
        if (key === 'auth.csrfCookieName') return 'perps_trader_dashboard_csrf';
        return undefined;
      }),
    } as any;

    mockAuthService = {
      validateCsrfToken: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsrfGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    guard = module.get<CsrfGuard>(CsrfGuard);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn(),
      }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when CSRF tokens match and are valid', () => {
      const mockRequest = {
        headers: {
          'x-csrf-token': 'valid-csrf-token',
        },
        cookies: {
          perps_trader_dashboard_csrf: 'valid-csrf-token',
        },
      };

      // Mock the switchToHttp to return an object with getRequest
      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);
      mockAuthService.validateCsrfToken.mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockAuthService.validateCsrfToken).toHaveBeenCalledWith(
        'valid-csrf-token',
      );
    });

    it('should throw ForbiddenException when header token is missing', () => {
      const mockRequest = {
        headers: {},
        cookies: {
          perps_trader_dashboard_csrf: 'valid-csrf-token',
        },
      };

      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Invalid CSRF token'),
      );
    });

    it('should throw ForbiddenException when cookie token is missing', () => {
      const mockRequest = {
        headers: {
          'x-csrf-token': 'valid-csrf-token',
        },
        cookies: {},
      };

      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Invalid CSRF token'),
      );
    });

    it('should throw ForbiddenException when tokens do not match', () => {
      const mockRequest = {
        headers: {
          'x-csrf-token': 'header-token',
        },
        cookies: {
          perps_trader_dashboard_csrf: 'cookie-token',
        },
      };

      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Invalid CSRF token'),
      );
    });

    it('should throw ForbiddenException when CSRF token has expired', () => {
      const mockRequest = {
        headers: {
          'x-csrf-token': 'expired-csrf-token',
        },
        cookies: {
          perps_trader_dashboard_csrf: 'expired-csrf-token',
        },
      };

      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);
      mockAuthService.validateCsrfToken.mockReturnValue(false);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('CSRF token has expired'),
      );
    });

    it('should use custom header and cookie names from config', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'auth.csrfHeaderName') return 'x-custom-csrf';
        if (key === 'auth.csrfCookieName') return 'custom_csrf_cookie';
        return undefined;
      });

      const mockRequest = {
        headers: {
          'x-custom-csrf': 'valid-csrf-token',
        },
        cookies: {
          custom_csrf_cookie: 'valid-csrf-token',
        },
      };

      const mockHttpArgs = {
        getRequest: jest.fn().mockReturnValue(mockRequest),
      };
      mockExecutionContext.switchToHttp.mockReturnValue(mockHttpArgs as any);
      mockAuthService.validateCsrfToken.mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockAuthService.validateCsrfToken).toHaveBeenCalledWith(
        'valid-csrf-token',
      );
    });
  });
});
