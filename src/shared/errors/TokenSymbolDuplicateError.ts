import { BaseSolanaError } from './BaseSolanaError';

export class TokenSymbolDuplicateError extends BaseSolanaError {
  static readonly messagePatterns = ['0xbc3', '3011'];

  readonly type = TokenSymbolDuplicateError.name;

  public message: string;

  public readonly customMessage = 'Token symbol already exists';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TokenSymbolDuplicateError.prototype);
  }
}
