import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './App.controller';
import { AppService } from './App.service';
import appConfig from './config/app.config';
import ddConfig from './config/dd-config';
import predictorConfig from './config/predictor.config';
import indexerConfig from './config/indexer.config';
import authConfig from './config/auth.config';
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
import { DashboardModule } from './app/dashboard/Dashboard.module';
import { AuthModule } from './app/auth/Auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        appConfig,
        ddConfig,
        predictorConfig,
        indexerConfig,
        authConfig,
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
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    HyperliquidModule,
    PerpModule,
    PlatformManagerModule,
    TradeManagerModule,
    TradePositionModule,
    IndexerModule,
    PredictorModule,
    JobsModule,
    SettingsModule,
    AuthModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
