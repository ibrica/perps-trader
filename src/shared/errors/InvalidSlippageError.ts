import { BaseSolanaError } from './BaseSolanaError';

export class InvalidSlippageError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1773', '6003'];

  readonly type = InvalidSlippageError.name;

  public message: string;

  public readonly customMessage =
    'The cost amount is not in the allowed slippage interval';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidSlippageError.prototype);
  }
}
