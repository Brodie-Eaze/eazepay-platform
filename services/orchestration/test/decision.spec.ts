import { describe, expect, it } from 'vitest';
import { DecisionService } from '../src/decision/decision.service.js';
import { HARD_KNOCKOUTS, REASON_CODES } from '../src/decision/policy.js';

describe('DecisionService — knockouts + affordability', () => {
  const svc = new DecisionService();

  it('passes a reasonable application', () => {
    const r = svc.evaluate({
      requestedAmountCents: 1_000_000n, // $10,000
      termMonths: 36,
      declaredMonthlyIncomeCents: 800_000n, // $8,000
      declaredMonthlyObligationsCents: 200_000n, // $2,000
    });
    expect(r.passes).toBe(true);
    expect(r.reasonCodes).toEqual([]);
  });

  it('knocks out amounts above program cap', () => {
    const r = svc.evaluate({
      requestedAmountCents: HARD_KNOCKOUTS.maxAmountCents + 1n,
      termMonths: 36,
    });
    expect(r.passes).toBe(false);
    expect(r.reasonCodes).toContain(REASON_CODES.amountAboveCap);
  });

  it('knocks out terms outside program range', () => {
    expect(svc.evaluate({ requestedAmountCents: 100_000n, termMonths: 1 }).reasonCodes).toContain(
      REASON_CODES.termOutOfRange,
    );
    expect(
      svc.evaluate({
        requestedAmountCents: 100_000n,
        termMonths: HARD_KNOCKOUTS.maxTermMonths + 1,
      }).reasonCodes,
    ).toContain(REASON_CODES.termOutOfRange);
  });

  it('fails affordability when residual is below buffer', () => {
    const r = svc.evaluate({
      requestedAmountCents: 100_000_00n, // huge
      termMonths: 6,
      declaredMonthlyIncomeCents: 200_000n, // $2,000
      declaredMonthlyObligationsCents: 100_000n,
    });
    // amount above cap fires first; lower amount below cap to isolate affordability:
    const r2 = svc.evaluate({
      requestedAmountCents: 5_000_000n,
      termMonths: 6,
      declaredMonthlyIncomeCents: 100_000n, // $1,000
      declaredMonthlyObligationsCents: 50_000n,
    });
    expect(r.passes).toBe(false);
    expect(r2.reasonCodes).toContain(REASON_CODES.affordabilityFail);
  });

  it('records policy version', () => {
    const r = svc.evaluate({ requestedAmountCents: 100_000n, termMonths: 12 });
    expect(typeof r.policyVersion).toBe('string');
    expect(r.policyVersion.length).toBeGreaterThan(0);
  });
});
