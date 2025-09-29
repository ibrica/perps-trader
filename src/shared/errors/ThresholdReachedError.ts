import { BaseSolanaError } from './BaseSolanaError';

export class ThresholdReachedError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1774', '6004'];

  readonly type = ThresholdReachedError.name;

  public message: string;

  public readonly customMessage = 'Trade disabled, market cap treshold reached';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ThresholdReachedError.prototype);
  }
}
