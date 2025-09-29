import { BaseSolanaError } from './BaseSolanaError';

export class TokenSymbolTooLongError extends BaseSolanaError {
  static readonly messagePatterns = ['0x178b', '6027'];

  readonly type = TokenSymbolTooLongError.name;

  public message: string;

  public readonly customMessage =
    'Token Symbol too long, max supported length is 10 bytes';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TokenSymbolTooLongError.prototype);
  }
}
