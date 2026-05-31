import type { CanonicalPrequal } from './financials.js';
import type { EngineConfig } from './config.js';

/**
 * Propensity scorer (P3) — the explainable, fixed-point successor to the
 * legacy band-based scoreLender() in apps/partner-portal/lib/decision-engine.ts.
 *
 * Three properties make a propensity replayable and defensible:
 *   1. Fixed-point — the score is accumulated entirely in integers
 *      (scoreScale units), never float. The ONE float input (DTI ratio)
 *      is quantized to an integer at a single, labelled boundary before
 *      any scoring arithmetic, so the scored path is byte-identical on
 *      replay (ADR-0028). No Math.pow / Math.round / float in that path.
 *   2. Config-driven — every coefficient comes from the pinned EngineConfig
 *      (tier base, FICO/DTI/tradeline weights). The scorer is pure
 *      MECHANISM; coefficient calibration is a CONFIG-VERSIONING concern,
 *      so re-tuning weights means publishing a new config (which revs the
 *      snapshot id), never editing this file.
 *   3. Explainable (SR 11-7) — the result carries the tier anchor plus a
 *      signed, per-factor breakdown, so an examiner can reconstruct exactly
 *      how a score was reached and whether the clamp was load-bearing.
 *
 * The v1 coefficients are coefficient-based, not learned, and must clear
 * the disparate-impact pre-launch gate (ADR-0029) before any decision is
 * surfaced to a consumer.
 *
 * Scope: this produces the lender-independent PROPENSITY only. The
 * per-lender wire fields (estimatedAprBps, estimatedMaxCents) and the
 * consumer-best ranking are assembled later (P4), not here.
 */

/** A single named factor's signed contribution, in scoreScale units. */
export interface ScoreContribution {
  factor: 'fico_above_floor' | 'dti_penalty' | 'open_tradelines' | 'amount_over_penalty';
  /** Signed delta in scoreScale units; negative = penalty. Always an integer. */
  deltaScaled: number;
}

/** The explainable propensity result for one consumer profile. */
export interface PropensityScore {
  /** 0..100 — the wire propensityScore (internal score / scoreScale, floored). */
  propensityScore: number;
  /** Full-precision internal score in scoreScale units, 0..(100 * scoreScale). */
  internalScoreScaled: number;
  /** Tier anchor before adjustments, in scoreScale units. */
  baseScoreScaled: number;
  /** Per-factor adjustments in application order (omits zero contributions). */
  contributions: ScoreContribution[];
  /** True when the clamp altered the raw sum — i.e. a factor was capped by the band. */
  clamped: boolean;
  /** Echo of the scale, so a reader can reconstruct the wire score from internal. */
  scoreScale: number;
}

export interface ScoreOpts {
  /**
   * Per-lender product max, string cents (ADR-0012), used ONLY for the
   * soft amount-over penalty. Omitted in the normal pipeline: P2 already
   * hard-knocks any request outside a product's envelope, so an INCLUDED
   * lender is never over-max and this penalty is 0. Supplied only when a
   * caller deliberately scores a profile against a product it exceeds.
   */
  productMaxAmountCents?: string;
}

/**
 * Single float→integer quantization boundary. DTI arrives as a [0,1] float
 * (a deliberate mirror of the portal payload); the scorer needs whole
 * percent. IEEE-754 multiply and comparison are fully specified, so this
 * returns the same integer for the same input on every replay. Round half
 * up. After this call, the scored path is pure integer.
 */
function quantizeRatioToWholePercent(ratio: number): number {
  const scaled = ratio * 100;
  const whole = Math.trunc(scaled);
  return scaled - whole >= 0.5 ? whole + 1 : whole;
}

/**
 * Whole percent by which a requested amount exceeds a product max, or 0 if
 * within. Integer-only (BigInt floor division) — money never touches float.
 */
function wholePercentOverMax(requestedCents: number, productMaxCents: string): number {
  const requested = BigInt(requestedCents);
  const max = BigInt(productMaxCents);
  if (max <= 0n || requested <= max) return 0;
  return Number(((requested - max) * 100n) / max);
}

/**
 * Compute the explainable, fixed-point propensity for one consumer profile
 * under a pinned config. Pure and deterministic: identical (prequal, config,
 * opts) always yields a deeply-equal result.
 *
 * Null factors (thin file) contribute nothing — the tier base still anchors
 * the score. Whether a thin file is surfaced or suppressed is an aggregation
 * decision (P5), not the scorer's; here it simply scores from the base.
 */
export function scorePropensity(
  prequal: CanonicalPrequal,
  config: EngineConfig,
  opts: ScoreOpts = {},
): PropensityScore {
  const { scoreScale, weights } = config;
  const baseScoreScaled = config.tiers[prequal.tier].baseScore;
  const contributions: ScoreContribution[] = [];

  // FICO credit for points above the floor. Never penalizes: a band at or
  // below the floor (or a thin file) simply earns nothing.
  if (prequal.ficoBand !== null) {
    const above = prequal.ficoBand > weights.ficoFloor ? prequal.ficoBand - weights.ficoFloor : 0;
    const deltaScaled = above * weights.ficoPerPointAboveFloor;
    if (deltaScaled !== 0) contributions.push({ factor: 'fico_above_floor', deltaScaled });
  }

  // DTI penalty, per whole percent.
  if (prequal.dti !== null) {
    const dtiPct = quantizeRatioToWholePercent(prequal.dti);
    const deltaScaled = -(dtiPct * weights.penaltyPerDtiPct);
    if (deltaScaled !== 0) contributions.push({ factor: 'dti_penalty', deltaScaled });
  }

  // Open-tradeline credit, capped so a deep file cannot dominate the score.
  if (prequal.openTradelines !== null) {
    const uncapped = prequal.openTradelines * weights.pointsPerOpenTradeline;
    const deltaScaled =
      uncapped < weights.maxTradelineCredit ? uncapped : weights.maxTradelineCredit;
    if (deltaScaled !== 0) contributions.push({ factor: 'open_tradelines', deltaScaled });
  }

  // Soft amount-over penalty (only when a product max is supplied and exceeded).
  if (opts.productMaxAmountCents !== undefined) {
    const overPct = wholePercentOverMax(prequal.amountCents, opts.productMaxAmountCents);
    if (overPct > 0) {
      contributions.push({
        factor: 'amount_over_penalty',
        deltaScaled: -(overPct * weights.penaltyPerPctAmountOver),
      });
    }
  }

  let rawSum = baseScoreScaled;
  for (const c of contributions) rawSum += c.deltaScaled;

  const maxScaled = 100 * scoreScale;
  const internalScoreScaled = rawSum < 0 ? 0 : rawSum > maxScaled ? maxScaled : rawSum;
  const clamped = internalScoreScaled !== rawSum;

  // Exact integer division: subtract the remainder first so no float arises.
  const propensityScore = (internalScoreScaled - (internalScoreScaled % scoreScale)) / scoreScale;

  return {
    propensityScore,
    internalScoreScaled,
    baseScoreScaled,
    contributions,
    clamped,
    scoreScale,
  };
}
