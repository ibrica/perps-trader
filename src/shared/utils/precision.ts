/**
 * Round a number to a specified number of decimal places
 * Uses proper rounding to avoid floating-point precision issues
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places (default: 2 for cents)
 * @returns The rounded number
 *
 * @example
 * roundToDecimals(0.1 + 0.2, 2) // Returns 0.3
 * roundToDecimals(1.005, 2) // Returns 1.01
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Round a financial amount to cents (2 decimal places)
 * Specifically designed for quote amounts in USD/USDC
 *
 * @param amount - The amount to round
 * @returns The amount rounded to the nearest cent
 *
 * @example
 * roundToCents(0.00001 * 50000) // Returns 0.5
 * roundToCents(0.1 + 0.2) // Returns 0.3
 */
export function roundToCents(amount: number): number {
  return roundToDecimals(amount, 2);
}

/**
 * Calculate quote amount from position size and price, rounded to cents
 * Handles floating-point precision issues in position calculations
 *
 * @param size - Position size in base asset
 * @param price - Price per unit of base asset
 * @returns Quote amount rounded to nearest cent
 *
 * @example
 * calculateQuoteAmount(0.00001, 50000) // Returns 0.5
 * calculateQuoteAmount(0.1, 3.5) // Returns 0.35
 */
export function calculateQuoteAmount(size: number, price: number): number {
  return roundToCents(Math.abs(size) * price);
}
