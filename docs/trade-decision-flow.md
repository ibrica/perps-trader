# Trade Decision Flow

**Perps Trader** - Comprehensive guide to how trading decisions are made from token discovery to position exit.

---

## Table of Contents

1. [Overview](#overview)
2. [Token Discovery](#1-token-discovery)
3. [Entry Decision](#2-entry-decision)
4. [Position Monitoring](#3-position-monitoring)
5. [Exit Decisions](#4-exit-decisions)
6. [Configuration Reference](#configuration-reference)

---

## Overview

The trading system follows a continuous loop:

```
┌─────────────────────────────────────────────────────────────┐
│                    TRADING LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

1. TOKEN DISCOVERY
   └─> Find tradeable tokens (buyFlag=true, market active)

2. ENTRY DECISION
   ├─> AI Prediction (confidence check)
   ├─> Entry Timing (multi-timeframe trends)
   └─> Direction validation

3. POSITION OPENED
   ├─> Create position record
   ├─> Place entry order
   └─> Set initial SL/TP orders

4. MONITORING (every minute)
   ├─> Check trailing conditions
   ├─> Update SL/TP if profitable
   └─> Evaluate exit signals

5. EXIT DECISION
   ├─> Manual triggers (closeAll, exitFlag)
   ├─> SL/TP breach
   └─> AI exit recommendation

6. POSITION CLOSED
   ├─> Place exit order
   ├─> Cancel SL/TP orders
   └─> Reset token buyFlag (ready for next trade)

[Loop back to 1]
```

**Execution Schedule:**
- **Trading Start**: On application bootstrap + every time position count drops
- **Position Monitoring**: Every minute via `TradeMonitorScheduler` cron job
- **Distributed Locking**: MongoDB-based locks prevent duplicate execution

---

## 1. Token Discovery

### 1.1 Database Schema

Tokens are defined in the `perps` collection with the following structure:

```typescript
{
  name: "Bitcoin",              // Display name
  token: "BTC",                 // Symbol (primary key)
  currency: "USD",              // Quote currency
  perpSymbol: "BTC-USD",        // Exchange symbol
  platform: "HYPERLIQUID",      // Trading platform
  buyFlag: true,                // ⭐ ELIGIBILITY GATE
  isActive: true,               // Active/inactive toggle
  marketDirection: "NEUTRAL",   // UP, DOWN, or NEUTRAL
  defaultLeverage: 3,           // Optional leverage override
  recommendedAmount: 100        // Optional position size override
}
```

**Key Fields:**
- **`buyFlag`**: Master control - must be `true` for token to be tradeable
- **`isActive`**: Administrative enable/disable toggle
- **`marketDirection`**: Not currently used in trading logic (defaulted to NEUTRAL)

### 1.2 Token Selection Pipeline

**File**: `HyperliquidTokenDiscoveryService.getTokensToTrade()`

```
┌──────────────────────────────────────────────────────────┐
│                  TOKEN SELECTION FILTERS                  │
└──────────────────────────────────────────────────────────┘

Filter 1: Database Query
├─ buyFlag = true
├─ isActive = true
└─ platform = HYPERLIQUID
        ↓
Filter 2: Exchange Market Exists
├─ Query Hyperliquid /info/meta endpoint
└─ Find matching market (e.g., "BTC" → "BTC-USD")
        ↓
Filter 3: Market Activity Check
├─ Get ticker data (bid, ask, mark)
├─ Validate bid > 0 && ask > 0
└─ Check spread < 10% (spread = (ask - bid) / mark)
        ↓
Filter 4: No Existing Position
└─ Skip tokens with existing OPEN positions
        ↓
Filter 5: AI Trading Strategy
└─ Call shouldEnterPosition() for final approval
        ↓
✅ TRADEABLE TOKENS
```

### 1.3 buyFlag Lifecycle

**Initial State:**
```javascript
// Admin enables trading for BTC
db.perps.updateOne(
  { token: 'BTC' },
  { $set: { buyFlag: true } }
)
```

**After Position Opens:**
```typescript
// System automatically disables to prevent duplicate positions
await perpService.update(perpId, { buyFlag: false });
```

**Re-enabling:**
```javascript
// Manual re-enable after position closes (if desired)
db.perps.updateOne(
  { token: 'BTC' },
  { $set: { buyFlag: true } }
)
```

**Purpose**: Prevents opening multiple positions on the same token simultaneously.

### 1.4 Market Activity Validation

**File**: `HyperliquidTokenDiscoveryService.isMarketActive()`

Markets must pass quality checks:

```typescript
const ticker = await hyperliquidService.getTicker(marketName);
const bid = parseFloat(ticker.bid);
const ask = parseFloat(ticker.ask);
const mark = parseFloat(ticker.mark);

// Check 1: Valid pricing
if (bid <= 0 || ask <= 0 || mark <= 0) {
  return false; // Invalid market
}

// Check 2: Reasonable spread
const spread = (ask - bid) / mark;
const maxSpreadPercent = 0.1; // 10%

if (spread > maxSpreadPercent) {
  return false; // Too illiquid
}

return true; // Market is active and tradeable
```

**Spread Threshold**: 10% maximum
- **Good**: BTC with 0.01% spread → ✅ Active
- **Bad**: Illiquid altcoin with 15% spread → ❌ Inactive

### 1.5 Caching

Token discovery results are cached for **15 minutes** to reduce API calls:

```typescript
private tokenCache = new Map<string, { tokens: string[], timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
```

**Cache Key**: Platform name (e.g., "HYPERLIQUID")

---

## 2. Entry Decision

### 2.1 Entry Decision Flow

**File**: `HyperliquidTradingStrategy.shouldEnterPosition()`

```
┌──────────────────────────────────────────────────────────┐
│                  ENTRY DECISION PIPELINE                  │
└──────────────────────────────────────────────────────────┘

Step 1: Platform Enabled Check
├─ Config: hyperliquid.enabled = true
└─ Reject if disabled
        ↓
Step 2: Perp Definition Exists
├─ Query perps collection by token
└─ Reject if no perp found
        ↓
Step 3: Position Limit Check
├─ Query open positions on Hyperliquid
├─ Compare to hyperliquid.maxOpenPositions
└─ Reject if at limit
        ↓
Step 4: AI Prediction
├─ Call predictorAdapter.predictToken()
├─ Get recommendation: BUY, SELL, or HOLD
└─ Get confidence score (0.0 - 1.0)
        ↓
Step 5: ⭐ Confidence Threshold Check (NEW)
├─ Config: hyperliquid.predictorMinConfidence (default 0.6)
└─ Reject if aiConfidence < threshold
        ↓
Step 6: HOLD Filter
└─ Reject if recommendation = HOLD
        ↓
Step 7: Direction Determination
├─ BUY → LONG position
└─ SELL → SHORT position
        ↓
Step 8: ⭐ Entry Timing Optimization (NEW)
├─ Fetch multi-timeframe trends (5m, 15m, 1hr)
├─ Evaluate timing via EntryTimingService
├─ Check: shouldEnterNow, timing, direction match
└─ Wait if timing says "wait_correction"
        ↓
Step 9: Combined Confidence Score
├─ combinedConfidence = aiConfidence × 0.7 + timingConfidence × 0.3
└─ Use as final confidence
        ↓
✅ APPROVE ENTRY
```

### 2.2 AI Prediction

**File**: `PredictorAdapter.predictToken()`

Request to external AI service:
```typescript
POST http://predictor:5001/predict
{
  "token_address": "BTC",
  "category": "MAIN_COINS",        // MAIN_COINS, ALT_COINS, MEME_TOKENS
  "prediction_horizon": "1h",      // 5m, 15m, 30m, 1h
  "include_reasoning": true
}
```

Response:
```typescript
{
  "recommendation": "BUY",         // BUY, SELL, or HOLD
  "confidence": 0.85,              // 0.0 - 1.0
  "percentage_change": 12.3,       // Predicted price change %
  "reasoning": {
    "key_factors": [...],
    "risk_factors": [...],
    "bot_activity": {...},
    "market_conditions": {...},
    "technical_indicators": {...}
  }
}
```

**Confidence Threshold Check**:
```typescript
const minConfidence = configService.get(
  'hyperliquid.predictorMinConfidence',
  0.6
);

if (aiPrediction.confidence < minConfidence) {
  return {
    shouldTrade: false,
    reason: `AI confidence ${confidence} below threshold ${minConfidence}`
  };
}
```

### 2.3 Entry Timing Optimization

**Files**:
- `EntryTimingService.evaluateEntryTiming()` - Main timing evaluation
- `ExtremeTrackingService` - Real OHLCV-based correction depth tracking

Uses multi-timeframe trend analysis combined with **real price extremes** to wait for optimal entry points.

**Strategy**:
- **Primary Trend (1hr)**: Determines position direction
- **Short Trend (5m/15m)**: Detects corrections and reversals
- **Real Extreme Tracking**: Uses actual OHLCV high/low prices to measure correction depth
- **Entry Signal**: When short timeframe reverses back toward primary trend with sufficient correction depth

**Examples**:

**LONG Entry (1hr UP)**:
```
1hr trend: UP (primary direction = LONG)
5m trend: DOWN → Correction in progress → WAIT ⏸️
5m trend: UP → Reversal detected → ENTER ✅
```

**SHORT Entry (1hr DOWN)**:
```
1hr trend: DOWN (primary direction = SHORT)
5m trend: UP → Correction in progress → WAIT ⏸️
5m trend: DOWN → Reversal detected → ENTER ✅
```

**Timing Evaluation Result**:
```typescript
{
  shouldEnterNow: true,            // Enter now or wait?
  direction: "LONG",               // Position direction from 1hr trend
  timing: "reversal_detected",     // immediate, wait_correction, reversal_detected
  confidence: 0.85,                // Timing confidence (0.0 - 1.0)
  reason: "Reversal detected: 5m turned UP after 2.5% correction",
  metadata: {
    primaryTrend: "UP",            // 1hr trend
    primaryTimeframe: "1h",
    correctionTrend: "UP",         // 5m trend
    correctionTimeframe: "5m",
    correctionDepthPct: 2.5,       // Depth of correction
    reversalDetected: true,
    trendAlignment: true
  }
}
```

#### 2.3.1 Real Extreme Tracking (NEW - v2024.2)

**What Changed**: Instead of using MA deviation as a proxy for correction depth, the system now fetches actual 1-minute OHLCV candles from the indexer and tracks real price extremes.

**How It Works**:

**For LONG positions** (waiting for price to rise from bottom):
```
1. Fetch last 60 minutes of 1m candles from indexer
2. Find LOWEST low_price across all candles (e.g., $49,000)
3. Current price: $50,470
4. Correction depth = (50,470 - 49,000) / 49,000 × 100 = 3.0%
5. If depth ≥ 1.5% threshold → Correction is deep enough
6. Wait for 5m trend to turn UP → ENTER LONG ✅
```

**For SHORT positions** (waiting for price to drop from peak):
```
1. Fetch last 60 minutes of 1m candles from indexer
2. Find HIGHEST high_price across all candles (e.g., $51,000)
3. Current price: $49,980
4. Correction depth = (51,000 - 49,980) / 51,000 × 100 = 2.0%
5. If depth ≥ 1.5% threshold → Correction is deep enough
6. Wait for 5m trend to turn DOWN → ENTER SHORT ✅
```

**Data Quality Validation**:
- ✅ Validates OHLCV integrity (high ≥ low, open/close within range)
- ✅ Checks minimum candle count (at least 50% of requested)
- ✅ Warns if data is stale (>5 minutes old)
- ✅ All prices must be positive
- ✅ Throws errors on corrupted data to prevent bad trades

**Fallback Behavior**:
- If extreme tracking fails: Falls back to MA deviation
- If indexer unavailable: Uses MA deviation as proxy
- Always logs which method is being used

**Configuration**:
```bash
# Entry Timing
HL_ENTRY_TIMING_ENABLED=true                        # Enable/disable (default: true)
HL_ENTRY_TIMING_SHORT_TF=5m                         # 5m or 15m for corrections
HL_ENTRY_TIMING_MIN_CORRECTION_PCT=1.5              # Minimum correction depth %
HL_ENTRY_TIMING_REVERSAL_CONFIDENCE=0.6             # Confidence for reversals

# Real Extreme Tracking (NEW)
HL_ENTRY_TIMING_USE_REAL_EXTREMES=true              # Enable OHLCV-based tracking (default: true)
HL_ENTRY_TIMING_EXTREME_LOOKBACK_MINUTES=60         # Lookback period for extremes (default: 60 = 1 hour)
```

**Service Integration**:
- **ExtremeTrackingService**: Fetches OHLCV from indexer, calculates extremes
- **IndexerAdapter**: Provides `/ohlcv` API endpoint for 1-minute candles
- **EntryTimingService**: Integrates extreme tracking into timing evaluation

**See**: [docs/extreme-tracking-feature.md](extreme-tracking-feature.md) for complete implementation details.

### 2.4 Direction Validation

After timing evaluation, validate direction matches AI prediction:

```typescript
const aiDirection = aiPrediction.recommendation === "BUY"
  ? PositionDirection.LONG
  : PositionDirection.SHORT;

if (timingEval.direction !== aiDirection) {
  return {
    shouldTrade: false,
    reason: `Direction mismatch: AI says ${aiDirection}, trends say ${timingEval.direction}`
  };
}
```

**Why?** Ensures AI prediction and trend analysis agree on direction.

### 2.5 Fallback: Market Momentum

If AI prediction unavailable, use simple market momentum:

```typescript
const ticker = await hyperliquidService.getTicker(token);
const markPrice = parseFloat(ticker.mark);
const bidPrice = parseFloat(ticker.bid);
const askPrice = parseFloat(ticker.ask);

// Check 1: Spread quality
const spread = (askPrice - bidPrice) / markPrice;
if (spread > 0.005) {  // > 0.5%
  return { shouldTrade: false, reason: "Spread too wide" };
}

// Check 2: Simple momentum
const momentum = markPrice > (bidPrice + askPrice) / 2 ? 'UP' : 'DOWN';
const direction = momentum === 'UP' ? LONG : SHORT;

return {
  shouldTrade: true,
  reason: `Market momentum ${momentum}`,
  confidence: 0.5  // Lower confidence for non-AI
};
```

**Use Case**: Backup when AI service is down or returns no prediction.

---

## 3. Position Monitoring

### 3.1 Monitoring Schedule

**File**: `TradeMonitorScheduler` (NestJS Cron Job)

```typescript
@Cron('* * * * *')  // Every minute
async monitorPositions() {
  // Distributed locking via MongoDB
  const lock = await lockService.acquireLock('trade-monitor', 55000);

  if (!lock) {
    return; // Another instance is running
  }

  try {
    await tradeManagerService.monitorAndClosePositions();
  } finally {
    await lockService.releaseLock('trade-monitor');
  }
}
```

**Monitoring Flow**:

```
Every 1 minute:
├─ Get all OPEN positions
├─ For each position:
│  ├─ Get current price
│  ├─ Step 1: Evaluate trailing (if eligible)
│  │  ├─ Check if price reached 80% to TP
│  │  ├─ Apply trailing if conditions met
│  │  └─ Update SL/TP prices
│  │
│  └─ Step 2: Evaluate exit conditions
│     ├─ Check manual triggers (closeAll, exitFlag)
│     ├─ Check SL/TP breach
│     ├─ Check AI exit recommendation
│     └─ Close position if any condition met
```

### 3.2 Trailing Stop-Loss & Take-Profit

**File**: `TrailingService.evaluateTrailing()`

**Purpose**: Lock in profits by moving SL/TP as price moves favorably.

**Activation Conditions**:

```typescript
// 1. Must have entry price and TP price
if (!entryPrice || !takeProfitPrice) {
  return { shouldTrail: false, reason: "Missing prices" };
}

// 2. Calculate progress to TP
const progressToTp = calculateProgressToTp(
  positionDirection,
  currentPrice,
  entryPrice,
  takeProfitPrice
);

// 3. Must reach activation threshold (default 80%)
const activationRatio = config.get('hyperliquid.trailingActivationRatio', 0.8);
if (progressToTp < activationRatio) {
  return {
    shouldTrail: false,
    reason: `Progress ${progressToTp*100}% below ${activationRatio*100}%`
  };
}

// 4. Rate limiting (prevent excessive updates)
const minIntervalMs = config.get('hyperliquid.trailingMinIntervalMs', 300000);
if (timeSinceLastTrail < minIntervalMs) {
  return { shouldTrail: false, reason: "Rate limited" };
}
```

**Progress Calculation**:

For **LONG** positions:
```typescript
const range = takeProfitPrice - entryPrice;
const progress = currentPrice - entryPrice;
const progressToTp = progress / range;

// Example: Entry $100, TP $120, Current $116
// range = $20, progress = $16
// progressToTp = 16/20 = 0.8 (80%)
```

For **SHORT** positions:
```typescript
const range = entryPrice - takeProfitPrice;
const progress = entryPrice - currentPrice;
const progressToTp = progress / range;

// Example: Entry $100, TP $80, Current $84
// range = $20, progress = $16
// progressToTp = 16/20 = 0.8 (80%)
```

**New Price Calculation**:

```typescript
// Take Profit: Move further out by offset %
const tpOffsetPercent = config.get('hyperliquid.trailingTpOffsetPercent', 10);

if (positionDirection === LONG) {
  newTP = currentPrice * (1 + tpOffsetPercent / 100);
} else {
  newTP = currentPrice * (1 - tpOffsetPercent / 100);
}

// Stop Loss: Tighten to lock in profits
const slOffsetPercent = config.get('hyperliquid.trailingStopOffsetPercent', 2);

if (positionDirection === LONG) {
  newSL = currentPrice * (1 - slOffsetPercent / 100);
} else {
  newSL = currentPrice * (1 + slOffsetPercent / 100);
}
```

**Example - LONG Position Trailing**:

```
Initial:
├─ Entry: $100
├─ SL: $90 (-10%)
└─ TP: $120 (+20%)

Price reaches $116 (80% to TP):
├─ Trigger trailing
├─ New TP: $116 × 1.10 = $127.60 (+10% from current)
└─ New SL: $116 × 0.98 = $113.68 (-2% from current)

Result:
├─ Locked in $13.68 profit (worst case if SL hits)
└─ Potential upside extended to $127.60
```

**Trailing Execution**:

```typescript
// 1. Update database (SL, TP, lastTrailAt, trailCount)
await tradePositionService.updateTradePosition(positionId, {
  stopLossPrice: newSL,
  takeProfitPrice: newTP,
  lastTrailAt: new Date(),
  trailCount: (position.trailCount || 0) + 1
});

// 2. Replace TP order on exchange
await platformManagerService.replaceTakeProfitOrder(
  platform,
  token,
  direction,
  positionId,
  newTP
);
// Note: SL is DB-only for trailing (manual fallback)
```

**Configuration**:
```bash
HL_TRAILING_ACTIVATION_RATIO=0.8          # Trigger at 80% to TP
HL_TRAILING_STOP_OFFSET_PERCENT=2         # New SL: current price - 2%
HL_TRAILING_TP_OFFSET_PERCENT=10          # New TP: current price + 10%
HL_TRAILING_MIN_INTERVAL_MS=300000        # 5 min between trails
```

### 3.3 Position State Tracking

**File**: `TradePosition.schema.ts`

```typescript
{
  token: "BTC",
  platform: "HYPERLIQUID",
  status: "OPEN",                    // CREATED, OPEN, CLOSED
  positionDirection: "LONG",         // LONG or SHORT
  entryPrice: 45000,                 // Filled entry price
  stopLossPrice: 40500,              // Current SL (trails)
  takeProfitPrice: 49500,            // Current TP (trails)
  lastTrailAt: Date,                 // Last trailing update
  trailCount: 3,                     // Number of times trailed
  exitFlag: false,                   // Manual exit trigger
  totalFilledSize: 0.1,              // Position size in base asset
  remainingSize: 0.1,                // After partial fills
  leverage: 3,
  positionSize: 100                  // Quote amount (USDC)
}
```

---

## 4. Exit Decisions

### 4.1 Exit Decision Flow

**File**: `TradeManager.shouldClosePosition()`

```
┌──────────────────────────────────────────────────────────┐
│                    EXIT EVALUATION                        │
└──────────────────────────────────────────────────────────┘

Priority 1: Manual Triggers (Highest Priority)
├─ Check settings.closeAllPositions
│  └─> If true: Close immediately ⚠️
│
├─ Check position.exitFlag
│  └─> If true: Close immediately ⚠️
│
Priority 2: Stop-Loss / Take-Profit Breach
├─ Get current price
├─ Compare to position.stopLossPrice
├─ Compare to position.takeProfitPrice
│  └─> If breached: Close immediately 🛑
│
Priority 3: AI Exit Recommendation
├─ Call platformManager.evaluateExitDecision(position)
├─ Get AI exit signal
│  ├─ shouldExit: boolean
│  ├─ reason: string
│  ├─ confidence: number
│  └─ urgency: "low" | "medium" | "high"
│
├─ If AI error: Ignore recommendation
└─> If shouldExit: Close position 🤖
│
❌ No exit signal: Keep position open
```

### 4.2 Manual Exit Triggers

**Global Close All**:
```typescript
// settings collection
{
  closeAllPositions: true  // Emergency stop
}

// Effect: Closes ALL open positions on next monitoring cycle
```

**Per-Position Exit Flag**:
```typescript
// Update specific position
await tradePositionService.updateTradePosition(positionId, {
  exitFlag: true
});

// Effect: Closes this position on next monitoring cycle
```

**Use Cases**:
- Emergency shutdown (closeAllPositions)
- Manual exit of specific position (exitFlag)
- Risk management override

### 4.3 SL/TP Breach Detection

**File**: `TradeManager.shouldClosePosition()`

```typescript
const stopLossPrice = position.stopLossPrice ?? -1;
const takeProfitPrice = position.takeProfitPrice ?? Number.MAX_VALUE;

// Check breach
if (currentPrice < stopLossPrice || currentPrice > takeProfitPrice) {
  logger.log(
    `Closing position for ${token}: SL/TP triggered
    (current: ${currentPrice}, SL: ${stopLossPrice}, TP: ${takeProfitPrice})`
  );
  return true;  // Close position
}
```

**Notes**:
- Works as **fallback** if exchange SL/TP orders fail
- Checked every minute by monitoring job
- Uses trailed prices (if trailing occurred)

### 4.4 AI Exit Recommendation

**File**: `HyperliquidTradingStrategy.shouldExitPosition()`

```
┌──────────────────────────────────────────────────────────┐
│                  AI EXIT EVALUATION                       │
└──────────────────────────────────────────────────────────┘

Step 1: Calculate Position PnL
├─ currentPrice vs entryPrice
├─ Adjust for position direction (LONG/SHORT)
└─> pnlPercent = ((current - entry) / entry) × 100

Step 2: Check Traditional SL/TP
├─ If PnL <= -stopLossPercent: Exit (high urgency)
└─> If PnL >= takeProfitPercent: Exit (medium urgency)

Step 3: Get AI Prediction
├─ Call predictorAdapter.predictToken(token, 1h)
└─> Get recommendation, confidence, predicted change

Step 4: Direction Reversal Check
├─ Current position: LONG
├─ AI recommendation: SELL
└─> Exit if AI opposes position direction

Step 5: Adverse Movement Check
├─ AI recommendation: HOLD
├─ Predicted change opposes position
│  ├─ LONG position + predicted change < -5%
│  └─> SHORT position + predicted change > +5%
└─> Exit if significant adverse movement predicted

Step 6: No Exit Signal
└─> Keep position open
```

**Exit Examples**:

**Example 1: Direction Reversal (LONG → SELL)**
```typescript
position: { direction: LONG, entryPrice: 100 }
currentPrice: 105
aiPrediction: {
  recommendation: SELL,    // Opposes LONG
  confidence: 0.85
}

→ Exit Decision: {
  shouldExit: true,
  reason: "AI recommends opposite direction (SELL)",
  confidence: 0.85,
  urgency: "high"
}
```

**Example 2: Adverse Movement (LONG + big drop predicted)**
```typescript
position: { direction: LONG, entryPrice: 100 }
currentPrice: 102
aiPrediction: {
  recommendation: HOLD,
  predictedChange: -7%     // Big drop predicted
}

→ Exit Decision: {
  shouldExit: true,
  reason: "AI predicts adverse movement (-7%)",
  confidence: 0.6,         // Reduced (0.85 × 0.7)
  urgency: "medium"
}
```

**Example 3: Keep Position (aligned direction)**
```typescript
position: { direction: LONG, entryPrice: 100 }
currentPrice: 105
aiPrediction: {
  recommendation: BUY,     // Aligns with LONG
  predictedChange: +5%
}

→ Exit Decision: {
  shouldExit: false,
  reason: "Position within acceptable range",
  confidence: 0.5,
  urgency: "low"
}
```

### 4.5 Exit Execution

**File**: `TradeManager.exitPosition()`

```
Exit Flow:
├─ 1. Get platform service
├─ 2. Call platformService.exitPosition(tradePosition)
│  ├─ Determine close direction (opposite of entry)
│  ├─ Get actual position size from exchange
│  ├─ Calculate close order size (quote amount)
│  ├─ Place market close order (IOC, reduceOnly)
│  └─> Return order result
│
├─ 3. Create exit order record
│  ├─ Store order ID, size, price
│  └─> Link to position
│
└─ 4. WebSocket handler updates position status
   ├─ Listen for fill event
   ├─ Calculate realized PnL
   ├─ Update position status to CLOSED
   └─> Cancel remaining SL/TP orders
```

**Important**:
- Uses **reduceOnly** flag to ensure order only closes position
- Uses **IOC** (Immediate or Cancel) for market execution
- Queries exchange for actual position size (handles partial fills)

---

## Configuration Reference

### Entry Decision

```bash
# AI Prediction
HL_PREDICTOR_MIN_CONFIDENCE=0.6                      # Minimum AI confidence (0.0-1.0)

# Entry Timing
HL_ENTRY_TIMING_ENABLED=true                         # Enable timing optimization
HL_ENTRY_TIMING_SHORT_TF=5m                          # Short timeframe (5m or 15m)
HL_ENTRY_TIMING_MIN_CORRECTION_PCT=1.5               # Min correction depth %
HL_ENTRY_TIMING_REVERSAL_CONFIDENCE=0.6              # Reversal confidence threshold

# Real Extreme Tracking (NEW - v2024.2)
HL_ENTRY_TIMING_USE_REAL_EXTREMES=true               # Use OHLCV-based extremes (default: true)
HL_ENTRY_TIMING_EXTREME_LOOKBACK_MINUTES=60          # Lookback period for extremes (default: 60m)
```

### Position Management

```bash
# Position Limits
HL_MAX_OPEN_POSITIONS=3                      # Max simultaneous positions
HL_DEFAULT_AMOUNT_IN=100                     # Default position size (USDC)
HL_DEFAULT_LEVERAGE=3                        # Default leverage

# Risk Management
HL_STOP_LOSS_PERCENT=10                      # Initial SL %
HL_TAKE_PROFIT_PERCENT=20                    # Initial TP %
HL_MAX_NOTIONAL_PER_ORDER=10000             # Max order size
```

### Trailing

```bash
# Trailing Parameters
HL_TRAILING_ACTIVATION_RATIO=0.8             # Trigger at 80% to TP
HL_TRAILING_STOP_OFFSET_PERCENT=2            # New SL: current - 2%
HL_TRAILING_TP_OFFSET_PERCENT=10             # New TP: current + 10%
HL_TRAILING_MIN_INTERVAL_MS=300000           # 5 min between trails
```

### Platform

```bash
# Hyperliquid
HL_ENABLED=true                              # Enable Hyperliquid trading
HL_API_URL=https://api.hyperliquid-testnet.xyz
HL_WS_URL=wss://api.hyperliquid-testnet.xyz/ws
HL_ADDRESS=0x...                             # Wallet address
HL_PRIVATE_KEY=encrypted_key                 # Encrypted private key
HL_KEY_SECRET=secret                         # Decryption key
```

---

## Key Files Reference

### Token Discovery
- `src/app/perps/Perp.schema.ts` - Token definitions
- `src/app/perps/Perp.service.ts` - Token management
- `src/app/hyperliquid/HyperliquidTokenDiscovery.service.ts` - Market validation

### Entry Decision
- `src/app/hyperliquid/HyperliquidTradingStrategy.service.ts` - Entry logic
- `src/app/hyperliquid/EntryTiming.service.ts` - Timing optimization
- `src/infrastructure/predictor/PredictorAdapter.ts` - AI predictions

### Monitoring
- `src/app/jobs/TradeMonitorScheduler.ts` - Cron job
- `src/app/trade-manager/TradeManager.service.ts` - Orchestration
- `src/app/trade-manager/Trailing.service.ts` - Trailing logic

### Exit Decision
- `src/app/trade-manager/TradeManager.service.ts` - Exit evaluation
- `src/app/hyperliquid/HyperliquidTradingStrategy.service.ts` - AI exit logic
- `src/app/hyperliquid/HyperliquidPlatform.service.ts` - Order execution

---

## Summary

**Trade Lifecycle**:
1. **Discovery**: Find tokens with `buyFlag=true` and active markets
2. **Entry**: AI + timing signals must align with >0.6 confidence
3. **Monitoring**: Every minute, check trailing and exit conditions
4. **Exit**: Manual triggers, SL/TP breach, or AI recommendation

**Key Safety Features**:
- Confidence thresholds prevent low-quality trades
- Entry timing waits for optimal entry points
- Trailing locks in profits as position moves favorably
- Multiple exit triggers ensure timely position closure
- Distributed locking prevents duplicate execution

**Performance Optimizations**:
- 15-minute caching for token discovery
- Rate limiting for trailing updates (5 min)
- Parallel order execution where possible
- Efficient database queries with proper indexing
