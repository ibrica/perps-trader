import { BaseSolanaError } from './BaseSolanaError';

export class AggregateError extends Error {
  public message: string;

  private readonly errors: BaseSolanaError[];

  constructor(errors: BaseSolanaError[]) {
    const publicMessage = errors
      .map((err) => err.toStringPublic?.() ?? String(err))
      .join(', ');
    super(publicMessage);

    this.errors = this.filterDuplicates(errors);
    this.message = publicMessage;
    Object.setPrototypeOf(this, AggregateError.prototype);
  }

  toString(): string {
    return this.errors.map((err) => err.toString()).join(', ');
  }

  toStringInternal(): string {
    return this.errors
      .map((err) => `${err.toString()} - ${err.toStringPublic()}`)
      .join(', ');
  }

  filterDuplicates(errors: BaseSolanaError[]): BaseSolanaError[] {
    const finalSet: BaseSolanaError[] = [];
    const set = new Set();
    for (const error of errors) {
      if (!set.has(error.type)) {
        set.add(error.type);
        finalSet.push(error);
      }
    }
    return finalSet;
  }
}
