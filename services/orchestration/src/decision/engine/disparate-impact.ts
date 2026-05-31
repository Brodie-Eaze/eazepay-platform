/**
 * Disparate-impact gate (P7a) — the four-fifths (80%) rule.
 *
 * A fair-lending fitness function (ECOA / Reg B, EEOC Uniform Guidelines
 * §1607.4(D)). Given decision outcomes bucketed by group, it computes each
 * group's selection (favourable-outcome) rate and the adverse-impact ratio —
 * the least-selected group's rate over the most-selected group's. A ratio
 * below 0.8 is the classic prima-facie signal of disparate impact and flags
 * the affected groups for review.
 *
 * Standalone-pure (ADR-0027): counting + division over a list, no IO. Group
 * labels are supplied by the caller (a proxy bucket, a monitoring dimension)
 * — this gate never infers a protected class. It is a MONITOR, not a decision
 * input: it can never see, and must never influence, a single applicant's
 * outcome (using a protected-class proxy IN the decision is the violation it
 * exists to detect).
 */

/** One observed decision, tagged with the monitoring group it belongs to. */
export interface ImpactObservation {
  /** Group label (a proxy bucket / monitoring dimension), never a decision input. */
  group: string;
  /** True iff the applicant got a favourable outcome (≥1 offer). */
  favorable: boolean;
}

/** Per-group selection rate — the row of the analysis table. */
export interface GroupSelectionRate {
  group: string;
  total: number;
  favorable: number;
  /** favorable / total, or 0 for an empty group. */
  rate: number;
}

export interface DisparateImpactResult {
  /** True iff the adverse-impact ratio meets the threshold. */
  passes: boolean;
  /** minRate / maxRate among qualifying groups; 1 when disparity is unmeasurable. */
  adverseImpactRatio: number;
  /** The four-fifths threshold actually applied (default 0.8). */
  threshold: number;
  /** Every group's rate, sorted by group, including sub-threshold-size ones. */
  rates: GroupSelectionRate[];
  /** Qualifying groups whose rate < threshold × maxRate, sorted. */
  flaggedGroups: string[];
}

export interface DisparateImpactOptions {
  /** Four-fifths by default; lower it only with a documented rationale. */
  threshold?: number;
  /**
   * Minimum group size to participate in the ratio. Small cells produce noisy
   * rates, so groups below this are reported but excluded from min/max.
   * Default 0 = every non-empty group counts.
   */
  minGroupSize?: number;
}

/**
 * Run the four-fifths analysis over a batch of outcomes. With fewer than two
 * qualifying groups disparity is unmeasurable, so the ratio is 1 and the gate
 * passes (you cannot show disparate impact against a single group). When the
 * most-selected group's rate is 0 (nobody was selected) the ratio is likewise
 * 1 — no selection means no disparity in selection.
 */
export function disparateImpactGate(
  outcomes: readonly ImpactObservation[],
  opts: DisparateImpactOptions = {},
): DisparateImpactResult {
  const threshold = opts.threshold ?? 0.8;
  const minGroupSize = opts.minGroupSize ?? 0;

  const totals = new Map<string, { total: number; favorable: number }>();
  for (const o of outcomes) {
    const cell = totals.get(o.group) ?? { total: 0, favorable: 0 };
    cell.total += 1;
    if (o.favorable) cell.favorable += 1;
    totals.set(o.group, cell);
  }

  const rates: GroupSelectionRate[] = [...totals.entries()]
    .map(([group, c]) => ({
      group,
      total: c.total,
      favorable: c.favorable,
      rate: c.total === 0 ? 0 : c.favorable / c.total,
    }))
    .sort((a, b) => a.group.localeCompare(b.group));

  const qualifying = rates.filter((r) => r.total >= minGroupSize && r.total > 0);

  // <2 qualifying groups: disparity is unmeasurable → pass with ratio 1.
  if (qualifying.length < 2) {
    return { passes: true, adverseImpactRatio: 1, threshold, rates, flaggedGroups: [] };
  }

  const maxRate = Math.max(...qualifying.map((r) => r.rate));
  // No group selected at all → no disparity in selection.
  if (maxRate === 0) {
    return { passes: true, adverseImpactRatio: 1, threshold, rates, flaggedGroups: [] };
  }

  const minRate = Math.min(...qualifying.map((r) => r.rate));
  const adverseImpactRatio = minRate / maxRate;
  const flaggedGroups = qualifying
    .filter((r) => r.rate < threshold * maxRate)
    .map((r) => r.group)
    .sort();

  return {
    passes: adverseImpactRatio >= threshold,
    adverseImpactRatio,
    threshold,
    rates,
    flaggedGroups,
  };
}
