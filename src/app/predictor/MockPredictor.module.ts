import { Module } from '@nestjs/common';
import { PredictorAdapter } from '../../infrastructure';
import {
  PredictionResponse,
  Recommendation,
  CoinCategory,
} from '../../shared/models/predictor/types';

@Module({
  providers: [
    {
      provide: PredictorAdapter,
      useValue: {
        predictToken: jest.fn().mockResolvedValue({
          token_address: 'mock-token-address',
          category: CoinCategory.MEME_TOKENS,
          recommendation: Recommendation.HOLD,
          confidence: 0.7,
          percentage_change: 0,
          predicted_curve_position_change: '0',
          reasoning: null,
          timestamp: new Date().toISOString(),
          model_version: 'mock-v1.0',
        } as PredictionResponse),
      },
    },
  ],
  exports: [PredictorAdapter],
})
export class MockPredictorModule {}
