/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TypeScript interfaces for Sol-Indexer REST API
 * Adapted from sol-indexer types for atrader integration
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
  /** Token address (Solana address for meme coins, ticker for main/alt) */
  token_address: string;

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

/**
 * Configuration for API client
 */
export interface ApiClientConfig {
  /** Base URL of the API (e.g., "http://localhost:8080") */
  baseUrl: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Additional headers to include with requests */
  headers?: Record<string, string>;
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
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return !!(
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof (response as any).error === 'string'
  );
}

/**
 * Type guard to check if response is a LastPriceResponse
 */
export function isLastPriceResponse(
  response: unknown,
): response is LastPriceResponse {
  return !!(
    response &&
    typeof response === 'object' &&
    'token_address' in response &&
    typeof (response as any).token_address === 'string' &&
    'type' in response &&
    typeof (response as any).type === 'string' &&
    'timestamp' in response &&
    typeof (response as any).timestamp === 'string'
  );
}

/**
 * Type guard to check if response is a HealthResponse
 */
export function isHealthResponse(
  response: unknown,
): response is HealthResponse {
  return !!(
    response &&
    typeof response === 'object' &&
    'status' in response &&
    typeof (response as any).status === 'string'
  );
}
