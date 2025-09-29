import { BaseSolanaError } from './BaseSolanaError';

export class TokenNameTooLongError extends BaseSolanaError {
  static readonly messagePatterns = ['0x178a', '6026'];

  readonly type = TokenNameTooLongError.name;

  public message: string;

  public readonly customMessage =
    'Token Name too long, max supported length is 32 bytes';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TokenNameTooLongError.prototype);
  }
}
