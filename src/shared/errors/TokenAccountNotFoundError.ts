import { BaseSolanaError } from './BaseSolanaError';

export class TokenAccountNotFoundError extends BaseSolanaError {
  static readonly messagePatterns = ['0xbc4', '3012'];

  readonly type = TokenAccountNotFoundError.name;

  public message: string;

  public readonly customMessage =
    "Token account doesn't exist (user doesn't have any tokens for the given mint)";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TokenAccountNotFoundError.prototype);
  }
}
