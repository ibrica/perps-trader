import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
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
import { CryptoJsService } from '../../infrastructure';

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

    // Platform services
    HyperliquidTradingStrategyService,
    HyperliquidTokenDiscoveryService,
  ],
  exports: [
    HyperliquidService,
    HyperliquidTradingStrategyService,
    HyperliquidTokenDiscoveryService,
    HyperliquidSignatureAdapter,
    HyperliquidClient,
  ],
})
export class HyperliquidModule {}
