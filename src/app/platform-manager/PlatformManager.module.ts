import { Module } from '@nestjs/common';
import { PlatformManagerService } from './PlatformManagerService';
import { HyperliquidTokenDiscoveryService } from '../hyperliquid/HyperliquidTokenDiscovery.service';
import { HyperliquidTradingStrategyService } from '../hyperliquid/HyperliquidTradingStrategy.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidModule } from '../hyperliquid/Hyperliquid.module';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PerpModule } from '../perps/Perp.module';
import { PredictorModule } from '../predictor/Predictor.module';
import { HyperliquidPlatformService } from '../hyperliquid/HyperliquidPlatform.service';

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
        hyperliquidPlatformService: HyperliquidPlatformService,
      ): boolean => {
        // Register only Hyperliquid platform
        platformManager.registerPlatform(
          hyperliquidTokenDiscovery,
          hyperliquidTradingStrategy,
          hyperliquidPlatformService,
        );

        return true;
      },
      inject: [
        PlatformManagerService,
        HyperliquidTokenDiscoveryService,
        HyperliquidTradingStrategyService,
        HyperliquidPlatformService,
      ],
    },
  ],
  exports: [PlatformManagerService],
})
export class PlatformManagerModule {}
