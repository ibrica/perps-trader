import { BaseSolanaError } from './BaseSolanaError';

export class InvalidAmountError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1771', '6001'];

  readonly type = InvalidAmountError.name;

  public message: string;

  public readonly customMessage = 'IThe amount must be available in the curve';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidAmountError.prototype);
  }
}
