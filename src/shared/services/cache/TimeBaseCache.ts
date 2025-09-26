import { isNil } from '../../utils';

interface TimedValue<V> {
  value: V;
  timestampSeconds: number;
}

export class TimeBaseCache<K, V> {
  private readonly map = new Map<K, TimedValue<V>>();

  constructor(private expirationMs: number) {}

  has(key: K): boolean {
    return this._get(key) !== undefined;
  }

  get(key: K): V | undefined {
    return this._get(key);
  }

  set(key: K, value: V): void {
    this.map.set(key, { value, timestampSeconds: this.getTimestampSeconds() });
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  private isExpired({ timestampSeconds }: TimedValue<V>): boolean {
    return timestampSeconds + this.expirationMs <= this.getTimestampSeconds();
  }

  private _get(key: K): V | undefined {
    const data = this.map.get(key);
    if (!isNil(data) && !this.isExpired(data)) {
      return data?.value;
    }
    this.delete(key);
    return this.map.get(key)?.value;
  }

  private getTimestampSeconds(): number {
    return Math.floor(new Date().getTime());
  }
}
