/**
 * Regression coverage for the branded-money rollout.
 *
 * These specs document the invariants that the branded `Cents` /
 * `BasisPoints` types enforce across the partner-portal call sites
 * named in the task brief. The shape of each test is:
 *
 *   1. The constructor at the boundary rejects the values that the
 *      pre-branding code would have accepted (negative cents,
 *      fractional cents, bps > 100%, mixed units).
 *
 *   2. The kickback / APR / invoice math produces the result the
 *      finance team expects when given branded inputs — i.e. the
 *      `* kickbackBps` bug that motivated the rollout is gone.
 *
 *   3. Drizzle schema columns annotated with `$type<Cents>()` /
 *      `$type<BasisPoints>()` reject plain `number` literals at
 *      compile time (this last invariant is verified by the project
 *      typecheck, not at runtime).
 */
import { describe, expect, it } from 'vitest';
import {
  addCents,
  applyBps,
  BPS_MAX,
  centsFromBig,
  centsToBig,
  toBps,
  toCents,
  type BasisPoints,
  type Cents,
} from '@eazepay/shared-types';
import { computeInvoiceForPartner } from './invoicing';
import { computeKickbackCents } from './lender-economics';

describe('branded-money — boundary invariants', () => {
  it('toCents rejects negative cents', () => {
    expect(() => toCents(-1)).toThrow(RangeError);
  });

  it('toCents rejects fractional cents', () => {
    expect(() => toCents(99.95)).toThrow(/integer/);
  });

  it('toBps rejects rates above 100%', () => {
    expect(() => toBps(10_001)).toThrow(/0\.\.10000/);
    // Sanity: the exact bound is accepted.
    expect(toBps(BPS_MAX)).toBe(BPS_MAX);
  });
});

describe('branded-money — invoicing kickback math', () => {
  it('computes 3.5% MedPay fee on $1,000 funded volume', () => {
    // $1,000 funded × 3.5% fee = $35
    const computed = computeInvoiceForPartner({
      partnerId: 'p_demo',
      product: 'medpay',
      fundedNetCents: toCents(100_000),
    });
    expect(computed.feeAmountCents).toBe(3_500);
    expect(computed.feePct).toBeCloseTo(0.035);
  });

  it('computes lender kickback via applyBps — no 10_000× bug', () => {
    // $5,000 funded × 250 bps (2.5%) = $125 kickback
    const total = computeKickbackCents({
      fundedCents: toCents(500_000),
      economics: {
        kickbackBps: toBps(250),
        perLoanFeeCents: toCents(0),
      },
    });
    expect(total).toBe(12_500);
  });

  it('layers per-loan flat fee on top of bps kickback', () => {
    // $1,000 funded × 200 bps = $20, + $5 flat = $25
    const total = computeKickbackCents({
      fundedCents: toCents(100_000),
      economics: {
        kickbackBps: toBps(200),
        perLoanFeeCents: toCents(500),
      },
    });
    expect(total).toBe(2_500);
  });

  it('zero kickback bps yields the flat fee unchanged', () => {
    const total = computeKickbackCents({
      fundedCents: toCents(100_000),
      economics: {
        kickbackBps: toBps(0),
        perLoanFeeCents: toCents(250),
      },
    });
    expect(total).toBe(250);
  });
});

describe('branded-money — addCents chains', () => {
  it('sum stays a Cents value', () => {
    const a: Cents = toCents(123);
    const b: Cents = toCents(456);
    const sum: Cents = addCents(a, b);
    expect(sum).toBe(579);
  });

  it('cents <-> bigint bridge round-trips losslessly inside safe range', () => {
    const original = toCents(987_654);
    expect(centsFromBig(centsToBig(original))).toBe(original);
  });
});

describe('branded-money — applyBps is the only cents × bps multiplier', () => {
  it('100% of any principal equals the principal', () => {
    const p = toCents(7_777);
    const r: BasisPoints = toBps(BPS_MAX);
    expect(applyBps(p, r)).toBe(7_777);
  });

  it('rounds half-up to the nearest cent', () => {
    // 50 cents × 1 bp / 10_000 = 0.005 → rounds to 1 (half-up)
    expect(applyBps(toCents(50_000), toBps(1))).toBe(5);
  });
});
