import { BaseSolanaError } from './BaseSolanaError';

export class InsufficientSolBalanceError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1'];

  readonly type = InsufficientSolBalanceError.name;

  public readonly customMessage = 'Not enough SOL (for fee or transfer)';

  constructor(message: string) {
    super(message);
    this.message = message;
    Object.setPrototypeOf(this, InsufficientSolBalanceError.prototype);
  }
}
