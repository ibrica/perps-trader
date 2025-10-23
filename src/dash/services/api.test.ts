import {
  getDashboardAnalytics,
  getPositions,
  updatePositionExitFlag,
  getPerps,
  updatePerp,
  getSettings,
  updateSettings,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  ApiError,
} from './api';
import { TimePeriod, TradePositionStatus } from '../types/dashboard';

describe('API Client', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    localStorage.clear();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Token Management', () => {
    it('should set auth token in localStorage', () => {
      setAuthToken('test-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
    });

    it('should get auth token from localStorage', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('stored-token');
      const token = getAuthToken();
      expect(token).toBe('stored-token');
      expect(localStorage.getItem).toHaveBeenCalledWith('token');
    });

    it('should clear auth token from localStorage', () => {
      clearAuthToken();
      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
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

    it('should include auth token in headers when available', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('auth-token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await getDashboardAnalytics();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token',
          }),
        })
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
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updatePositionExitFlag', () => {
    it('should send PATCH request with exitFlag', async () => {
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
        })
      );
      expect(result).toEqual(mockPosition);
    });
  });

  describe('updatePerp', () => {
    it('should send PATCH request with perp updates', async () => {
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
        })
      );
      expect(result).toEqual(mockPerp);
    });
  });

  describe('updateSettings', () => {
    it('should send PATCH request with settings updates', async () => {
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
        })
      );
      expect(result).toEqual(mockSettings);
    });
  });
});
