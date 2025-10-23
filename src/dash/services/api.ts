import {
  DashboardAnalytics,
  DashboardQuery,
  PaginatedPositions,
  Position,
  Perp,
  Settings,
  TradePositionStatus,
} from '../types/dashboard';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7777';
const CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME ||
  'perps_trader_dashboard_csrf';
const CSRF_HEADER_NAME =
  process.env.NEXT_PUBLIC_CSRF_HEADER_NAME?.toLowerCase() ||
  'x-csrf-token';
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieString = document.cookie;
  if (!cookieString) {
    return null;
  }

  const cookies = cookieString.split(';');
  for (const rawCookie of cookies) {
    const [cookieName, ...rest] = rawCookie.split('=');
    if (!cookieName || rest.length === 0) {
      continue;
    }

    if (cookieName.trim() === name) {
      return decodeURIComponent(rest.join('=').trim());
    }
  }

  return null;
}

export function hasAuthSession(): boolean {
  return getCookieValue(CSRF_COOKIE_NAME) !== null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || 'GET').toString().toUpperCase();
  const headers: Record<string, string> = {};

  if (options.headers) {
    if (
      typeof Headers !== 'undefined' &&
      options.headers instanceof Headers
    ) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers as Record<string, string>);
    }
  }

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (CSRF_PROTECTED_METHODS.has(method)) {
    const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      // If response body is not JSON, create a generic error
      errorData = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
      };
    }

    throw new ApiError(
      errorData.message || `Request failed with status ${response.status}`,
      response.status,
      errorData,
    );
  }

  return response.json();
}

export async function getDashboardAnalytics(
  query: DashboardQuery = {},
): Promise<DashboardAnalytics> {
  const params = new URLSearchParams();

  if (query.period) params.append('period', query.period);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  if (query.token) params.append('token', query.token);

  const queryString = params.toString();
  return fetchApi<DashboardAnalytics>(
    `/api/dashboard/analytics${queryString ? `?${queryString}` : ''}`,
  );
}

export async function getPositions(
  status?: TradePositionStatus,
  limit: number = 50,
  offset: number = 0,
): Promise<PaginatedPositions> {
  const params = new URLSearchParams();

  if (status) params.append('status', status);
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());

  return fetchApi<PaginatedPositions>(
    `/api/dashboard/positions?${params.toString()}`,
  );
}

export async function updatePositionExitFlag(
  id: string,
  exitFlag: boolean,
): Promise<Position> {
  return fetchApi<Position>(`/api/dashboard/positions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ exitFlag }),
  });
}

export async function getPerps(): Promise<Perp[]> {
  return fetchApi<Perp[]>('/api/dashboard/perps');
}

export async function updatePerp(
  id: string,
  data: { recommendedAmount?: number; defaultLeverage?: number },
): Promise<Perp> {
  return fetchApi<Perp>(`/api/dashboard/perps/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getSettings(): Promise<Settings> {
  return fetchApi<Settings>('/api/dashboard/settings');
}

export async function updateSettings(
  closeAllPositions: boolean,
): Promise<Settings> {
  return fetchApi<Settings>('/api/dashboard/settings', {
    method: 'PATCH',
    body: JSON.stringify({ closeAllPositions }),
  });
}
