// Export everything except ErrorResponse with explicit name
export {
  PredictionHorizon,
  Recommendation,
  MarketSentiment,
  TokenCategory,
  PredictionRequest,
  TokenStatsRequest,
  BotActivityInfo,
  MarketConditions,
  TechnicalIndicators,
  ReasoningFactors,
  PredictionResponse,
  TokenStatsResponse,
  HealthResponse,
  ErrorResponse as PredictorErrorResponse, // Alias to avoid conflict
  ApiResponse,
  InferenceApiEndpoints,
} from './types';
