import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HyperliquidPlatformService } from './HyperliquidPlatform.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidWebSocketService } from '../../infrastructure/hyperliquid/HyperliquidWebSocket.service';
import { HyperliquidModule } from './Hyperliquid.module';
import { TradeOrderModule } from '../trade-order/TradeOrder.module';
import { TradeOrderService } from '../trade-order/TradeOrder.service';

@Module({
  imports: [HyperliquidModule, TradeOrderModule],
  providers: [
    {
      provide: HyperliquidPlatformService,
      useFactory: (
        configService: ConfigService,
        hyperliquidService?: HyperliquidService,
        hyperliquidWebSocket?: HyperliquidWebSocketService,
        tradeOrderService?: TradeOrderService,
      ): HyperliquidPlatformService => {
        return new HyperliquidPlatformService(
          configService,
          hyperliquidService,
          hyperliquidWebSocket,
          tradeOrderService,
        );
      },
      inject: [
        ConfigService,
        { token: HyperliquidService, optional: true },
        { token: HyperliquidWebSocketService, optional: true },
        { token: TradeOrderService, optional: true },
      ],
    },
  ],
  exports: [HyperliquidPlatformService],
})
export class HyperliquidPlatformModule {}
