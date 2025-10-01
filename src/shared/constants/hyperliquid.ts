// Hyperliquid API Constants
import { Currency } from './Currency';

// API Endpoints
export const HL_ENDPOINTS = {
  // Trading endpoints
  PLACE_ORDER: '/exchange',
  CANCEL_ORDER: '/exchange',
  CANCEL_ALL_ORDERS: '/exchange',

  // Info endpoints
  META: '/info',
  ALL_MIDS: '/info',
  USER_STATE: '/info',
  OPEN_ORDERS: '/info',
  USER_FILLS: '/info',
  FUNDING_HISTORY: '/info',
  L2_SNAPSHOT: '/info',
  CANDLE_SNAPSHOT: '/info',
};

// Request types for different endpoints
export const HL_ACTION_TYPES = {
  // Exchange actions
  ORDER: 'order',
  CANCEL: 'cancel',
  CANCEL_BY_CLOID: 'cancelByCloid',
  BATCH_MODIFY: 'batchModify',
  UPDATE_LEVERAGE: 'updateLeverage',
  UPDATE_ISOLATED_MARGIN: 'updateIsolatedMargin',
  VAULT_TRANSFER: 'vaultTransfer',

  // Info types
  META: 'meta',
  ALL_MIDS: 'allMids',
  PERPS_META_AND_ASSET_CTXS: 'metaAndAssetCtxs',
  CLEARINGHOUSE_STATE: 'clearinghouseState',
  USER_STATE: 'userState',
  OPEN_ORDERS: 'openOrders',
  USER_FILLS: 'userFills',
  USER_RATE_LIMIT: 'userRateLimit',
  ORDER_STATUS: 'orderStatus',
  L2_BOOK: 'l2Book',
  CANDLES: 'candles',
};

// Order types
export const HL_ORDER_TYPES = {
  LIMIT: 'limit',
  TRIGGER: 'trigger',
  STOP_LIMIT: 'stop_limit',
  STOP_MARKET: 'stop_market',
  TAKE_PROFIT: 'take_profit',
};

// Time in force options
export const HL_TIF = {
  GTC: 'Gtc', // Good till cancelled
  IOC: 'Ioc', // Immediate or cancel
  ALO: 'Alo', // Add liquidity only (post-only)
};

// Order request structure keys
export const HL_ORDER_KEYS = {
  ASSET: 'asset',
  IS_BUY: 'isBuy',
  LIMIT_PX: 'limitPx',
  SZ: 'sz',
  REDUCE_ONLY: 'reduceOnly',
  ORDER_TYPE: 'orderType',
  TIF: 'tif',
  CLOID: 'cloid', // Client order ID
};

// Headers for authentication
export const HL_HEADERS = {
  SIGNATURE: 'X-Signature',
  TIMESTAMP: 'X-Timestamp',
  ADDRESS: 'X-Account',
  NONCE: 'X-Nonce',
  CONTENT_TYPE: 'Content-Type',
};

// Error codes from Hyperliquid
export const HL_ERROR_CODES = {
  INSUFFICIENT_MARGIN: 'InsufficientMargin',
  ORDER_SIZE_TOO_SMALL: 'OrderSizeTooSmall',
  INVALID_PRICE: 'InvalidPrice',
  RATE_LIMIT_EXCEEDED: 'RateLimitExceeded',
  INVALID_SIGNATURE: 'InvalidSignature',
  POSITION_SIZE_EXCEEDED: 'PositionSizeExceeded',
  MAX_OPEN_ORDERS: 'MaxOpenOrders',
  REDUCE_ONLY_VIOLATION: 'ReduceOnlyViolation',
};

// Default values
export const HL_DEFAULTS = {
  MAINNET_API_URL: 'https://api.hyperliquid.xyz',
  TESTNET_API_URL: 'https://api.hyperliquid-testnet.xyz',

  // Rate limits (requests per second)
  RATE_LIMIT_INFO: 20,
  RATE_LIMIT_EXCHANGE: 10,

  // Precision and limits
  DEFAULT_PRICE_PRECISION: 5,
  DEFAULT_SIZE_PRECISION: 3,
  MIN_ORDER_SIZE_USD: 10,

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  RETRY_MULTIPLIER: 2,
};

// Symbol mapping (if needed for internal consistency)
export const HL_SYMBOL_MAP: Record<string, string> = {
  SOL: 'SOL-PERP',
  ETH: 'ETH-PERP',
  BTC: 'BTC-PERP',
  // Add more mappings as needed
};

// Reverse symbol mapping
export const HL_SYMBOL_REVERSE_MAP: Record<string, string> = Object.entries(
  HL_SYMBOL_MAP,
).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {});

export const HL_BASE_CURRENCY_DECIMALS = 6;

export const HL_DEFAULT_CURRENCY_FROM = Currency.USDC;
