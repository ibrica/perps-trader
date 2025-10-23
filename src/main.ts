import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Import Datadog tracing (must be before any other imports)
import './tracer';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Enable CORS for dashboard
    app.enableCors({
      origin: [
        'http://localhost:3000',
        configService.get<string>('auth.dashboardUrl', 'http://localhost:3000'),
      ],
      credentials: true,
    });

    const port = configService.get<number>('app.port', 7777);
    const host = configService.get<string>('app.host', '0.0.0.0');

    // Test indexer connectivity
    try {
      const indexerHost = configService.get<string>('indexer.host');
      const indexerPort = configService.get<number>('indexer.wsPort');
      if (indexerHost && indexerPort) {
        logger.log(`Indexer configured at ${indexerHost}:${indexerPort}`);
      }
    } catch (error) {
      logger.warn('Indexer connectivity test failed (optional service)', error);
    }

    // Test predictor connectivity
    try {
      const predictorUrl = configService.get<string>('predictor.url');
      const predictorPort = configService.get<number>('predictor.port');
      if (predictorUrl && predictorPort) {
        logger.log(`Predictor configured at ${predictorUrl}:${predictorPort}`);
      }
    } catch (error) {
      logger.warn(
        'Predictor connectivity test failed (optional service)',
        error,
      );
    }

    await app.listen(port, host);

    logger.log(
      `🚀 Perps Trader application is running on: http://${host}:${port}`,
    );
    logger.log(`📊 Health check available at: http://${host}:${port}/health`);

    // Log Hyperliquid configuration
    const hlEnabled = configService.get<boolean>('hyperliquid.enabled', false);
    const hlEnv = configService.get<string>('hyperliquid.env', 'testnet');
    logger.log(
      `🔗 Hyperliquid: ${hlEnabled ? 'ENABLED' : 'DISABLED'} (${hlEnv})`,
    );
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();
