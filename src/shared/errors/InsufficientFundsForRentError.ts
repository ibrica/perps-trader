import { BaseSolanaError } from './BaseSolanaError';

export class InsufficientFundsForRentError extends BaseSolanaError {
  static readonly messagePatterns = ['insufficient funds for rent'];

  readonly type = InsufficientFundsForRentError.name;

  public readonly customMessage =
    'Transaction results in an account with insufficient funds for rent';

  constructor(message: string) {
    super(message);
    this.message = message;
    Object.setPrototypeOf(this, InsufficientFundsForRentError.prototype);
  }
}
