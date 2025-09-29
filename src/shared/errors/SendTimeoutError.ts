import { BaseSolanaError } from './BaseSolanaError';

export class SendTimeoutError extends BaseSolanaError {
  readonly type = SendTimeoutError.name;

  public message: string;

  public readonly customMessage = 'Sending transaction timeout error';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, SendTimeoutError.prototype);
  }
}
