import { describe, expect, it } from 'vitest';
import { addMoney, isNegative, isZero, subMoney, usd } from '../src/money.js';

describe('Money', () => {
  it('adds same-currency money', () => {
    const r = addMoney(usd(1000n), usd(2500n));
    expect(r.amount).toBe(3500n);
    expect(r.currency).toBe('USD');
  });

  it('subtracts and detects negative', () => {
    const r = subMoney(usd(1000n), usd(1500n));
    expect(r.amount).toBe(-500n);
    expect(isNegative(r)).toBe(true);
  });

  it('detects zero', () => {
    expect(isZero(usd(0n))).toBe(true);
    expect(isZero(usd(1n))).toBe(false);
  });

  it('throws on currency mismatch', () => {
    // synthetic mismatch — only USD exists today, so cast for the test
    const eur = { amount: 100n, currency: 'EUR' as never };
    expect(() => addMoney(usd(100n), eur as never)).toThrow(/currency mismatch/);
  });

  it('accepts string / number / bigint inputs', () => {
    expect(usd('1000').amount).toBe(1000n);
    expect(usd(1000).amount).toBe(1000n);
    expect(usd(1000n).amount).toBe(1000n);
  });
});
