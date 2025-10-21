/* eslint-disable  @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types */
/**
 * TypeScript interfaces for Sol-Indexer REST API
 *
 * This file contains type definitions for all API endpoints.
 * Generated for sol-indexer REST API v1.0
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Token type classification
 */
export type TokenType = 'main' | 'alt' | 'meme';

/**
 * Data source for token information
 */
export type TokenSource = 'binance' | 'coingecko' | 'meme';

/**
 * Price data type indicator
 */
export type PriceDataType = 'price' | 'position';

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response for GET /last-price endpoint
 */
export interface LastPriceResponse {
  /** Token symbol (BTC, ETH, SOL ) */
  token_symbol: string;

  /** Token classification type */
  type: TokenType;

  /** Price in USD (for main/alt coins only) */
  price?: number;

  /** Position on bonding curve (for meme coins only, as string due to big integer) */
  position?: string;

  /** ISO 8601 timestamp of the last price/position data */
  timestamp: string;

  /** Error message if request failed */
  error?: string;
}

/**
 * Single OHLCV candle data point
 */
export interface OHLCVCandle {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Open price */
  open_price: number;

  /** High price */
  high_price: number;

  /** Low price */
  low_price: number;

  /** Close price */
  close_price: number;

  /** Volume */
  volume: number;

  /** Trade count */
  trade_count?: number;
}

/**
 * Response for GET /ohlcv endpoint
 */
export interface OHLCVResponse {
  /** Token symbol (BTC, ETH, etc.) */
  token_symbol: string;

  /** Token classification type (main or alt) */
  type: TokenType;

  /** Candle interval (always "1m" for now) */
  interval: string;

  /** Array of OHLCV candles (sorted DESC by timestamp) */
  candles: OHLCVCandle[];
}

/**
 * Health check response for GET /health endpoint
 */
export interface HealthResponse {
  /** Service status */
  status: 'ok' | 'error';

  /** Optional error message */
  message?: string;
}

/**
 * Generic error response structure
 */
export interface ErrorResponse {
  /** Error type/code */
  error: string;

  /** Detailed error message */
  message?: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Query parameters for GET /last-price
 */
export interface LastPriceQueryParams {
  /** Token symbol to lookup (required) - e.g., "BTC", "ETH" for main/alt coins */
  'token-symbol': string;
}

// ============================================================================
// Internal Data Models (for reference)
// ============================================================================

/**
 * Unified monitoring pair model
 */
export interface MonitoringPair {
  token_address: string;
  token_symbol: string;
  network: string;
  pool_address?: string;
  ticker?: string;
  name?: string;
  source: TokenSource;
  active: boolean;
  type: TokenType;
  created_at: string;
  updated_at: string;
}

/**
 * Price data model
 */
export interface PriceData {
  /** Price in USD (for main/alt coins) */
  price?: number;

  /** Position on bonding curve (for meme coins, as string) */
  position?: string;

  /** Timestamp of the data */
  timestamp: string;

  /** Data type indicator */
  type: PriceDataType;
}

// ============================================================================
// API Client Types
// ============================================================================

/**
 * Configuration for API client
 */
export interface ApiClientConfig {
  /** Base URL of the API (e.g., "http://localhost:7071") */
  baseUrl: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Additional headers to include with requests */
  headers?: Record<string, string>;
}

/**
 * API client response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;

  /** HTTP status code */
  status: number;

  /** Response headers */
  headers: Record<string, string>;
}

/**
 * API error wrapper
 */
export interface ApiError {
  /** Error message */
  message: string;

  /** HTTP status code */
  status: number;

  /** Original error response */
  response?: ErrorResponse;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Union type for all possible API responses
 */
export type ApiResponseUnion =
  | LastPriceResponse
  | OHLCVResponse
  | HealthResponse
  | ErrorResponse;

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: any): response is ErrorResponse {
  return response && typeof response.error === 'string';
}

/**
 * Type guard to check if response is a LastPriceResponse
 */
export function isLastPriceResponse(
  response: any,
): response is LastPriceResponse {
  return (
    response &&
    typeof response.token_symbol === 'string' &&
    typeof response.type === 'string' &&
    typeof response.timestamp === 'string'
  );
}

/**
 * Type guard to check if response is an OHLCVResponse
 */
export function isOHLCVResponse(response: any): response is OHLCVResponse {
  return (
    response &&
    typeof response.token_symbol === 'string' &&
    typeof response.type === 'string' &&
    typeof response.interval === 'string' &&
    Array.isArray(response.candles)
  );
}

/**
 * Type guard to check if response is a HealthResponse
 */
export function isHealthResponse(response: any): response is HealthResponse {
  return response && typeof response.status === 'string';
}

// ============================================================================
// Example Usage Types
// ============================================================================

/**
 * Example usage of the API client
 */
export interface ApiClientExample {
  /**
   * Get last price for a token
   *
   * @param tokenSymbol - Token symbol to lookup (BTC, ETH for main/alt coins
   * @returns Promise with price/position data
   *
   * @example
   * ```typescript
   * const client = new ApiClient({ baseUrl: 'http://localhost:7071' });
   
   *
   * // For main/alt coins (using token symbol)
   * const btcPrice = await client.getLastPrice('BTC');
   * if (btcPrice.price !== undefined) {
   *   console.log(`BTC Price: $${btcPrice.price}`);
   * }
   * ```
   */
  getLastPrice(tokenSymbol: string): Promise<LastPriceResponse>;

  /**
   * Check API health
   *
   * @returns Promise with health status
   */
  getHealth(): Promise<HealthResponse>;
}

// Export type guards and utilities as default
export default {
  isErrorResponse,
  isLastPriceResponse,
  isOHLCVResponse,
  isHealthResponse,
};
