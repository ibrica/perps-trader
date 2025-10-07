import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexerAdapter } from '../../infrastructure';

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: IndexerAdapter,
      useFactory: (configService: ConfigService): IndexerAdapter => {
        const host = configService.get('indexer.host');
        const apiPortStr = configService.get('indexer.apiPort');
        //const wsPort = !Number.isNaN(wsPortStr) ? Number(wsPortStr) : null;
        const apiPort = !Number.isNaN(apiPortStr) ? Number(apiPortStr) : null;

        if (!host || !apiPort) {
          throw new Error('Indexer host or port not set!');
        }
        return new IndexerAdapter(host, apiPort);
      },
      inject: [ConfigService],
    },
  ],
  exports: [IndexerAdapter],
})
export class IndexerModule {}
