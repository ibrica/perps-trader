import { BaseSolanaError } from './BaseSolanaError';

export class BlockhashNotFoundError extends BaseSolanaError {
  static readonly messagePatterns = [
    'failed to send transaction: Transaction simulation failed: Blockhash not found',
    'Blockhash not found',
  ];

  readonly type = BlockhashNotFoundError.name;

  public message: string;

  public readonly customMessage = 'Transaction expired - Blockhash not found';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, BlockhashNotFoundError.prototype);
  }
}
