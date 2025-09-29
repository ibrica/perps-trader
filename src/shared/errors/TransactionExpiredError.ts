import { BaseSolanaError } from './BaseSolanaError';

export class TransactionExpiredError extends BaseSolanaError {
  static readonly messagePatterns = [
    'TransactionExpiredBlockheightExceededError',
  ];

  readonly type = TransactionExpiredError.name;

  public message: string;

  public readonly customMessage =
    'Transaction expired - Blockhash height exceeded';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TransactionExpiredError.prototype);
  }
}
