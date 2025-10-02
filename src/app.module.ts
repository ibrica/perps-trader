import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './App.controller';
import { AppService } from './App.service';
import appConfig from './config/app.config';
import ddConfig from './config/dd-config';
import predictorConfig from './config/predictor.config';
import indexerConfig from './config/indexer.config';
import { hyperliquidConfig } from './config/hyperliquid.config';
import { HyperliquidModule } from './app/hyperliquid/Hyperliquid.module';
import { PerpModule } from './app/perps/Perp.module';
import { PlatformManagerModule } from './app/platform-manager/PlatformManager.module';
import { TradeManagerModule } from './app/trade-manager/TradeManager.module';
import { TradePositionModule } from './app/trade-position/TradePosition.module';
import { IndexerModule } from './app/indexer/Indexer.module';
import { PredictorModule } from './app/predictor/Predictor.module';
import { JobsModule } from './app/jobs/Jobs.module';
import { SettingsModule } from './app/settings/Settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        appConfig,
        ddConfig,
        predictorConfig,
        indexerConfig,
        hyperliquidConfig,
      ],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get('app.mongodbUri'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    HyperliquidModule,
    PerpModule,
    PlatformManagerModule,
    TradeManagerModule,
    TradePositionModule,
    IndexerModule,
    PredictorModule,
    JobsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
