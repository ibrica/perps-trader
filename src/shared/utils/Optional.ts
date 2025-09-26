export class Optional<T> {
  private readonly value: T | null | undefined;

  private constructor(value: T | null | undefined) {
    this.value = value;
  }

  static of<T>(value: T | null | undefined): Optional<T> {
    return new Optional(value);
  }

  static none(): Optional<undefined> {
    return new Optional(undefined);
  }

  isSome(): boolean {
    return this.value !== null && this.value !== undefined;
  }

  isNone(): boolean {
    return this.value === null || this.value === undefined;
  }

  get(): T {
    if (this.isNone()) {
      throw new Error('Tried to unwrap an Optional.none');
    }
    return this.value as T;
  }

  getOr(defaultValue: T): T {
    return this.isSome() ? (this.value as T) : defaultValue;
  }

  getOrThrow(error: Error): T {
    if (this.isNone()) {
      throw error;
    }
    return this.value as T;
  }
}
