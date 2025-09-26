import { GetPriorityFeeEstimateOptions } from './GetPriorityFeeEstimateOptions';

export abstract class HeliusPort {
  abstract getPriorityFeeEstimate(
    accountKeys: string[],
    options: GetPriorityFeeEstimateOptions,
  ): Promise<bigint | undefined>;
}
