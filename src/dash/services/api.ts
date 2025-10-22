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
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || 'API request failed',
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

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
  }
}
