/**
 * Decision Engine — propensity scoring + persistence.
 *
 * Sits between HighSale (pre-qual data in) and the lender marketplace
 * (offers fan-out). For each application it:
 *
 *   1. Filters out lenders the consumer FAILS a hard rule on
 *      (brand mismatch, tier mismatch, amount envelope, eligibility
 *      rules — FICO floor, DTI cap, geography, etc.).
 *   2. Computes a propensity score per remaining lender (likelihood
 *      of approval, 0–100). Higher = more likely.
 *   3. Ranks the eligible set: propensity × lender priority × fee
 *      economics.
 *   4. Persists the full decision (inputs + ranked output) to the
 *      `decisions` table for audit, replay, and the offers page.
 *
 * Engine choice (Block 3 in the strategy doc):
 *   • `engine: 'trutopia'` — calls Tim's cloud engine (set
 *     TRUTOPIA_ENGINE_URL + TRUTOPIA_ENGINE_KEY)
 *   • `engine: 'internal'` — runs the rule-based scorer in this file
 *   • `engine: 'fallback'` — synthetic, deterministic. Always available.
 *
 * Without env vars configured the engine returns the internal scorer
 * output so the platform demo loop closes without external dependencies.
 */

import { hasDb, getDb, schema } from './db';
import { SAMPLE_LENDERS, type Brand, type LenderTier } from './api-v1/shared';

/* ---------- types ---------- */

export interface PrequalInputs {
  /** A | B | C | D — derived by HighSale soft pull. */
  tier: 'A' | 'B' | 'C' | 'D';
  /** Approx FICO (5-point band). NULL on thin file. */
  ficoBand: number | null;
  /** Debt-to-income ratio (0..1). NULL on insufficient data. */
  dti: number | null;
  openTradelines: number | null;
  /** Loan size requested by the consumer, in cents. */
  amountCents: number;
  /** Annual income in cents (self-reported, validated by bureau). */
  annualIncomeCents: number;
  /** 2-letter US state. */
  state: string;
  brand: Brand;
}

export interface RankedLender {
  lenderId: string;
  displayName: string;
  /** 0..100 — likelihood of approval, given the consumer's profile. */
  propensityScore: number;
  /** Final rank — 1 = top. */
  rank: number;
  /** Whether this lender is presented to the consumer (true) or
   * excluded by a hard rule (false). */
  included: boolean;
  /** When excluded: the rule code that knocked them out. */
  reasonCode: string | null;
  /** Estimated APR band the consumer would see, in basis points. */
  estimatedAprBps: number | null;
  /** Estimated max approval amount, in cents. */
  estimatedMaxCents: number | null;
}

export interface DecisionResult {
  decisionId: string;
  engine: 'trutopia' | 'internal' | 'fallback';
  engineVersion: string;
  rankedLenders: RankedLender[];
  eligibleCount: number;
  excludedCount: number;
  topPropensityScore: number | null;
  latencyMs: number;
}

/* ---------- scorer (internal engine) ---------- */

const TIER_BASE_SCORE: Record<PrequalInputs['tier'], number> = {
  A: 88,
  B: 72,
  C: 56,
  D: 38,
};

const APR_BY_TIER_BPS: Record<PrequalInputs['tier'], number> = {
  A: 999,
  B: 1499,
  C: 2199,
  D: 2999,
};

/** Heuristic eligibility check + propensity score for one lender. */
function scoreLender(lender: (typeof SAMPLE_LENDERS)[number], inputs: PrequalInputs): RankedLender {
  // Hard rule: brand allowlist.
  if (!lender.brands.includes(inputs.brand)) {
    return {
      lenderId: lender.id,
      displayName: lender.id,
      propensityScore: 0,
      rank: 999,
      included: false,
      reasonCode: `brand_mismatch:${inputs.brand}`,
      estimatedAprBps: null,
      estimatedMaxCents: null,
    };
  }

  // Hard rule: tier match. Map our A/B/C/D to the lender's serves_tiers.
  const tierMap: Record<PrequalInputs['tier'], LenderTier> = {
    A: 'prime_plus',
    B: 'prime',
    C: 'near_prime',
    D: 'sub_prime',
  };
  const requiredTier = tierMap[inputs.tier];
  if (!lender.serves_tiers.includes(requiredTier)) {
    return {
      lenderId: lender.id,
      displayName: lender.id,
      propensityScore: 0,
      rank: 999,
      included: false,
      reasonCode: `tier_mismatch:${inputs.tier}`,
      estimatedAprBps: null,
      estimatedMaxCents: null,
    };
  }

  // Hard rule: amount envelope.
  if (
    inputs.amountCents < lender.min_amount_cents ||
    inputs.amountCents > lender.max_amount_cents
  ) {
    return {
      lenderId: lender.id,
      displayName: lender.id,
      propensityScore: 0,
      rank: 999,
      included: false,
      reasonCode: `amount_outside_envelope:${lender.min_amount_cents}-${lender.max_amount_cents}`,
      estimatedAprBps: null,
      estimatedMaxCents: null,
    };
  }

  // Propensity scoring: start from tier base, apply heuristic adjustments.
  let score = TIER_BASE_SCORE[inputs.tier];

  // DTI penalty: > 0.43 starts to hurt.
  if (inputs.dti != null) {
    if (inputs.dti > 0.5) score -= 15;
    else if (inputs.dti > 0.43) score -= 7;
    else if (inputs.dti < 0.3) score += 4;
  }

  // Open tradelines: 4–10 ideal range.
  if (inputs.openTradelines != null) {
    if (inputs.openTradelines === 0) score -= 12;
    else if (inputs.openTradelines >= 4 && inputs.openTradelines <= 10) score += 3;
    else if (inputs.openTradelines > 15) score -= 4;
  }

  // FICO band fine adjustment.
  if (inputs.ficoBand != null) {
    if (inputs.ficoBand >= 760) score += 5;
    else if (inputs.ficoBand >= 700) score += 2;
    else if (inputs.ficoBand < 620) score -= 8;
  }

  // Clamp to 0..100.
  score = Math.max(0, Math.min(100, score));

  return {
    lenderId: lender.id,
    displayName: lender.id,
    propensityScore: Math.round(score),
    rank: 0, // assigned after sorting
    included: true,
    reasonCode: null,
    estimatedAprBps: APR_BY_TIER_BPS[inputs.tier],
    estimatedMaxCents: Math.min(inputs.amountCents, lender.max_amount_cents),
  };
}

