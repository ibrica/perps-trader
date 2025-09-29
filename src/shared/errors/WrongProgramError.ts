import { BaseSolanaError } from './BaseSolanaError';

export class WrongProgramError extends BaseSolanaError {
  static readonly messagePatterns = ['0xbbf', '3007'];

  readonly type = WrongProgramError.name;

  public message: string;

  public readonly customMessage =
    'Wrong program (smart contract) used for this transaction';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, WrongProgramError.prototype);
  }
}
