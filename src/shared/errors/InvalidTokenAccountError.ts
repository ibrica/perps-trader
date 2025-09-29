import { BaseSolanaError } from './BaseSolanaError';

export class InvalidTokenAccountError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1775', '6005'];

  readonly type = InvalidTokenAccountError.name;

  public message: string;

  public readonly customMessage = 'Invalid token account provided';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidTokenAccountError.prototype);
  }
}
