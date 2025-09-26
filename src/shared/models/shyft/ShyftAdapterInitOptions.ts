import { EventEmitter2 } from '@nestjs/event-emitter';

export interface ShyftAdapterInitOptions {
  grpcUrl: string;
  xToken: string;
  eventEmitter: EventEmitter2;
}