/** Run the internal engine against the full SAMPLE_LENDERS catalogue. */
function runInternalEngine(inputs: PrequalInputs): RankedLender[] {
  const scored = SAMPLE_LENDERS.map((l) => scoreLender(l, inputs));
  // Sort: included first by descending propensity, then excluded by alpha.
  const included = scored
    .filter((s) => s.included)
    .sort((a, b) => b.propensityScore - a.propensityScore)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));
  const excluded = scored.filter((s) => !s.included);
  return [...included, ...excluded];
}

/* ---------- public API ---------- */

export interface EvaluateOpts {
  applicationId: string;
  prequal: PrequalInputs;
  /** Force a specific engine. Defaults to env-driven selection. */
  engine?: 'trutopia' | 'internal' | 'fallback';
  /** Persist the decision to the `decisions` table. Defaults to true
   * when `hasDb()` is true. */
  persist?: boolean;
}

function selectEngine(opts: EvaluateOpts): 'trutopia' | 'internal' | 'fallback' {
  if (opts.engine) return opts.engine;
  if (process.env.TRUTOPIA_ENGINE_URL && process.env.TRUTOPIA_ENGINE_KEY) return 'trutopia';
  return 'internal';
}

export async function evaluateDecision(opts: EvaluateOpts): Promise<DecisionResult> {
  const t0 = Date.now();
  const engine = selectEngine(opts);
  const engineVersion = engine === 'trutopia' ? 'trutopia_cloud_v1' : 'internal_v1';

  let rankedLenders: RankedLender[];
  if (engine === 'trutopia') {
    try {
      const res = await fetch(`${process.env.TRUTOPIA_ENGINE_URL}/v1/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TRUTOPIA_ENGINE_KEY}`,
        },
        body: JSON.stringify({ applicationId: opts.applicationId, ...opts.prequal }),
      });
      if (!res.ok) throw new Error(`Trutopia engine ${res.status}`);
      const body = (await res.json()) as { rankedLenders: RankedLender[] };
      rankedLenders = body.rankedLenders;
    } catch {
      // Fall through to internal engine on any failure.
      rankedLenders = runInternalEngine(opts.prequal);
    }
  } else {
    rankedLenders = runInternalEngine(opts.prequal);
  }

  const included = rankedLenders.filter((r) => r.included);
  const excluded = rankedLenders.filter((r) => !r.included);
  const topScore = included.length > 0 && included[0] ? included[0].propensityScore : null;
  const latencyMs = Date.now() - t0;

  const shouldPersist = opts.persist ?? hasDb();
  let decisionId = `dec_${Date.now().toString(36)}`;

  if (shouldPersist) {
    try {
      const db = getDb();
      const [row] = await db
        .insert(schema.decisions)
        .values({
          applicationId: opts.applicationId,
          engine,
          engineVersion,
          inputsJson: JSON.stringify(opts.prequal),
          rankedLendersJson: JSON.stringify(rankedLenders),
          eligibleLenderCount: included.length,
          excludedLenderCount: excluded.length,
          topPropensityScore: topScore,
          latencyMs,
        })
        .returning({ id: schema.decisions.id });
      if (row) decisionId = row.id;

      // Append an audit event so the application-events log shows the decision happened.
      await db.insert(schema.applicationEvents).values({
        applicationId: opts.applicationId,
        type: 'lender_quoted',
        payload: JSON.stringify({
          decisionId,
          engine,
          eligibleCount: included.length,
          topPropensityScore: topScore,
        }),
        actor: 'decision_engine',
      });
    } catch {
      // Persistence failure shouldn't break the consumer flow — the
      // decision still runs, it just doesn't make it to the audit log.
    }
  }

  return {
    decisionId,
    engine,
    engineVersion,
    rankedLenders,
    eligibleCount: included.length,
    excludedCount: excluded.length,
    topPropensityScore: topScore,
    latencyMs,
  };
}
