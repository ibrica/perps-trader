import { Module } from '@nestjs/common';
import { PlatformManagerService } from './PlatformManagerService';
import { HyperliquidTokenDiscoveryService } from '../hyperliquid/HyperliquidTokenDiscovery.service';
import { HyperliquidTradingStrategyService } from '../hyperliquid/HyperliquidTradingStrategy.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import { HyperliquidModule } from '../hyperliquid/Hyperliquid.module';
import { TradePositionModule } from '../trade-position/TradePosition.module';
import { PerpModule } from '../perps/Perp.module';
import { PredictorModule } from '../predictor/Predictor.module';
import { HyperliquidPlatformService } from '../hyperliquid/HyperliquidPlatform.service';
import { IndexerModule } from '../indexer/Indexer.module';

@Module({
  imports: [
    HyperliquidModule,
    TradePositionModule,
    PerpModule,
    PredictorModule,
    IndexerModule,
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
        hyperliquidWebSocketService: HyperliquidWebSocketService,
      ): boolean => {
        // Register Hyperliquid platform with WebSocket support
        platformManager.registerPlatform(
          hyperliquidTokenDiscovery,
          hyperliquidTradingStrategy,
          hyperliquidPlatformService,
          hyperliquidWebSocketService,
        );

        return true;
      },
      inject: [
        PlatformManagerService,
        HyperliquidTokenDiscoveryService,
        HyperliquidTradingStrategyService,
        HyperliquidPlatformService,
        HyperliquidWebSocketService,
      ],
    },
  ],
  exports: [PlatformManagerService],
})
export class PlatformManagerModule {}
