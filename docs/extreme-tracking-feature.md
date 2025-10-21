# Extreme Tracking for Entry Timing Optimization

## Overview

This feature enhances the entry timing system by using **real OHLCV (Open/High/Low/Close/Volume) data** from the indexer service instead of relying on MA (Moving Average) deviation as a proxy for correction depth.

## Problem Being Solved

### Previous Approach (MA Deviation Proxy)
```
Price: $100 → $110 (peak) → $108 (current)
MA Deviation: 2% above MA
Issue: Doesn't know the actual peak was $110
Result: May enter too early, not recognizing this is only a 1.8% pullback from peak
```

### New Approach (Real Extremes)
```
Price: $100 → $110 (peak) → $108 (current)
OHLCV Extreme: High = $110
Correction Depth: 1.8% from peak ($110)
Result: Knows it needs to wait for deeper correction before entry
```

## Architecture

### Components Added

#### 1. Sol-Indexer Service Changes
**Files Modified:**
- `/Users/ibritvic/work/sol-indexer/internal/clickhouse/clickhouse.go`
  - Added `OHLCVCandle` struct (lines 869-878)
  - Added `GetOHLCVForMainCoin()` method (lines 880-929)
  - Added `GetOHLCVForAltCoin()` method (lines 931-980)

- `/Users/ibritvic/work/sol-indexer/internal/api/server.go`
  - Added `OHLCVCandleResponse` and `OHLCVResponse` types (lines 29-46)
  - Added `/ohlcv` route (line 69)
  - Added `handleOHLCV()` handler (lines 197-275)

**New API Endpoint:**
```
GET /ohlcv?token-symbol=BTC&limit=60

Response:
{
  "token_symbol": "BTC",
  "type": "main",
  "interval": "1m",
  "candles": [
    {
      "timestamp": "2025-10-21T15:04:05Z",
      "open_price": 50000.0,
      "high_price": 50500.0,
      "low_price": 49800.0,
      "close_price": 50200.0,
      "volume": 12345.67,
      "trade_count": 450
    },
    // ... up to 1440 candles (24 hours max)
  ]
}
```

#### 2. Perps-Trader Service Changes

**Files Modified:**
- [types.ts](../src/infrastructure/indexer/types.ts) - Added `OHLCVCandle` and `OHLCVResponse` interfaces
- [IndexerClient.ts](../src/infrastructure/indexer/IndexerClient.ts) - Added `getOHLCV()` method
- [IndexerAdapter.ts](../src/infrastructure/indexer/IndexerAdapter.ts) - Added `getOHLCV()` wrapper

**New File:**
- [ExtremeTrackingService.ts](../src/shared/services/entry-timing/ExtremeTrackingService.ts) - Core extreme tracking logic

**Files Updated:**
- [EntryTimingService.ts](../src/shared/services/entry-timing/EntryTimingService.ts) - Integrated extreme tracking

### Data Flow

```
1. Entry Timing Evaluation Triggered
         ↓
2. EntryTimingService.evaluateEntryTiming(token, trends, currentPrice)
         ↓
3. [IF useRealExtremes=true] ExtremeTrackingService.calculateCorrectionDepth()
         ↓
4. IndexerAdapter.getOHLCV(token, 60 minutes)
         ↓
5. Sol-Indexer API: GET /ohlcv?token-symbol=BTC&limit=60
         ↓
6. ClickHouse: SELECT high_price, low_price FROM main_coins_ohlcv
         ↓
7. Calculate Real Extreme (highest high or lowest low)
         ↓
8. Calculate Correction Depth: (currentPrice - extremePrice) / extremePrice
         ↓
9. Compare with minCorrectionPct threshold
         ↓
10. Return Entry Decision (enter now or wait)
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable/disable real extreme tracking (default: true)
HL_ENTRY_TIMING_USE_REAL_EXTREMES=true

# Lookback period for extreme detection in minutes (default: 60 = 1 hour)
HL_ENTRY_TIMING_EXTREME_LOOKBACK_MINUTES=60

# Minimum correction depth to consider entry (default: 1.5%)
HL_ENTRY_TIMING_MIN_CORRECTION_PCT=1.5
```

### Code Configuration

When initializing `EntryTimingService`, inject the `ExtremeTrackingService`:

