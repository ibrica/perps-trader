import { Logger } from '@nestjs/common';
import { IndexerClient } from './IndexerClient';
import { LastPriceResponse, OHLCVResponse } from './types';

export class IndexerAdapter {
  private readonly logger = new Logger(IndexerAdapter.name);
  private client: IndexerClient;

  constructor(host: string = 'localhost', apiPort: number = 7071) {
    this.client = new IndexerClient({
      baseUrl: `http://${host}:${apiPort}`,
    });
  }

  /**
   * Get the last price for a token from the indexer API
   */
  async getLastPrice(token: string): Promise<LastPriceResponse> {
    this.logger.log(`Fetching last price for token: ${token}`);
    return this.client.getLastPrice(token);
  }

  /**
   * Get OHLCV candle data for a token from the indexer API
   * @param token Token symbol (e.g., "BTC", "ETH")
   * @param limit Number of candles to fetch (default: 60 = 1 hour of 1m candles)
   */
  async getOHLCV(token: string, limit: number = 60): Promise<OHLCVResponse> {
    this.logger.log(`Fetching OHLCV data for token: ${token}, limit: ${limit}`);
    return this.client.getOHLCV(token, limit);
  }
}
