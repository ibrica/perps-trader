import { Module } from '@nestjs/common';
import { PlatformManagerService } from './PlatformManagerService';
import { HyperliquidTokenDiscoveryService } from '../hyperliquid/HyperliquidTokenDiscovery.service';
import { HyperliquidTradingStrategyService } from '../hyperliquid/HyperliquidTradingStrategy.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidModule } from '../hyperliquid/Hyperliquid.module';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PerpModule } from '../perps/Perp.module';
import { PredictorModule } from '../predictor/Predictor.module';
import { Platform } from '../../shared';

@Module({
  imports: [
    HyperliquidModule,
    TradePositionModule,
    PerpModule,
    PredictorModule,
  ],
  providers: [
    PlatformManagerService,
    HyperliquidTokenDiscoveryService,
    HyperliquidTradingStrategyService,
    HyperliquidService,
    {
      provide: 'PLATFORM_MANAGER_INITIALIZED',
      useFactory: (
        platformManager: PlatformManagerService,
        hyperliquidTokenDiscovery: HyperliquidTokenDiscoveryService,
        hyperliquidTradingStrategy: HyperliquidTradingStrategyService,
        hyperliquidService: HyperliquidService,
      ): boolean => {
        // Register only Hyperliquid platform
        platformManager.registerPlatform(
          hyperliquidTokenDiscovery,
          hyperliquidTradingStrategy,
        );

        // Register Hyperliquid platform service
        platformManager.registerPlatformService(
          Platform.HYPERLIQUID,
          hyperliquidService,
        );

        return true;
      },
      inject: [
        PlatformManagerService,
        HyperliquidTokenDiscoveryService,
        HyperliquidTradingStrategyService,
        HyperliquidService,
      ],
    },
  ],
  exports: [PlatformManagerService],
})
export class PlatformManagerModule {}