```typescript
const indexerAdapter = new IndexerAdapter(
  process.env.INDEXER_HOST,
  parseInt(process.env.INDEXER_API_PORT)
);

const extremeTracker = new ExtremeTrackingService(indexerAdapter);

const entryTimingService = new EntryTimingService(
  {
    enabled: true,
    shortTimeframe: '5m',
    minCorrectionPct: 1.5,
    reversalConfidence: 0.6,
    useRealExtremes: true,  // NEW
    extremeLookbackMinutes: 60,  // NEW
  },
  extremeTracker  // NEW - inject the tracker
);
```

### Usage Example

```typescript
// With real extremes (NEW)
const currentPrice = 50200.0; // Current BTC price
const evaluation = await entryTimingService.evaluateEntryTiming(
  'BTC',
  trendsData,
  currentPrice  // Pass current price for extreme calculation
);

// Fallback to MA deviation (OLD - still supported)
const evaluation = await entryTimingService.evaluateEntryTiming(
  'BTC',
  trendsData
  // No currentPrice = uses MA deviation
);
```

## How It Works

### For LONG Positions

1. **Find Recent Low**: Scan last 60 minutes of 1m candles, find lowest `low_price`
2. **Calculate Upward Movement**: `(currentPrice - lowestPrice) / lowestPrice * 100`
3. **Check Threshold**: If movement ≥ `minCorrectionPct`, correction is deep enough
4. **Decision**: Wait for trend alignment before entry

Example:
```
Recent Low: $49,000
Current Price: $50,200
Correction Depth: +2.45% ✓ (> 1.5% threshold)
Decision: Wait for 5m trend to turn UP, then enter LONG
```

### For SHORT Positions

1. **Find Recent High**: Scan last 60 minutes of 1m candles, find highest `high_price`
2. **Calculate Downward Movement**: `(highestPrice - currentPrice) / highestPrice * 100`
3. **Check Threshold**: If movement ≥ `minCorrectionPct`, correction is deep enough
4. **Decision**: Wait for trend alignment before entry

Example:
```
Recent High: $51,500
Current Price: $50,200
Correction Depth: +2.52% ✓ (> 1.5% threshold)
Decision: Wait for 5m trend to turn DOWN, then enter SHORT
```

## Advantages

### 1. **Accurate Correction Measurement**
- Tracks actual price peaks and bottoms from OHLCV data
- No longer reliant on MA deviation proxy
- Knows the true extreme price points

### 2. **Better Entry Timing**
- Waits for meaningful pullbacks before entry
- Avoids entering at local tops/bottoms
- Reduces risk of catching a falling knife (LONG) or shorting a rally (SHORT)

### 3. **Configurable Lookback**
- Adjustable time window (default 60 minutes)
- Can be tuned for different market conditions
- Prevents stale extremes from affecting decisions

### 4. **Graceful Fallback**
- If OHLCV data unavailable, falls back to MA deviation
- No breaking changes to existing behavior
- Can be disabled entirely via config

## Limitations

1. **External Dependency**: Requires sol-indexer service to be running and healthy
2. **Data Availability**: Only works for main/alt coins with OHLCV data (not meme coins)
3. **Network Latency**: Additional API call to fetch OHLCV data (~50-100ms)
4. **Lookback Window**: Fixed window may miss longer-term extremes outside the period

## Testing

### Manual Testing

1. **Start sol-indexer** with ClickHouse connection
2. **Verify OHLCV endpoint**:
   ```bash
   curl "http://localhost:7071/ohlcv?token-symbol=BTC&limit=60"
   ```
3. **Enable feature** in perps-trader config
4. **Monitor logs** for extreme tracking messages:
   ```
   Using real extreme depth for BTC: 2.45% (extreme: 49000, current: 50200)
   ```

### Unit Testing

See [TODO: Add tests for extreme tracking logic](#tests-needed)

## Next Steps

1. **Add comprehensive tests** for `ExtremeTrackingService`
2. **Monitor performance** of OHLCV API calls
3. **Consider caching** recent extremes to reduce API calls
4. **Experiment with lookback periods** for different assets
5. **Add metrics** to track entry timing accuracy

## Related Documentation

- [Trade Decision Flow](./trade-decision-flow.md)
- [Entry Timing Service](../src/shared/services/entry-timing/EntryTimingService.ts)
- [Extreme Tracking Service](../src/shared/services/entry-timing/ExtremeTrackingService.ts)
