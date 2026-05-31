import type { ConsumerTier } from './financials.js';

/**
 * The pinned, versioned engine configuration (ADR-0028).
 *
 * This blob is the single source of truth for every tunable the engine
 * uses: the hard-eligibility envelope (P2), the MLA cap (P2), and the
 * propensity scorer's tier bases / APR bands / weights (P3). It is NOT a
 * relational rules DSL — that is deliberately deferred (ADR-0028).
 *
 * Two invariants make decisions replayable byte-identically:
 *   1. Money is string-of-integer cents (ADR-0012) — never float, never
 *      BigInt here, so the blob is JSON-serialisable and content-hashable.
 *   2. The frozen constant below is immutable at runtime; the only way to
 *      change behaviour is to publish a new version + bump CONFIG_VERSION,
 *      which changes the content digest and therefore the snapshot id.
 *
 * The v1 scorer coefficients are coefficient-based, not learned
 * (ADR-0021), and MUST pass disparate-impact testing before launch
 * (ADR-0029 pre-launch gate).
 */

export const ENGINE_POLICY_VERSION = 'policy-2026.05.31';
export const ENGINE_RULE_VERSION = 'rules-2026.05.31';
export const ENGINE_SCORER_VERSION = 'scorer-linear-2026.05.31';
export const CONFIG_VERSION = 'config-2026.05.31';

export interface AprBandBps {
  minBps: number;
  maxBps: number;
}

export interface TierConfig {
  /** Starting propensity points for this tier, in scoreScale units. */
  baseScore: number;
  /** Estimated APR band a consumer in this tier would see. */
  aprBandBps: AprBandBps;
}

export interface ScorerWeights {
  /** FICO below this floor contributes nothing. */
  ficoFloor: number;
  /** Points (scoreScale units) added per FICO point above the floor. */
  ficoPerPointAboveFloor: number;
  /** Points subtracted per whole percent of DTI. */
  penaltyPerDtiPct: number;
  /** Points added per open tradeline, up to maxTradelineCredit. */
  pointsPerOpenTradeline: number;
  maxTradelineCredit: number;
  /** Points subtracted per whole percent the request exceeds product max. */
  penaltyPerPctAmountOver: number;
}

export interface EngineConfig {
  configVersion: string;
  /** Fixed-point denominator: internal scores are integers 0..(100*scoreScale). */
  scoreScale: number;
  /** Residual-income floor for affordability, cents (string per ADR-0012). */
  affordabilityBufferCents: string;
  /** Program-wide hard envelope. Per-lender envelopes (tighter) come from the catalog. */
  envelope: {
    minAmountCents: string;
    maxAmountCents: string;
    minTermMonths: number;
    maxTermMonths: number;
  };
  /** Military Lending Act all-in MAPR cap — 36% => 3600 bps (32 CFR 232). */
  mlaMaprCapBps: number;
  tiers: Record<ConsumerTier, TierConfig>;
  weights: ScorerWeights;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

/**
 * v1 engine config. Envelope mirrors the existing program knockouts
 * (services/orchestration/src/decision/policy.ts HARD_KNOCKOUTS:
 * max $100,000, term 3..84) so the new engine's include/exclude set can
 * match the legacy scorer in shadow (ADR-0028). Scorer coefficients are
 * free to differ — only the included-set and reason codes must match.
 */
export const ENGINE_CONFIG_V1: EngineConfig = deepFreeze({
  configVersion: CONFIG_VERSION,
  scoreScale: 100,
  affordabilityBufferCents: '50000', // $500
  envelope: {
    minAmountCents: '0', // no program floor; per-lender minimums apply via the catalog
    maxAmountCents: '10000000', // $100,000
    minTermMonths: 3,
    maxTermMonths: 84,
  },
  mlaMaprCapBps: 3600,
  tiers: {
    A: { baseScore: 9000, aprBandBps: { minBps: 599, maxBps: 1499 } },
    B: { baseScore: 7500, aprBandBps: { minBps: 1499, maxBps: 2299 } },
    C: { baseScore: 6000, aprBandBps: { minBps: 2299, maxBps: 2999 } },
    D: { baseScore: 4500, aprBandBps: { minBps: 2999, maxBps: 3599 } },
  },
  weights: {
    ficoFloor: 300,
    ficoPerPointAboveFloor: 10,
    penaltyPerDtiPct: 50,
    pointsPerOpenTradeline: 100,
    maxTradelineCredit: 1000,
    penaltyPerPctAmountOver: 200,
  },
});
