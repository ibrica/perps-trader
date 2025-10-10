import { Logger } from '@nestjs/common';
import { IndexerClient } from './IndexerClient';
import { LastPriceResponse } from './types';

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
}
