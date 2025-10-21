/**
 * Price Client for Sol-Indexer REST API
 */

import { Logger, Injectable } from '@nestjs/common';
import {
  LastPriceResponse,
  OHLCVResponse,
  HealthResponse,
  ApiClientConfig,
  ApiError,
  isErrorResponse,
  isLastPriceResponse,
  isOHLCVResponse,
  isHealthResponse,
} from './types';

@Injectable()
export class IndexerClient {
  private readonly logger = new Logger(IndexerClient.name);
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 10000; // 10 second default
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.headers,
    };
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const apiError: ApiError = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          response: isErrorResponse(data) ? data : undefined,
        };
        this.logger.error(
          `API request failed: ${apiError.message}`,
          apiError.response,
        );

        // Create a regular Error to throw so it gets caught properly
        const error = new Error(apiError.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).apiError = apiError;
        throw error;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          const timeoutError = new Error(
            `Request timeout after ${this.timeout}ms`,
          );
          this.logger.error('Request timeout:', timeoutError);
          throw timeoutError;
        }
        this.logger.error('Request error:', error);
        throw error;
      }

      const unknownError = new Error('Unknown error occurred');
      this.logger.error('Unknown request error:', unknownError);
      throw unknownError;
    }
  }

  /**
   * Get last price/position data for a token
   */
  async getLastPrice(tokenSymbol: string): Promise<LastPriceResponse> {
    this.logger.debug(`Fetching last price for token: ${tokenSymbol}`);

    const params = new URLSearchParams({
      'token-symbol': tokenSymbol,
    });

    const response = await this.request<LastPriceResponse>(
      `/last-price?${params.toString()}`,
    );

    if (!isLastPriceResponse(response)) {
      throw new Error('Invalid response format for last price');
    }

    this.logger.debug(
      `Price fetched for ${tokenSymbol}: type=${response.type}, price=${response.price}, position=${response.position}`,
    );
    return response;
  }

  /**
   * Get OHLCV candle data for a token
   */
  async getOHLCV(
    tokenSymbol: string,
    limit: number = 60,
  ): Promise<OHLCVResponse> {
    this.logger.debug(
      `Fetching OHLCV data for token: ${tokenSymbol}, limit: ${limit}`,
    );

    const params = new URLSearchParams({
      'token-symbol': tokenSymbol,
      limit: limit.toString(),
    });

    const response = await this.request<OHLCVResponse>(
      `/ohlcv?${params.toString()}`,
    );

    if (!isOHLCVResponse(response)) {
      throw new Error('Invalid response format for OHLCV data');
    }

    this.logger.debug(
      `OHLCV data fetched for ${tokenSymbol}: ${response.candles.length} candles`,
    );
    return response;
  }

  /**
   * Check API health status
   */
  async getHealth(): Promise<HealthResponse> {
    this.logger.debug('Checking API health');

    const response = await this.request<HealthResponse>('/health');

    if (!isHealthResponse(response)) {
      throw new Error('Invalid response format for health check');
    }

    this.logger.debug(`API health status: ${response.status}`);
    return response;
  }

  /**
   * Get multiple token prices in batch
   */
  async getLastPrices(tokenAddresses: string[]): Promise<LastPriceResponse[]> {
    this.logger.debug(`Fetching prices for ${tokenAddresses.length} tokens`);

    const promises = tokenAddresses.map((address) =>
      this.getLastPrice(address),
    );
    const results = await Promise.all(promises);

    this.logger.debug(`Fetched ${results.length} price responses`);
    return results;
  }

  /**
   * Get last price with retry logic
   */
  async getLastPriceWithRetry(
    tokenSymbol: string,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<LastPriceResponse> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.getLastPrice(tokenSymbol);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          this.logger.warn(
            `Price fetch attempt ${attempt + 1} failed for ${tokenSymbol}, retrying in ${retryDelay}ms...`,
            lastError,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    this.logger.error(
      `All ${maxRetries + 1} price fetch attempts failed for ${tokenSymbol}`,
      lastError!,
    );
    throw lastError!;
  }
}
