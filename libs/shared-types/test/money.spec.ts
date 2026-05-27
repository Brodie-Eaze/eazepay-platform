import { describe, expect, it } from 'vitest';
import {
  addCents,
  addMoney,
  applyBps,
  BPS_MAX,
  centsFromBig,
  centsToBig,
  isNegative,
  isZero,
  subCents,
  subMoney,
  toBps,
  toCents,
  toCentsRound,
  usd,
  type BasisPoints,
  type Cents,
} from '../src/money.js';

describe('Money (bigint hierarchy)', () => {
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
    const eur = { amount: 100n, currency: 'EUR' as never };
    expect(() => addMoney(usd(100n), eur as never)).toThrow(/currency mismatch/);
  });

  it('accepts string / number / bigint inputs', () => {
    expect(usd('1000').amount).toBe(1000n);
    expect(usd(1000).amount).toBe(1000n);
    expect(usd(1000n).amount).toBe(1000n);
  });
});

describe('toCents — number-branded cents constructor', () => {
  it('mints a valid cents value', () => {
    const c: Cents = toCents(1234);
    expect(c).toBe(1234);
  });

  it('rejects NaN', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
  });

  it('rejects Infinity', () => {
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => toCents(Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });

  it('rejects fractional cents', () => {
    expect(() => toCents(12.34)).toThrow(/integer/);
  });

  it('rejects negative cents', () => {
    expect(() => toCents(-1)).toThrow(/non-negative/);
  });

  it('toCentsRound floors fractional inputs', () => {
    expect(toCentsRound(12.4)).toBe(12);
    expect(toCentsRound(12.6)).toBe(13);
  });

  it('addCents stays branded', () => {
    const sum: Cents = addCents(toCents(100), toCents(200));
    expect(sum).toBe(300);
  });

  it('subCents floors at zero', () => {
    expect(subCents(toCents(100), toCents(150))).toBe(0);
  });
});

describe('toBps — BasisPoints constructor', () => {
  it('mints a valid bps value', () => {
    const r: BasisPoints = toBps(250);
    expect(r).toBe(250);
  });

  it('accepts the 0 and 10_000 bounds', () => {
    expect(toBps(0)).toBe(0);
    expect(toBps(BPS_MAX)).toBe(BPS_MAX);
  });

  it('rejects values above 10_000', () => {
    expect(() => toBps(10_001)).toThrow(/0\.\.10000/);
  });

  it('rejects negative values', () => {
    expect(() => toBps(-1)).toThrow(/0\.\.10000/);
  });

  it('rejects fractional bps', () => {
    expect(() => toBps(2.5)).toThrow(/integer/);
  });

  it('rejects NaN', () => {
    expect(() => toBps(Number.NaN)).toThrow(/finite/);
  });
});

describe('applyBps — the only sanctioned cents × bps multiplication', () => {
  it('computes 2.5% of $100 correctly', () => {
    // $100 = 10_000 cents; 2.5% = 250 bps → 250 cents
    const principal = toCents(10_000);
    const rate = toBps(250);
    expect(applyBps(principal, rate)).toBe(250);
  });

  it('rounds half-away-from-zero', () => {
    expect(applyBps(toCents(1), toBps(250))).toBe(0);
    expect(applyBps(toCents(20), toBps(250))).toBe(1);
  });

  it('produces a branded Cents result that can chain', () => {
    const fee: Cents = applyBps(toCents(100_000), toBps(350));
    const next: Cents = addCents(fee, toCents(0));
    expect(next).toBe(3500);
  });

  it('100% of a principal equals the principal', () => {
    expect(applyBps(toCents(12_345), toBps(BPS_MAX))).toBe(12_345);
  });

  it('0% of a principal equals zero', () => {
    expect(applyBps(toCents(12_345), toBps(0))).toBe(0);
  });
});

describe('Cents ↔ CentsBig bridge', () => {
  it('round-trips through bigint', () => {
    const start = toCents(123_456);
    const big = centsToBig(start);
    expect(big).toBe(123_456n);
    expect(centsFromBig(big)).toBe(start);
  });

  it('throws when bigint exceeds safe-integer range', () => {
    expect(() => centsFromBig((BigInt(Number.MAX_SAFE_INTEGER) + 1n) as never)).toThrow(
      /safe-integer/,
    );
  });
});
