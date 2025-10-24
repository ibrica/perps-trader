import {
  getDashboardAnalytics,
  getPositions,
  updatePositionExitFlag,
  getPerps,
  updatePerp,
  getSettings,
  updateSettings,
  hasAuthSession,
  ApiError,
} from './api';
import { TimePeriod, TradePositionStatus } from '../types/dashboard';

const CSRF_COOKIE_NAME = 'perps_trader_dashboard_csrf';
let cookieStore = '';

Object.defineProperty(document, 'cookie', {
  configurable: true,
  get: () => cookieStore,
  set: (value: string) => {
    cookieStore = value;
  },
});

function setDocumentCookie(value: string): void {
  cookieStore = value;
}

describe('API Client', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    setDocumentCookie('');
  });

  describe('Session helpers', () => {
    it('should report inactive session when CSRF cookie missing', () => {
      setDocumentCookie('');
      expect(hasAuthSession()).toBe(false);
    });

    it('should detect active session when CSRF cookie exists', () => {
      setDocumentCookie(`${CSRF_COOKIE_NAME}=csrf-token`);
      expect(hasAuthSession()).toBe(true);
    });
  });

  describe('getDashboardAnalytics', () => {
    it('should fetch analytics with default parameters', async () => {
      const mockResponse = {
        overview: { totalPnl: 1000, winRate: 60 },
        timeSeries: [],
        tokenBreakdown: [],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getDashboardAnalytics();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:7777/api/dashboard/analytics',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include query parameters when provided', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await getDashboardAnalytics({
        period: TimePeriod.LAST_30_DAYS,
        token: 'BTC',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('period=LAST_30_DAYS'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('token=BTC'),
        expect.any(Object)
      );
    });

    it('should throw ApiError on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(getDashboardAnalytics()).rejects.toThrow(ApiError);
      await expect(getDashboardAnalytics()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getPositions', () => {
    it('should fetch positions with query parameters', async () => {
      const mockResponse = {
        positions: [],
        total: 0,
        limit: 50,
        offset: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getPositions(TradePositionStatus.OPEN, 50, 0);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=OPEN'),
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updatePositionExitFlag', () => {
    it('should send PATCH request with exitFlag', async () => {
      setDocumentCookie(`${CSRF_COOKIE_NAME}=csrf-token`);
      const mockPosition = { id: '123', exitFlag: true };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPosition,
      });

      const result = await updatePositionExitFlag('123', true);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:7777/api/dashboard/positions/123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ exitFlag: true }),
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-csrf-token': 'csrf-token',
          }),
        })
      );
      expect(result).toEqual(mockPosition);
    });
  });

  describe('updatePerp', () => {
    it('should send PATCH request with perp updates', async () => {
      setDocumentCookie(`${CSRF_COOKIE_NAME}=csrf-token`);
      const updates = { recommendedAmount: 200, defaultLeverage: 5 };
      const mockPerp = { _id: '123', ...updates };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockPerp,
      });

      const result = await updatePerp('123', updates);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:7777/api/dashboard/perps/123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updates),
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-csrf-token': 'csrf-token',
          }),
        })
      );
      expect(result).toEqual(mockPerp);
    });
  });

  describe('updateSettings', () => {
    it('should send PATCH request with settings updates', async () => {
      setDocumentCookie(`${CSRF_COOKIE_NAME}=csrf-token`);
      const mockSettings = { closeAllPositions: true };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSettings,
      });

      const result = await updateSettings(true);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:7777/api/dashboard/settings',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ closeAllPositions: true }),
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-csrf-token': 'csrf-token',
          }),
        })
      );
      expect(result).toEqual(mockSettings);
    });
  });
});
