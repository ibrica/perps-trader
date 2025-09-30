import { Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import {
  PredictionHorizon,
  PredictionResponse,
  TokenCategory,
  retryCallback,
} from '../../shared';

const parseAxiosError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return axiosError.response?.data
      ? JSON.stringify(axiosError.response.data)
      : axiosError.message;
  }
  return error instanceof Error ? error.message : String(error);
};

export class PredictorAdapter {
  private logger = new Logger(PredictorAdapter.name);

  private readonly url: string;

  constructor(url: string, port: number) {
    this.url = `${url}:${port}`;
  }

  async predictToken(
    tokenMint: string,
    category: TokenCategory = TokenCategory.MEME_TOKENS,
    predictionHorizon: string = PredictionHorizon.THIRTY_MIN,
    includeReasoning: boolean = true,
  ): Promise<PredictionResponse | undefined> {
    const { result, error } = await retryCallback(
      async () => {
        const response = await axios.post(
          `${this.url}/predict`,
          {
            token_address: tokenMint,
            category: category,
            prediction_horizon: predictionHorizon,
            include_reasoning: includeReasoning,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 second timeout per request
          },
        );
        return response.data;
      },
      {
        maxCount: 5, // Try 5 times
        delayMs: 2000, // Wait 2 seconds between retries
        logger: this.logger,
      },
    );

    if (result) {
      return result;
    }

    if (error) {
      this.logger.error(
        `Error predicting token ${tokenMint} after retries: ${parseAxiosError(error)}`,
      );
    }

    return undefined;
  }
}
