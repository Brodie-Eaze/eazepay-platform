/**
 * Error-budget computation — pure function, no I/O.
 *
 * Given an SLO + observed failure rate (over the SLO's window), returns
 * how much of the error budget remains and whether alerting should fire
 * yellow or red.
 *
 * Why this lives in its own module:
 *   • The math is shared between the admin SLO board, future alerting,
 *     and any reporting export. A pure helper has one home.
 *   • Pure + side-effect-free → trivially testable. The spec file is
 *     the canonical reference for edge cases (over 100% burn, exactly
 *     at a threshold, zero observed traffic, etc.).
 *
 * No clock dependency, no logger, no DB — bring your own observed rate.
 */

import { minutesInWindow, type SloDefinition } from './definitions';

/**
 * Alert level emitted to the dashboard.
 *
 *   • green  — < 25% of budget burned. All clear.
 *   • yellow — [25%, 75%) burned. Heads-up, no action required.
 *   • red    — ≥ 75% burned (including > 100%). Action required —
 *     follow the runbook attached to the SLO definition.
 *
 * Boundaries are inclusive at the lower end of yellow/red, exclusive
 * at the upper. The brief says "yellow at 25%, red at 75%" — that's
 * inclusive at the threshold, matching the lifecycle in docs/SLO.md
 * ("how error budgets are spent"). Yellow doesn't gate a deploy; red
 * does. We also widen the inclusion to tolerate tiny floating-point
 * rounding (e.g. 0.00025 / 0.001 computes to 0.24999…) — see
 * BOUNDARY_EPSILON below.
 */
export type AlertLevel = 'green' | 'yellow' | 'red';

const YELLOW_THRESHOLD = 0.25; // 25% of budget burned
const RED_THRESHOLD = 0.75; // 75% of budget burned

/**
 * Floating-point slack on the threshold comparison. Inputs like
 * 0.00025 / 0.001 compute to 0.24999999999999997, which would be
 * classified green under a naïve `< 0.25` check. The brief says
 * "yellow at 25%" — strictly inclusive. A 5e-9 epsilon catches the
 * IEEE-754 rounding without admitting any meaningful real-world
 * "almost-yellow" into yellow.
 */
const BOUNDARY_EPSILON = 5e-9;

export interface ErrorBudgetState {
  /**
   * Minutes of error budget remaining in the current window. Can be
   * negative when the budget is fully burned + then some — that's a
   * legitimate state ("we owe back-pressure") that the UI surfaces as
   * "−12 min". Clamping to 0 would hide a P1 incident.
   */
  remainingMinutes: number;
  /**
   * Fraction of the budget burned. 0 → fresh budget; 1 → exactly burned
   * through; > 1 → over budget. NOT clamped to [0, 1] for the same
   * reason as above.
   */
  percentBurned: number;
  alertLevel: AlertLevel;
}

/**
 * Compute the budget state for an SLO given the OBSERVED failure rate
 * (the same SLI the target is measured against, but actual not target).
 *
 * @param slo - The SLO definition. Its `target` is the SLI target (e.g.
 *              0.999 for availability) and its `window` determines the
 *              denominator minutes.
 * @param observedFailureRate - Fraction of failures observed in the
 *              window. e.g. for an availability SLO with target 0.999,
 *              the budget is 0.001; if 0.0005 of operations failed,
 *              that's half the budget burned (percentBurned ≈ 0.5).
 *              Must be in [0, 1]. Values outside that range are clamped
 *              with a logged-not-thrown — the caller may pass a slightly
 *              over-1.0 value if the underlying SLI is averaged across
 *              windows and rolling-window arithmetic produced a rounding
 *              hair over 1. We tolerate that and treat as 1.0.
 */
export function computeErrorBudget(
  slo: SloDefinition,
  observedFailureRate: number,
): ErrorBudgetState {
  // Clamp the input to [0, 1]. Negative observed rates are nonsensical;
  // > 1 is rolling-window rounding artefact. We do not throw on either —
  // the SLO board should always render, even with a slightly malformed
  // upstream metric.
  const clamped = Math.max(0, Math.min(1, observedFailureRate));

  // The "allowed failure rate" is (1 - target).
  // For target = 0.999, allowed = 0.001.
  // percentBurned = observed / allowed.
  const allowedFailureRate = 1 - slo.target;

  // Guard against a target of exactly 1.0. The catalogue does not
  // currently set 1.0 as a target (it would mean "zero error budget",
  // which is a nonsense SLO), but if it ever does we must not divide
  // by zero. In that case any non-zero observed failure burns 100%+
  // budget — we report Infinity which the UI renders as ">100%".
  let percentBurned: number;
  if (allowedFailureRate === 0) {
    percentBurned = clamped === 0 ? 0 : Number.POSITIVE_INFINITY;
  } else {
    percentBurned = clamped / allowedFailureRate;
  }

  // Remaining minutes = (budget minutes) - (burned minutes).
  // Burned minutes = percentBurned × budget minutes. Negative is fine.
  const totalBudgetMinutes = allowedFailureRate * minutesInWindow(slo.window);
  const remainingMinutes = Number.isFinite(percentBurned)
    ? Math.round(totalBudgetMinutes - percentBurned * totalBudgetMinutes)
    : -Math.round(totalBudgetMinutes); // budget over-blown; show as exact-negative-of-budget

  // Alert level is a step function on percentBurned. Boundaries are
  // inclusive at the lower end of yellow + red, exclusive at the upper.
  //   [0,    0.25) → green
  //   [0.25, 0.75) → yellow
  //   [0.75, ∞)    → red
  // The `+ BOUNDARY_EPSILON` slack absorbs IEEE-754 rounding so that
  // observed = 25% of budget always classifies as yellow (not green).
  let alertLevel: AlertLevel;
  if (percentBurned + BOUNDARY_EPSILON < YELLOW_THRESHOLD) {
    alertLevel = 'green';
  } else if (percentBurned + BOUNDARY_EPSILON < RED_THRESHOLD) {
    alertLevel = 'yellow';
  } else {
    alertLevel = 'red';
  }

  return { remainingMinutes, percentBurned, alertLevel };
}
