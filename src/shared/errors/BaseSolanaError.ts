export abstract class BaseSolanaError extends Error {
  public message: string;

  public abstract customMessage?: string;

  abstract readonly type: string;

  protected constructor(message: string) {
    super(message);
  }

  toString(): string {
    return `${this.name}: ${this.customMessage}`;
  }

  toStringPublic(): string {
    return `${this.name}: ${this.customMessage}`;
  }

  toStringInternal(): string {
    return `${this.name}: ${this.message}`;
  }
}
