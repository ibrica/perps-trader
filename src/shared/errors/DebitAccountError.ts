import { BaseSolanaError } from './BaseSolanaError';

export class DebitAccountError extends BaseSolanaError {
  static readonly messagePatterns = [
    'Attempt to debit an account but found no record of a prior credit',
  ];

  readonly type = DebitAccountError.name;

  public message: string;

  public readonly customMessage =
    'Attempt to debit an account but found no record of a prior credit';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, DebitAccountError.prototype);
  }
}
