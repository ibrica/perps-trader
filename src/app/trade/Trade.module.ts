import { Global, Module } from '@nestjs/common';
import { TradeService } from './Trade.service';
import { RaydiumModule } from '../raydium/Raydium.module';
import { BaseTxModule } from '../base-tx';
import { BlockchainModule } from '../blockchain';
import { CurrencyModule } from '../currency';
import { TradeRepository } from './Trade.repository';
import { BlockchainServiceProviderModule } from '../blockchain-service-provider';
import { MongooseModule } from '@nestjs/mongoose';
import { Trade, TradeSchema } from './Trade.schema';
import { PumpFunModule } from '../pumpfun/PumpFun.module';
import { HyperliquidPlatformModule } from '../hyperliquid/HyperliquidPlatform.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Trade.name, schema: TradeSchema }]),
    CurrencyModule,
    BlockchainModule,
    BlockchainServiceProviderModule,
    BaseTxModule,
    // TradeEventProducerModule, Maybe sometimes in the future we will use a message queue, for now overkill
    RaydiumModule,
    PumpFunModule,
    HyperliquidPlatformModule,
  ],
  providers: [
    TradeService,
    TradeRepository,
    // Platform services will be provided by their respective modules when imported
  ],
  exports: [TradeService],
})
export class TradeModule {}
