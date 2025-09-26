import { Module } from '@nestjs/common';
import { HyperliquidPlatformService } from './HyperliquidPlatform.service';
import { HyperliquidService } from '../../infrastructure/hyperliquid/HyperliquidService';
import { HyperliquidModule } from './Hyperliquid.module';

@Module({
  imports: [HyperliquidModule],
  providers: [
    {
      provide: HyperliquidPlatformService,
      useFactory: (
        hyperliquidService?: HyperliquidService,
      ): HyperliquidPlatformService => {
        return new HyperliquidPlatformService(hyperliquidService);
      },
      inject: [{ token: HyperliquidService, optional: true }],
    },
  ],
  exports: [HyperliquidPlatformService],
})
export class HyperliquidPlatformModule {}
