import { plainToInstance } from 'class-transformer';

/**
 * @example
 * const value = User.fromObject(plain);
 * */
export class Entity {
  static fromObject<T extends Entity>(record: T): T {
    return plainToInstance(this, record) as T;
  }

  static fromObjects<T extends Entity>(records: T[]): T[] {
    return plainToInstance(this, records) as T[];
  }
}
