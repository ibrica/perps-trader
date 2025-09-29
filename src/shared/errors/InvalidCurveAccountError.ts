import { BaseSolanaError } from './BaseSolanaError';

export class InvalidCurveAccountError extends BaseSolanaError {
  static readonly messagePatterns = ['0x1776', '6006'];

  readonly type = InvalidCurveAccountError.name;

  public message: string;

  public readonly customMessage = 'Invalid curve account';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidCurveAccountError.prototype);
  }
}
