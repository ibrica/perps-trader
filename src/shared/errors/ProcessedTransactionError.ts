import { BaseSolanaError } from './BaseSolanaError';

export class ProcessedTransactionError extends BaseSolanaError {
  static readonly messagePatterns = [
    'failed to send transaction: Transaction simulation failed: This transaction has already been processed',
    'This transaction has already been processed',
  ];

  readonly type = ProcessedTransactionError.name;

  public message: string;

  public readonly customMessage = 'This transaction has already been processed';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ProcessedTransactionError.prototype);
  }
}
