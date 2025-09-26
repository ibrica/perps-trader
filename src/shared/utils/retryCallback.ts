import { Logger } from '@nestjs/common';
import { BehaviorSubject } from 'rxjs';
import { BaseSolanaError, ProcessedTransactionError } from '..';
import { delay } from '.';

export type RetryResponse<R> = { result?: R; error?: BaseSolanaError };

export interface RetryOptions {
  maxCount?: number;
  endPredicate?: () => Promise<boolean>;
  delayMs?: number;
  // eslint-disable-next-line
  stopErrors?: any[];
  logger?: Logger;
  criticalErrorSignal?: BehaviorSubject<BaseSolanaError | undefined>;
}

const defaultOptions: RetryOptions = {
  maxCount: 10,
  endPredicate: async () => false,
  delayMs: 500,
  stopErrors: [],
  logger: new Logger('Retry'),
};

export const retryCallback = async <R>(
  cb: () => Promise<R>,
  options: RetryOptions,
): Promise<RetryResponse<R>> => {
  const {
    maxCount,
    delayMs = 0,
    endPredicate,
    stopErrors,
    logger,
    criticalErrorSignal,
  } = { ...defaultOptions, ...options };

  const attempt = async (count: number): Promise<RetryResponse<R>> => {
    try {
      const result = await cb();
      return { result };
    } catch (e) {
      logger?.warn(`retryCallback failed, with ${count - 1} attempts left`);
      logger?.warn(e);
      const error = e; // Use appropriate error processing if necessary
      logger?.warn(JSON.stringify(error));

      if (stopErrors) {
        for (const stopError of stopErrors) {
          if (error instanceof stopError) {
            if (!(error instanceof ProcessedTransactionError)) {
              criticalErrorSignal?.next(error);
            }
            return { error };
          }
        }
      }

      if (count <= 0 || (await endPredicate?.())) {
        return { error };
      }

      await delay(delayMs);

      return attempt(count - 1);
    }
  };

  return attempt(maxCount!);
};
