import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongoDbTestingService {
  static readonly testDBOptionsString = 'retryWrites=true&w=majority';

  constructor(@InjectConnection() private connection: Connection) {}

  static generateDBUri(mongoUrl: string): string {
    const baseUrl = mongoUrl.substring(0, mongoUrl.lastIndexOf('/') + 1);
    const hash = this.getNewDbName();
    const fullUri = baseUrl.concat(
      hash,
      `?${MongoDbTestingService.testDBOptionsString}`,
    );

    return fullUri;
  }

  static getNewDbName(): string {
    return 'DB_' + new Date().getTime().toString();
  }

  static init(connection: Connection): MongoDbTestingService {
    const name = MongoDbTestingService.getNewDbName();
    return new MongoDbTestingService(connection.useDb(name));
  }

  async clean(): Promise<void> {
    const collections = await this.connection?.db?.collections();
    if (collections) {
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  }

  async close(): Promise<void> {
    try {
      if (this.connection?.db) {
        await this.connection.db.dropDatabase();
      }
    } catch (error) {
      console.error('Error dropping test database:', error);
    } finally {
      try {
        if (this.connection) {
          await this.connection.destroy();
        }
      } catch (error) {
        console.error('Error destroying connection:', error);
      }
    }
  }

  async dropCollection(name: string): Promise<void> {
    await this.connection?.db?.dropCollection(name);
  }
}
