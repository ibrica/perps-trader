# Trailing Take-Profit and DB-Only Stop-Loss Spec

### Scope

- Add a trailing mechanism that:
  - Triggers when price is close to current TP (80% progress from entry to TP).
  - Requires AI continuation signal to proceed.
  - Moves TP order up (exchange + DB) and tightens SL only in DB.

### Definitions

- progressToTp (LONG): (currentPrice - entryPrice) / (takeProfitPrice - entryPrice)
- progressToTp (SHORT): (entryPrice - currentPrice) / (entryPrice - takeProfitPrice)
- Close-to-TP threshold: progressToTp ≥ 0.8
- Continuation signal: predictor suggests same-direction continuation with sufficient confidence.

### Trailing Rules

- Direction-aware calculations:
  - LONG:
    - New SL (DB only): currentPrice × (1 - 0.02)
    - New TP (Exchange + DB): currentPrice × (1 + 0.10)
  - SHORT:
    - New SL (DB only): currentPrice × (1 + 0.02)
    - New TP (Exchange + DB): currentPrice × (1 - 0.10)
- AI gating:
  - Use `predictorAdapter.predictToken(token, category, ONE_HOUR, true)`.
  - LONG requires recommendation BUY (or positive percentage_change) with confidence ≥ 0.6.
  - SHORT requires recommendation SELL (or negative percentage_change magnitude) with confidence ≥ 0.6.
- Rate limiting: trail at most once every 5 minutes per position.
- Movement guard: only trail if new TP differs from current TP by ≥ 0.5%.
- SL orderbook: do NOT move SL on exchange; rely on minute monitor to exit if DB SL is breached.

### Exchange Operations (TP replace)

1. Find active TP trigger order(s) for the position in DB: `isTrigger=true` and `triggerType='tp'` and status in {CREATED, PARTIALLY_FILLED}.
2. Cancel each via exchange; mark them CANCELLED in DB.
3. Fetch current exchange position size (with retry) to handle partial fills.
4. Compute quoteAmount from size × currentPrice.
5. Place new TP trigger order (reduceOnly, isMarket=true) at new TP price.
6. Persist new TP order in DB and update `position.takeProfitPrice`.

### Scheduling and Flow

- Checked in the existing minute scheduler.
- Recommended sequence per cycle for each OPEN position:
  1. Evaluate and apply trailing (if eligible).
  2. Evaluate exit (stop-loss or TP breach) and AI exit.
- This ensures TP gets moved before a manual close might occur.

### Data Model

- Use existing fields: `stopLossPrice`, `takeProfitPrice`.
- Optional (nice-to-have): add `lastTrailAt?: Date`, `trailCount?: number` to avoid churn.

### Config (env or platform config)

- trailingActivationRatio: 0.8
- trailingStopOffsetPercent: 2
- trailingTpOffsetPercent: 10
- trailingMinIntervalMs: 300000
- predictorMinConfidence: 0.6

### Pseudocode

```ts
for (const pos of getOpenTradePositions()) {
  const price = getCurrentPrice(pos.platform, pos.token);
  const { entryPrice, takeProfitPrice, positionDirection } = pos;
  const progress =
    positionDirection === LONG
      ? (price - entryPrice) / (takeProfitPrice - entryPrice)
      : (entryPrice - price) / (entryPrice - takeProfitPrice);

  if (progress >= 0.8 && !rateLimited(pos)) {
    const ai = predictor.predictToken(token, category, ONE_HOUR, true);
    const continuationOk = directionAligned(ai, positionDirection, 0.6);
    if (
      continuationOk &&
      tpMoveIsSignificant(price, pos.takeProfitPrice, 0.005)
    ) {
      const newSl = positionDirection === LONG ? price * 0.98 : price * 1.02;
      const newTp = positionDirection === LONG ? price * 1.1 : price * 0.9;

      // DB updates
      updateTradePosition(pos.id, {
        stopLossPrice: newSl,
        takeProfitPrice: newTp,
        lastTrailAt: now,
        trailCount: +1,
      });

      // Exchange TP replace
      platform.replaceTakeProfitOrder(token, positionDirection, pos.id, newTp);
    }
  }

  // Then proceed with close logic (SL/TP breach or AI exit)
}
```

### Edge Cases

- Skip if price invalid, or TP/SL would be invalid relative to current price constraints.
- Skip if exchange position size = 0.
- Ensure `closeDirection` and `reduceOnly` are set when placing TP.
- Handle network or exchange errors with retry and safe logs.
