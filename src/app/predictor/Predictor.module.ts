import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PredictorAdapter } from '../../infrastructure';

@Module({
  imports: [],
  providers: [
    {
      provide: PredictorAdapter,
      useFactory: (configService: ConfigService): PredictorAdapter => {
        const url = configService.get('predictor.url');
        const portStr = configService.get('predictor.port');
        const port = !Number.isNaN(portStr) ? Number(portStr) : null;

        if (!url || !port) {
          throw new Error('Predictor URL or port not set!');
        }
        return new PredictorAdapter(url, port);
      },
      inject: [ConfigService],
    },
  ],
  exports: [PredictorAdapter],
})
export class PredictorModule {}
