import { Global, Module, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { IndexerAdapter } from '../../infrastructure';

@Global()
@Module({
  imports: [],
  providers: [
    {
      provide: IndexerAdapter,
      useFactory: (
        configService: ConfigService,
        eventEmitter: EventEmitter2,
      ): IndexerAdapter => {
        const host = configService.get('indexer.host');
        const wsPortStr = configService.get('indexer.wsPort');
        const apiPortStr = configService.get('indexer.apiPort');
        const wsPort = !Number.isNaN(wsPortStr) ? Number(wsPortStr) : null;
        const apiPort = !Number.isNaN(apiPortStr) ? Number(apiPortStr) : null;

        if (!host || !wsPort || !apiPort) {
          throw new Error('Indexer host or port not set!');
        }
        return new IndexerAdapter(host, wsPort, apiPort, eventEmitter);
      },
      inject: [ConfigService, EventEmitter2],
    },
  ],
  exports: [IndexerAdapter],
})
export class IndexerModule implements OnModuleInit {
  constructor(private readonly indexerAdapter: IndexerAdapter) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.indexerAdapter.connect();
    } catch (error) {
      console.error('Failed to connect to Indexer WebSocket:', error);
      // Don't throw here to allow the application to start even if indexer is not available
    }
  }
}
