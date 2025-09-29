import { BaseSolanaError } from './BaseSolanaError';

export class InsufficientBalanceError extends BaseSolanaError {
  static readonly messagePatterns = ['0x7d3', '2003', '0x1770', '6000'];

  readonly type = InsufficientBalanceError.name;

  public message: string;

  public readonly customMessage = 'Insufficient balance in the wallet';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InsufficientBalanceError.prototype);
  }
}
