import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import { HyperliquidTradingStrategyService } from './HyperliquidTradingStrategy.service';
import { HyperliquidTokenDiscoveryService } from './HyperliquidTokenDiscovery.service';
import { HyperliquidSignatureAdapter } from '../../infrastructure/hyperliquid/HyperliquidSignatureAdapter';
import {
  HyperliquidClient,
  HyperliquidClientConfig,
} from '../../infrastructure/hyperliquid/HyperliquidClient';
import { hyperliquidConfig } from '../../config/hyperliquid.config';
import { PerpModule } from '../perps';
import { PredictorModule } from '../predictor/Predictor.module';
import { CryptoJsService, IndexerAdapter } from '../../infrastructure';
import { HyperliquidPlatformService } from './HyperliquidPlatform.service';
import {
  EntryTimingService,
  EntryTimingConfig,
  ExtremeTrackingService,
} from '../../shared/services/entry-timing';

@Module({
  imports: [
    ConfigModule.forFeature(hyperliquidConfig),
    PerpModule,
    PredictorModule,
  ],
  providers: [
    // Signature adapter factory
    {
      provide: HyperliquidSignatureAdapter,
      useFactory: (
        configService: ConfigService,
      ): HyperliquidSignatureAdapter => {
        const privateKey = configService.get<string>('hyperliquid.privateKey');
        const keySecret = configService.get<string>('hyperliquid.keySecret');

        if (!privateKey || !keySecret) {
          throw new Error('Hyperliquid private key and secret are required');
        }

        // Decrypt the private key
        const decryptService = new CryptoJsService();
        const decryptedPrivateKey = decryptService.decrypt(
          privateKey,
          keySecret,
        );

        return new HyperliquidSignatureAdapter(decryptedPrivateKey);
      },
      inject: [ConfigService],
    },

    // Client factory
    {
      provide: HyperliquidClient,
      useFactory: (
        configService: ConfigService,
        signatureAdapter: HyperliquidSignatureAdapter,
      ): HyperliquidClient => {
        const privateKey = configService.get<string>('hyperliquid.privateKey');
        const keySecret = configService.get<string>('hyperliquid.keySecret');
        const isTestnet =
          configService.get<string>('hyperliquid.env') !== 'mainnet';
        const walletAddress = configService.get<string>('hyperliquid.address');

        let decryptedPrivateKey: string | undefined;

        if (privateKey && keySecret) {
          // Decrypt the private key
          const decryptService = new CryptoJsService();
          decryptedPrivateKey = decryptService.decrypt(privateKey, keySecret);
        }

        const config: HyperliquidClientConfig = {
          testnet: isTestnet,
          privateKey: decryptedPrivateKey,
          walletAddress,
          enableWs: false, // Disable WebSocket for now
          maxReconnectAttempts:
            configService.get<number>('hyperliquid.retryMaxAttempts') || 3,
        };

        return new HyperliquidClient(config, signatureAdapter);
      },
      inject: [ConfigService, HyperliquidSignatureAdapter],
    },

    // Main service
    HyperliquidService,
    HyperliquidWebSocketService,

    // Platform services
    // ExtremeTrackingService - for real OHLCV-based correction depth
    {
      provide: ExtremeTrackingService,
      useFactory: (indexerAdapter: IndexerAdapter): ExtremeTrackingService => {
        return new ExtremeTrackingService(indexerAdapter);
      },
      inject: [IndexerAdapter],
    },

    // EntryTimingService factory with platform-specific config
    {
      provide: EntryTimingService,
      useFactory: (
        configService: ConfigService,
        extremeTracker: ExtremeTrackingService,
      ): EntryTimingService => {
        const config: EntryTimingConfig = {
          enabled: configService.get<boolean>(
            'hyperliquid.entryTimingEnabled',
            true,
          ),
          shortTimeframe: configService.get<'5m' | '15m'>(
            'hyperliquid.entryTimingShortTimeframe',
            '5m',
          ),
          minCorrectionPct: configService.get<number>(
            'hyperliquid.entryTimingMinCorrectionPct',
            1.5,
          ),
          reversalConfidence: configService.get<number>(
            'hyperliquid.entryTimingReversalConfidence',
            0.6,
          ),
          useRealExtremes: configService.get<boolean>(
            'hyperliquid.entryTimingUseRealExtremes',
            true, // Enabled by default in production
          ),
          extremeLookbackMinutes: configService.get<number>(
            'hyperliquid.entryTimingExtremeLookbackMinutes',
            60,
          ),
        };
        return new EntryTimingService(config, extremeTracker);
      },
      inject: [ConfigService, ExtremeTrackingService],
    },
    HyperliquidTradingStrategyService,
    HyperliquidTokenDiscoveryService,
    HyperliquidPlatformService,
  ],
  exports: [
    HyperliquidService,
    HyperliquidWebSocketService,
    EntryTimingService,
    HyperliquidTradingStrategyService,
    HyperliquidTokenDiscoveryService,
    HyperliquidSignatureAdapter,
    HyperliquidClient,
    HyperliquidPlatformService,
  ],
})
export class HyperliquidModule {}
