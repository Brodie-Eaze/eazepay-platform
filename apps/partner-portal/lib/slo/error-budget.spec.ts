import { describe, it, expect } from 'vitest';
import { computeErrorBudget } from './error-budget';
import { SLO_DEFINITIONS, findSloById, minutesInWindow } from './definitions';
import type { SloDefinition } from './definitions';

/**
 * Specs for the error-budget computation. The math is straightforward:
 *
 *   percentBurned = observedFailureRate / (1 - target)
 *   remaining     = budget × (1 - percentBurned)
 *   alert         = step function on percentBurned (25%, 75%)
 *
 * but the edge cases are where regressions hide:
 *   • Exactly-at-threshold (0%, 25%, 75%, 100%) → which bucket?
 *   • Over 100% burn → negative remaining minutes (don't clamp)
 *   • observed > 1.0 (rolling-window rounding) → clamp to 1.0
 *   • observed < 0   (impossible-input) → clamp to 0
 *   • Different SLO windows → budget minutes match minutesInWindow
 *
 * The catalogue is also asserted: every catalogue entry must compute a
 * positive budget on zero observed failures, and the error-budget
 * minutes denormalised on the SLO must match the math we'd recompute
 * here. That keeps `definitions.ts` honest.
 */

/** Test helper — build a synthetic SLO without going through the catalogue. */
function syntheticSlo(target: number, window: '7d' | '30d' = '30d'): SloDefinition {
  return {
    id: 'test-slo',
    name: 'Test SLO',
    service: 'consumer-apply',
    sli: { category: 'availability', description: 'test', source: 'test' },
    target,
    window,
    errorBudgetMinutes: Math.round((1 - target) * minutesInWindow(window)),
    runbookLink: 'docs/runbooks/incident-response.md',
  };
}

describe('computeErrorBudget', () => {
  it('returns green at 0% burn', () => {
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, 0);
    expect(state.percentBurned).toBe(0);
    expect(state.alertLevel).toBe('green');
    // Budget for 0.999 over 30d: 0.001 × 43200 = 43.2 → rounded 43.
    expect(state.remainingMinutes).toBe(43);
  });

  it('returns green just under the yellow threshold (24% burn)', () => {
    const slo = syntheticSlo(0.999, '30d'); // budget 43.2 min
    // Burn 24% of 0.001 = 0.00024 failure rate.
    const state = computeErrorBudget(slo, 0.00024);
    expect(state.percentBurned).toBeCloseTo(0.24, 2);
    expect(state.alertLevel).toBe('green');
    expect(state.remainingMinutes).toBeGreaterThan(0);
  });

  it('flips to yellow exactly at 25% burn', () => {
    const slo = syntheticSlo(0.999, '30d');
    // 25% of allowed = 0.00025.
    const state = computeErrorBudget(slo, 0.00025);
    expect(state.percentBurned).toBeCloseTo(0.25, 4);
    expect(state.alertLevel).toBe('yellow');
  });

  it('stays yellow through the middle of the band (50% burn)', () => {
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, 0.0005);
    expect(state.percentBurned).toBeCloseTo(0.5, 4);
    expect(state.alertLevel).toBe('yellow');
    // 43.2 - 0.5 × 43.2 = 21.6 → rounded 22.
    expect(state.remainingMinutes).toBe(22);
  });

  it('flips to red exactly at 75% burn', () => {
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, 0.00075);
    expect(state.percentBurned).toBeCloseTo(0.75, 4);
    expect(state.alertLevel).toBe('red');
  });

  it('returns red and 0 remaining at exactly 100% burn', () => {
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, 0.001); // exactly the budget
    expect(state.percentBurned).toBeCloseTo(1.0, 4);
    expect(state.alertLevel).toBe('red');
    expect(state.remainingMinutes).toBe(0);
  });

  it('reports negative remaining minutes when budget is over-burned', () => {
    // Over-budget — observed double the allowed failure rate.
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, 0.002);
    expect(state.percentBurned).toBeCloseTo(2.0, 4);
    expect(state.alertLevel).toBe('red');
    // Budget is 43.2 min; 200% burned means we owe 43.2 min — surfaced
    // as -43 (not clamped to 0).
    expect(state.remainingMinutes).toBe(-43);
  });

  it('handles a 7d window (different denominator) correctly', () => {
    // 7d window with 95% target (the latency SLO shape).
    // Budget: (1 - 0.95) × 10 080 = 504 min.
    const slo = syntheticSlo(0.95, '7d');
    expect(slo.errorBudgetMinutes).toBe(504);
    const state = computeErrorBudget(slo, 0.025); // 50% burn
    expect(state.percentBurned).toBeCloseTo(0.5, 4);
    expect(state.alertLevel).toBe('yellow');
    expect(state.remainingMinutes).toBe(252);
  });

  it('clamps negative observedFailureRate to 0 (impossible input)', () => {
    const slo = syntheticSlo(0.999, '30d');
    const state = computeErrorBudget(slo, -0.5);
    expect(state.percentBurned).toBe(0);
    expect(state.alertLevel).toBe('green');
  });

  it('clamps observedFailureRate > 1 down to 1 (rolling-window rounding artefact)', () => {
    const slo = syntheticSlo(0.999, '30d');
    // 1.0001 happens when rolling-window arithmetic rounds up — we
    // accept and treat as exactly 100% failure rate.
    const state = computeErrorBudget(slo, 1.0001);
    // 100% failure rate / 0.001 allowed = 1000× burn (IEEE-754 fuzz
    // around 1000 is expected — toBeCloseTo handles it).
    expect(state.percentBurned).toBeCloseTo(1000, 6);
    expect(state.alertLevel).toBe('red');
  });

  it('handles target = 1.0 (zero error budget) without dividing by zero', () => {
    // Edge case: an SLO with target 1.0 has zero error budget. We
    // report Infinity burn for any non-zero failure rate, and the
    // remainingMinutes is the negative-of-zero-budget signal.
    const slo = syntheticSlo(1.0, '30d');
    const zero = computeErrorBudget(slo, 0);
    expect(zero.percentBurned).toBe(0);
    expect(zero.alertLevel).toBe('green');
    expect(zero.remainingMinutes).toBe(0);

    const any = computeErrorBudget(slo, 0.0001);
    expect(any.percentBurned).toBe(Number.POSITIVE_INFINITY);
    expect(any.alertLevel).toBe('red');
  });
});

