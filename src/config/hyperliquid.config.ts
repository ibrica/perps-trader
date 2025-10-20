import { registerAs } from '@nestjs/config';

export const hyperliquidConfig = registerAs('hyperliquid', () => ({
  // Feature flag
  enabled: process.env.HL_ENABLED === 'true' || false,

  // Environment
  env: process.env.HL_ENV || 'testnet',

  // API endpoints
  apiUrl: process.env.HL_API_URL || 'https://api.hyperliquid-testnet.xyz',
  wsUrl: process.env.HL_WS_URL || 'wss://api.hyperliquid-testnet.xyz/ws',
  infoUrl:
    process.env.HL_INFO_URL ||
    process.env.HL_API_URL ||
    'https://api.hyperliquid-testnet.xyz/info',

  // Account configuration
  address: process.env.HL_ADDRESS,
  privateKey: process.env.HL_PRIVATE_KEY,
  keySecret: process.env.HL_KEY_SECRET,

  // Trading parameters
  defaultLeverage: parseInt(process.env.HL_DEFAULT_LEVERAGE || '3'),
  maxOpenPositions: parseInt(process.env.HL_MAX_OPEN_POSITIONS || '1'),
  stopLossPercent: parseFloat(process.env.HL_STOP_LOSS_PERCENT || '10'),
  takeProfitPercent: parseFloat(process.env.HL_TAKE_PROFIT_PERCENT || '20'),
  defaultAmountIn: parseFloat(process.env.HL_DEFAULT_AMOUNT_IN || '10'), // 10 USDC

  // HTTP client configuration
  timeoutMs: parseInt(process.env.HL_TIMEOUT_MS || '30000'),
  retryMaxAttempts: parseInt(process.env.HL_RETRY_MAX_ATTEMPTS || '3'),
  retryBaseDelayMs: parseInt(process.env.HL_RETRY_BASE_DELAY_MS || '1000'),

  // Risk management
  maxLeveragePerSymbol: parseInt(
    process.env.HL_MAX_LEVERAGE_PER_SYMBOL || '10',
  ),
  maxNotionalPerOrder: parseFloat(
    process.env.HL_MAX_NOTIONAL_PER_ORDER || '10000',
  ),
  maxTotalNotional: parseFloat(process.env.HL_MAX_TOTAL_NOTIONAL || '50000'),

  // Trailing stop-loss and take-profit configuration
  trailingActivationRatio: parseFloat(
    process.env.HL_TRAILING_ACTIVATION_RATIO || '0.8',
  ),
  trailingStopOffsetPercent: parseFloat(
    process.env.HL_TRAILING_STOP_OFFSET_PERCENT || '2',
  ),
  trailingTpOffsetPercent: parseFloat(
    process.env.HL_TRAILING_TP_OFFSET_PERCENT || '10',
  ),
  trailingMinIntervalMs: parseInt(
    process.env.HL_TRAILING_MIN_INTERVAL_MS || '300000',
  ), // 5 minutes default

  // AI Prediction configuration
  predictorMinConfidence: parseFloat(
    process.env.HL_PREDICTOR_MIN_CONFIDENCE || '0.6',
  ),

  // Entry timing optimization configuration
  entryTimingEnabled:
    process.env.HL_ENTRY_TIMING_ENABLED === 'false' ? false : true, // Default enabled
  entryTimingShortTimeframe: process.env.HL_ENTRY_TIMING_SHORT_TF || '5m', // 5m or 15m
  entryTimingMinCorrectionPct: parseFloat(
    process.env.HL_ENTRY_TIMING_MIN_CORRECTION_PCT || '1.5',
  ), // Minimum correction depth percentage
  entryTimingReversalConfidence: parseFloat(
    process.env.HL_ENTRY_TIMING_REVERSAL_CONFIDENCE || '0.6',
  ), // Confidence for reversal detection
}));
