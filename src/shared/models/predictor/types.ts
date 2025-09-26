/**
 * TypeScript definitions for TraderAI Inference API
 * Generated from Python Pydantic schemas
 */

// Enums
export enum PredictionHorizon {
  ONE_MIN = '1m',
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
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral',
}

export enum TokenCategory {
  MEME_TOKENS = 'meme_tokens',
  MAIN_COINS = 'main_coins',
  ALT_COINS = 'alt_coins',
}

// Request types
export interface PredictionRequest {
  token_address: string;
  category: TokenCategory;
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

export interface ReasoningFactors {
  key_factors: string[];
  risk_factors: string[];
  bot_activity: BotActivityInfo;
  market_conditions: MarketConditions;
  technical_indicators: TechnicalIndicators;
}

// Main response types
export interface PredictionResponse {
  token_address: string;
  category: TokenCategory;
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

export interface ErrorResponse {
  error: string;
  detail?: string | null;
  timestamp: string; // ISO datetime string
}

// API Client helper types
export interface ApiResponse<T> {
  data?: T;
  error?: ErrorResponse;
}

// Example usage types
export type InferenceApiEndpoints = {
  predict: {
    request: PredictionRequest;
    response: PredictionResponse;
  };
  tokenStats: {
    request: TokenStatsRequest;
    response: TokenStatsResponse;
  };
  health: {
    request: never;
    response: HealthResponse;
  };
};
