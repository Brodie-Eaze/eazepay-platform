import { describe, expect, it } from 'vitest';
import { disparateImpactGate, type ImpactObservation } from '../src/decision/engine/index.js';

/**
 * P7a — disparate-impact gate (four-fifths rule). Pure counting + division;
 * the group label is a monitoring dimension supplied by the caller, never a
 * decision input. These tests pin the ratio math and the documented edges
 * (single group, zero selection, small-cell exclusion).
 */

/** `favorable` favourable + `unfavorable` unfavourable observations for a group. */
function outcomes(group: string, favorable: number, unfavorable: number): ImpactObservation[] {
  return [
    ...Array.from({ length: favorable }, () => ({ group, favorable: true })),
    ...Array.from({ length: unfavorable }, () => ({ group, favorable: false })),
  ];
}

describe('disparateImpactGate', () => {
  it('passes when group selection rates are within the four-fifths band', () => {
    const result = disparateImpactGate([
      ...outcomes('A', 8, 2), // 0.80
      ...outcomes('B', 7, 3), // 0.70 → 0.70/0.80 = 0.875 ≥ 0.8
    ]);
    expect(result.passes).toBe(true);
    expect(result.adverseImpactRatio).toBeCloseTo(0.875, 5);
    expect(result.flaggedGroups).toEqual([]);
    expect(result.rates.map((r) => r.group)).toEqual(['A', 'B']); // sorted
  });

  it('fails and flags the group that falls below four-fifths of the top rate', () => {
    const result = disparateImpactGate([
      ...outcomes('A', 9, 1), // 0.90
      ...outcomes('B', 6, 4), // 0.60 → 0.60/0.90 = 0.667 < 0.8
    ]);
    expect(result.passes).toBe(false);
    expect(result.adverseImpactRatio).toBeCloseTo(2 / 3, 5);
    expect(result.flaggedGroups).toEqual(['B']);
  });

  it('reports per-group rates accurately', () => {
    const result = disparateImpactGate([...outcomes('A', 3, 1), ...outcomes('B', 1, 1)]);
    const a = result.rates.find((r) => r.group === 'A');
    const b = result.rates.find((r) => r.group === 'B');
    expect(a).toMatchObject({ total: 4, favorable: 3, rate: 0.75 });
    expect(b).toMatchObject({ total: 2, favorable: 1, rate: 0.5 });
  });

  it('treats fewer than two qualifying groups as unmeasurable (ratio 1, passes)', () => {
    const result = disparateImpactGate(outcomes('A', 1, 9)); // a single group
    expect(result.passes).toBe(true);
    expect(result.adverseImpactRatio).toBe(1);
    expect(result.flaggedGroups).toEqual([]);
  });

  it('returns ratio 1 when no group was selected at all', () => {
    const result = disparateImpactGate([...outcomes('A', 0, 5), ...outcomes('B', 0, 5)]);
    expect(result.passes).toBe(true);
    expect(result.adverseImpactRatio).toBe(1);
    expect(result.flaggedGroups).toEqual([]);
  });

  it('excludes sub-minimum-size cells from the ratio but still reports them', () => {
    const data = [...outcomes('A', 8, 2), ...outcomes('B', 0, 1)]; // B is a 1-person cell

    // Default minGroupSize 0: the noisy 0/1 cell drags the ratio to 0 → fail.
    const noisy = disparateImpactGate(data);
    expect(noisy.passes).toBe(false);
    expect(noisy.flaggedGroups).toEqual(['B']);

    // minGroupSize 5: B is excluded from min/max, leaving <2 qualifying → pass,
    // but B's rate is still reported for transparency.
    const guarded = disparateImpactGate(data, { minGroupSize: 5 });
    expect(guarded.passes).toBe(true);
    expect(guarded.adverseImpactRatio).toBe(1);
    expect(guarded.rates.find((r) => r.group === 'B')).toMatchObject({ total: 1, rate: 0 });
  });

  it('honours a custom threshold', () => {
    const data = [...outcomes('A', 9, 1), ...outcomes('B', 7, 3)]; // 0.7/0.9 = 0.778
    expect(disparateImpactGate(data).passes).toBe(false); // < 0.80
    expect(disparateImpactGate(data, { threshold: 0.75 }).passes).toBe(true); // ≥ 0.75
  });
});