describe('SLO_DEFINITIONS catalogue', () => {
  it('contains at least the six SLOs the brief requires', () => {
    // The brief mandates: consumer-apply (avail + latency),
    // decision-engine (avail + latency), webhook ingestion, lender-api.
    const ids = SLO_DEFINITIONS.map((s) => s.id);
    expect(ids).toContain('consumer-apply-availability');
    expect(ids).toContain('consumer-apply-latency-p95');
    expect(ids).toContain('decision-engine-availability');
    expect(ids).toContain('decision-engine-latency-p95');
    expect(ids).toContain('webhook-ingestion-availability');
    expect(ids).toContain('lender-api-integration-health');
  });

  it('every SLO has a positive computed error-budget on a fresh window', () => {
    for (const slo of SLO_DEFINITIONS) {
      // Defensive: a misconfigured target = 1.0 would produce a 0-min
      // budget. We don't have any such SLOs today; this asserts that.
      expect(slo.target).toBeGreaterThan(0);
      expect(slo.target).toBeLessThan(1);
      expect(slo.errorBudgetMinutes).toBeGreaterThan(0);
    }
  });

  it('every SLO has the denormalised errorBudgetMinutes matching the recompute', () => {
    // This is the consistency check between definitions.ts and the math
    // in error-budget.ts. If someone hand-edits errorBudgetMinutes the
    // spec fails.
    for (const slo of SLO_DEFINITIONS) {
      const expected = Math.round((1 - slo.target) * minutesInWindow(slo.window));
      expect(slo.errorBudgetMinutes).toBe(expected);
    }
  });

  it('every SLO has a runbook link under docs/runbooks/', () => {
    // We can't assert the file exists from a node-only spec (would
    // need fs + the worktree root), but we can assert the link shape
    // so a typo doesn't slip in.
    for (const slo of SLO_DEFINITIONS) {
      expect(slo.runbookLink).toMatch(/^docs\/runbooks\/[a-z0-9-]+\.md$/);
    }
  });

  it('findSloById returns the right entry and undefined for unknown ids', () => {
    expect(findSloById('consumer-apply-availability')?.target).toBe(0.999);
    expect(findSloById('does-not-exist')).toBeUndefined();
  });
});
