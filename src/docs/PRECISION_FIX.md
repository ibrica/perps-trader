# Precision Fix for Position Calculations

## Problem

The codebase was using direct floating-point multiplication for calculating quote amounts from position sizes and prices, which can lead to precision issues due to JavaScript's floating-point arithmetic limitations.

### Example Issue
```typescript
const positionSize = 0.00001; // BTC
const currentPrice = 50000;   // USD
const quoteAmount = positionSize * currentPrice; // Could be 0.5000000000000001 instead of 0.5
```

For financial calculations, these small errors can accumulate and cause issues when:
- Closing positions (incorrect amounts sent to exchange)
- Creating SL/TP orders (mismatched position sizes)
- Calculating realized P&L

## Solution

Created precision utility functions in `src/shared/utils/precision.ts`:

### 1. `roundToDecimals(value, decimals)`
Rounds a number to a specified number of decimal places using proper rounding.

### 2. `roundToCents(amount)`
Convenience function to round financial amounts to 2 decimal places (cents).

### 3. `calculateQuoteAmount(size, price)`
**Main function for position calculations** - calculates quote amount from size and price with proper rounding to nearest cent.

## Changes Made

### Files Modified

1. **`src/shared/utils/precision.ts`** (new)
   - Core precision utilities
   - Handles floating-point edge cases
   - Rounds to nearest cent for USDC/USD amounts

2. **`src/shared/utils/precision.spec.ts`** (new)
   - Comprehensive test suite with 25 tests
   - Tests edge cases, real-world scenarios, and stress tests
   - All tests passing ✓

3. **`src/shared/utils/index.ts`**
   - Exported new precision utilities

4. **`src/app/hyperliquid/HyperliquidPlatform.service.ts`**
   - Line 256: Using `calculateQuoteAmount()` for SL/TP order creation
   - Line 401: Using `calculateQuoteAmount()` for position closing
   - Imported `calculateQuoteAmount` from shared utilities

### Before
```typescript
const quoteAmount = actualSize * currentPrice;
```

### After
```typescript
import { calculateQuoteAmount } from '../../shared';
const quoteAmount = calculateQuoteAmount(actualSize, currentPrice);
```

## Testing

### Unit Tests
All 25 precision tests pass, including:
- Floating-point precision issues (0.1 + 0.2 = 0.3)
- Real-world trading scenarios (BTC, ETH positions)
- Edge cases (negative sizes, zero values, large positions)
- Boundary tests (rounding up/down)
- Stress tests (1000 calculations maintaining precision)

### Build
✓ TypeScript compilation successful
✓ No type errors
✓ No linting issues

## Benefits

1. **Accuracy**: Quote amounts always rounded to nearest cent
2. **Consistency**: Same precision handling across all calculations
3. **Safety**: Prevents exchange rejections due to precision errors
4. **Tested**: Comprehensive test coverage for edge cases
5. **Maintainable**: Centralized precision logic, easy to update

## Edge Cases Handled

- Very small positions (0.000001 BTC at $50k = $0.05)
- Negative position sizes (uses absolute value)
- Zero values (size or price)
- Very large positions (100 BTC at $50k = $5M)
- Floating-point accumulation errors
- JavaScript's floating-point representation quirks

## Recommendation

Use `calculateQuoteAmount(size, price)` anywhere you need to calculate quote amounts from position sizes and prices. This ensures consistent precision handling across the codebase.

### Good
```typescript
const quoteAmount = calculateQuoteAmount(positionSize, currentPrice);
```

### Avoid
```typescript
const quoteAmount = positionSize * currentPrice; // May have precision issues
const quoteAmount = Math.round(positionSize * currentPrice * 100) / 100; // Verbose, inconsistent
```
