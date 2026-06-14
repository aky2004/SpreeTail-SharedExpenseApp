/**
 * Currency service for SpreeTail.
 *
 * Policy (documented in SCOPE.md):
 * - Non-INR expenses store: amount_original, currency, exchange_rate, amount_inr
 * - For CSV import: use hardcoded historical rates (documented, reproducible)
 * - For manual entry: user provides exchange_rate (with optional live lookup)
 *
 * Historical rates used:
 * - USD to INR: 83.00 (approximate rate for Feb-Apr 2026)
 * - EUR to INR: 90.50
 * - GBP to INR: 105.00
 */

// Hardcoded historical rates — documented in SCOPE.md
// These are fixed so that import results are reproducible
const HISTORICAL_RATES: Record<string, number> = {
  INR: 1.0,
  USD: 83.00,
  EUR: 90.50,
  GBP: 105.00,
};

/**
 * Get the exchange rate for a currency to INR.
 * Uses hardcoded historical rates for reproducibility.
 */
export function getExchangeRate(currency: string): number {
  const rate = HISTORICAL_RATES[currency.toUpperCase()];
  if (!rate) {
    throw new Error(`Unsupported currency: ${currency}. Supported: INR, USD, EUR, GBP`);
  }
  return rate;
}

/**
 * Convert an amount from original currency to INR.
 */
export function convertToINR(amount: number, currency: string, exchangeRate?: number): number {
  const rate = exchangeRate || getExchangeRate(currency);
  return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Get all supported currencies with their rates.
 */
export function getSupportedCurrencies(): Array<{ code: string; rate: number; name: string }> {
  return [
    { code: 'INR', rate: 1.0, name: 'Indian Rupee' },
    { code: 'USD', rate: 83.00, name: 'US Dollar' },
    { code: 'EUR', rate: 90.50, name: 'Euro' },
    { code: 'GBP', rate: 105.00, name: 'British Pound' },
  ];
}

/**
 * Validate currency code.
 */
export function isValidCurrency(currency: string): boolean {
  return currency.toUpperCase() in HISTORICAL_RATES;
}
