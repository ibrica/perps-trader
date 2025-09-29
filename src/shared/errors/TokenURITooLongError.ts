import { BaseSolanaError } from './BaseSolanaError';

export class TokenURITooLongError extends BaseSolanaError {
  static readonly messagePatterns = ['0x178c', '6028'];

  readonly type = TokenURITooLongError.name;

  public message: string;

  public readonly customMessage =
    'Token URI too long, max supported length is 200 bytes';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TokenURITooLongError.prototype);
  }
}
