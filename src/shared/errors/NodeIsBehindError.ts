import { BaseSolanaError } from './BaseSolanaError';

export class NodeIsBehindError extends BaseSolanaError {
  static readonly messagePatterns = [
    'failed to send transaction: Node is behind by',
    'Node is behind by',
  ];

  readonly type = NodeIsBehindError.name;

  public readonly customMessage = 'Node is behind';

  constructor(message: string) {
    super(message);
    this.message = message;
    Object.setPrototypeOf(this, NodeIsBehindError.prototype);
  }
}
