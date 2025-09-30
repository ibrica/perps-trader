import { Module, Scope } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoDbTestingService } from './MongoDbTestingService';
import appConfig from '../../config/app.config';
import { isNil } from '../utils';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const uri = config.get('app.mongodbTestUri');

        if (isNil(uri)) {
          throw new Error('Please provide testing mongo db url');
        }

        const fullUri = MongoDbTestingService.generateDBUri(uri);

        return { uri: fullUri };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: MongoDbTestingService,
      useFactory: (connection: Connection): MongoDbTestingService => {
        return new MongoDbTestingService(connection);
      },
      scope: Scope.TRANSIENT,
      inject: [getConnectionToken()],
    },
  ],
  exports: [MongoDbTestingService],
})
export class MongoDbTestingModule {}
