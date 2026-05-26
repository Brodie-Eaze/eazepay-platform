import { describe, expect, it } from 'vitest';
import { formatCurrencyCents } from '../src/format-currency.js';

describe('formatCurrencyCents', () => {
  it('drops cents on whole-dollar amounts by default', () => {
    expect(formatCurrencyCents(500_000)).toBe('$5,000');
  });

  it('renders sub-dollar amounts with two decimals', () => {
    expect(formatCurrencyCents(199)).toBe('$1.99');
  });

  it('renders zero as $0', () => {
    expect(formatCurrencyCents(0)).toBe('$0');
  });

  it('renders zero with cents when showCents=true', () => {
    expect(formatCurrencyCents(0, { showCents: true })).toBe('$0.00');
  });

  it('forces two decimals when showCents=true on whole dollars', () => {
    expect(formatCurrencyCents(500_000, { showCents: true })).toBe('$5,000.00');
  });

  it('handles single cents', () => {
    expect(formatCurrencyCents(1)).toBe('$0.01');
  });

  it('handles negative amounts with leading minus', () => {
    expect(formatCurrencyCents(-1_999)).toBe('-$19.99');
  });

  it('handles negative whole dollars', () => {
    expect(formatCurrencyCents(-500_000)).toBe('-$5,000');
  });

  it('handles large amounts with grouping', () => {
    expect(formatCurrencyCents(1_234_567_89)).toBe('$1,234,567.89');
  });

  it('handles non-round large amounts', () => {
    expect(formatCurrencyCents(100_000_00)).toBe('$100,000');
  });

  it('throws on non-finite input', () => {
    expect(() => formatCurrencyCents(Number.NaN)).toThrow(/non-finite/);
    expect(() => formatCurrencyCents(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
  });
});
