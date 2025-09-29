import { BaseSolanaError } from './BaseSolanaError';

export class MinimalTradeAmountError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1782', '6018'];

  readonly type = MinimalTradeAmountError.name;

  public message: string;

  public readonly customMessage = 'Trade amount less then minimum';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, MinimalTradeAmountError.prototype);
  }
}
