import { BaseSolanaError } from './BaseSolanaError';

export class ArithmeticsError extends BaseSolanaError {
  static readonly messagePatterns = ['0x177f', '6015'];

  public readonly type = ArithmeticsError.name;

  public message: string;

  public readonly customMessage = 'Arithmetics error';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ArithmeticsError.prototype);
  }
}
