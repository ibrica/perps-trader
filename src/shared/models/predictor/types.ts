/**
 * TypeScript definitions for TraderAI Inference API v1.1.0
 * Generated from Python Pydantic schemas
 */

// Enums
export enum PredictionHorizon {
  FIVE_MIN = '5m',
  FIFTEEN_MIN = '15m',
  THIRTY_MIN = '30m',
  ONE_HOUR = '1h',
}

export enum Recommendation {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum MarketSentiment {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

export enum TokenCategory {
  MEME_TOKENS = 'MEME_TOKENS',
  MAIN_COINS = 'MAIN_COINS',
  ALT_COINS = 'ALT_COINS',
}

// Request types
export interface PredictionRequest {
  token_address: string;
  category?: TokenCategory;
  prediction_horizon?: PredictionHorizon;
  include_reasoning?: boolean;
}

export interface EnsemblePredictionRequest {
  token_address: string;
  category?: TokenCategory;
  ensemble_horizons?: number[];
  include_reasoning?: boolean;
}

export interface CategoryPredictionRequest {
  token_symbol: string;
  token_category: TokenCategory;
  prediction_horizon?: PredictionHorizon;
  include_reasoning?: boolean;
}

export interface TokenStatsRequest {
  token_address: string;
  hours?: number;
}

// Response components
export interface BotActivityInfo {
  bot_addresses_count: number;
  recent_bot_trades: number;
  sell_ratio: number;
  exit_velocity: number;
  is_exiting: boolean;
}

export interface MarketConditions {
  sentiment: MarketSentiment;
  confidence: number;
  buy_ratio: number;
  volume_ratio: number;
  total_trades: number;
}

export interface TechnicalIndicators {
  rsi?: number | null;
  macd?: number | null;
  bb_position?: number | null;
  volume_trend?: string | null;
  curve_position_momentum?: string | null;
}

export interface EnsembleDetails {
  voting_horizons: number[];
  votes_cast: Record<string, number>;
  required_consensus: number;
  confidence_weighted_average?: number;
}

export interface ReasoningFactors {
  key_factors: string[];
  risk_factors: string[];
  bot_activity: BotActivityInfo;
  market_conditions: MarketConditions;
  technical_indicators: TechnicalIndicators;
  ensemble_details?: EnsembleDetails;
}

// Main response types
export interface PredictionResponse {
  token_address: string;
  category?: TokenCategory;
  recommendation: Recommendation;
  confidence: number;
  predicted_curve_position_change: string;
  percentage_change: number;
  reasoning?: ReasoningFactors | null;
  timestamp: string; // ISO datetime string
  model_version: string;
}

export interface CategoryPredictionResponse {
  token_symbol: string;
  token_category: TokenCategory;
  recommendation: Recommendation;
  confidence: number;
  predicted_curve_position_change: string;
  percentage_change: number;
  reasoning?: ReasoningFactors | null;
  timestamp: string; // ISO datetime string
  model_version: string;
}

export interface TokenStatsResponse {
  token_address: string;
  total_trades: number;
  buy_trades: number;
  sell_trades: number;
  buy_sell_ratio: number;
  unique_traders: number;
  avg_collateral: number;
  first_trade?: string | null; // ISO datetime string
  last_trade?: string | null; // ISO datetime string
}

export interface HealthResponse {
  status: string;
  timestamp: string; // ISO datetime string
  model_loaded: boolean;
  clickhouse_connected: boolean;
}

export interface PredictorErrorResponse {
  error: string;
  detail?: string | null;
  timestamp: string; // ISO datetime string
}

// Trends API types
export enum TrendTimeframe {
  FIVE_MIN = '5m',
  FIFTEEN_MIN = '15m',
  ONE_HOUR = '1h',
  EIGHT_HOUR = '8h',
  ONE_DAY = '1d',
}

export enum TrendStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  NEUTRAL = 'NEUTRAL',
  UNDEFINED = 'UNDEFINED',
}

export interface TrendInfo {
  trend: TrendStatus;
  change_pct: number | null; // null when trend is UNDEFINED, otherwise percentage change from MA
  price: number | null; // null when trend is UNDEFINED, otherwise current price
  ma: number | null; // null when trend is UNDEFINED, otherwise moving average value
}

// Type guard to check if trend has valid data
export function isTrendDefined(trend: TrendInfo): trend is TrendInfo & {
  change_pct: number;
  price: number;
  ma: number;
} {
  return (
    trend.trend !== TrendStatus.UNDEFINED &&
    trend.change_pct !== null &&
    trend.price !== null &&
    trend.ma !== null
  );
}

export interface TrendsResponse {
  token: string;
  timestamp: string; // ISO datetime string
  trends: Record<TrendTimeframe, TrendInfo>;
}

// API Client helper types
export interface ApiResponse<T> {
  data?: T;
  error?: PredictorErrorResponse;
}

// Example usage types
export type InferenceApiEndpoints = {
  predict: {
    request: PredictionRequest;
    response: PredictionResponse;
  };
  predictEnsemble: {
    request: EnsemblePredictionRequest;
    response: PredictionResponse;
  };
  predictCategory: {
    request: CategoryPredictionRequest;
    response: CategoryPredictionResponse;
  };
  tokenStats: {
    request: TokenStatsRequest;
    response: TokenStatsResponse;
  };
  health: {
    request: never;
    response: HealthResponse;
  };
  trends: {
    request: { token: string };
    response: TrendsResponse;
  };
};

// Helper types for TypeScript client usage
export type EnsembleVote = 'BUY' | 'SELL' | 'HOLD';
export type GatingReason =
  | 'Low conviction'
  | 'Weak context'
  | 'Below action thresholds';

// Configuration types
export interface PredictionConfig {
  action_prob_min?: number;
  margin_over_hold?: number;
  prob_spread_min?: number;
  min_volume_multiplier?: number;
  min_vol_norm?: number;
  ensemble_enabled?: boolean;
  ensemble_horizons?: number[];
}
