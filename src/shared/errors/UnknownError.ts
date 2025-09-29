import { BaseSolanaError } from './BaseSolanaError';

export class UnknownError extends BaseSolanaError {
  readonly type = UnknownError.name;

  public message: string;

  public readonly customMessage = 'Unrecognized error';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, UnknownError.prototype);
  }

  toString(): string {
    return `Unknown error - ${this.message}`;
  }
}
