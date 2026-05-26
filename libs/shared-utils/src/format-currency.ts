/**
 * Canonical USD currency formatter. Input is integer cents — matches
 * the BigInt-cents money model used across the API. View-model layers
 * may pass `number` for convenience (safe for amounts < 2^53).
 *
 * Default behavior:
 *  - Whole-dollar amounts (cents % 100 === 0) render WITHOUT cents.
 *    `500000` → `'$5,000'`, not `'$5,000.00'`.
 *  - Non-whole amounts render with exactly 2 decimals.
 *    `199` → `'$1.99'`.
 *  - Negative amounts render with a leading minus, after the `$`
 *    glyph is omitted by the formatter: we emit `'-$1.99'`.
 *
 * Pass `showCents: true` to force 2 decimals even on round amounts.
 */
export interface FormatCurrencyOptions {
  currency?: 'USD';
  locale?: string;
  /** Force two decimal places regardless of remainder. */
  showCents?: boolean;
}

export function formatCurrencyCents(cents: number, opts: FormatCurrencyOptions = {}): string {
  const { currency = 'USD', locale = 'en-US', showCents } = opts;
  if (!Number.isFinite(cents)) {
    throw new TypeError(`formatCurrencyCents: non-finite input ${String(cents)}`);
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = abs / 100;
  const fractional = showCents === true || abs % 100 !== 0;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractional ? 2 : 0,
    maximumFractionDigits: fractional ? 2 : 0,
  }).format(dollars);
  return negative ? `-${formatted}` : formatted;
}
