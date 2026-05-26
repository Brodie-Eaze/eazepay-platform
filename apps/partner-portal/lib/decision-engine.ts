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
 *
 * Reg B / FCRA notes
 * ------------------
 * Every excluded lender row carries an internal `reasonCode` AND a
 * Reg B reason code (CFPB Model Form C-1). The internal code preserves
 * engineering context (which envelope, which tier); the Reg B code is
 * what shows up on the consumer's adverse-action notice. The mapper
 * lives at `internalReasonToRegB()` below — keep it pure and exported
 * so the adverse-action notice generator can call it directly.
 *
 * Persistence integrity
 * ---------------------
 * The DB write of the `decisions` row + the `application_events` audit
 * row is wrapped in a single transaction (Task #44a). On transaction
 * failure we do NOT swallow — the payload is written to a file-backed
 * DLQ at `${cwd}/dlq/decisions/<decisionId>.json` and a metric counter
 * is bumped so the runbook alert fires. The decision still returns to
 * the consumer; replay reads the DLQ on Postgres recovery.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hasDb, getDb, schema } from './db';
import { safeLog } from './safe-log';
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

/**
 * CFPB Reg B / Model Form C-1 adverse-action reason codes. These are
 * the only labels acceptable on a 12 CFR 1002.9(a)(2) notice — internal
 * engineering codes like `tier_mismatch:C` cannot be shown to consumers.
 */
export type RegBReasonCode =
  | 'INCOME_INSUFFICIENT'
  | 'CREDIT_HISTORY_INSUFFICIENT'
  | 'CREDIT_PROFILE_NEGATIVE'
  | 'DTI_EXCESSIVE'
  | 'RESIDENCE_DURATION'
  | 'EMPLOYMENT_DURATION'
  | 'GEOGRAPHY'
  | 'LOAN_AMOUNT_TOO_SMALL'
  | 'LOAN_AMOUNT_TOO_LARGE';

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
  /** When excluded: the CFPB Reg B code suitable for an adverse-action
   * notice. NULL only when `included: true`. */
  regBReasonCode: RegBReasonCode | null;
  /** When excluded: human-readable principal reason text from CFPB
   * Model Form C-1. NULL only when `included: true`. */
  principalReasonText: string | null;
  /** Estimated APR band the consumer would see, in basis points. */
  estimatedAprBps: number | null;
  /** Estimated max approval amount, in cents. */
  estimatedMaxCents: number | null;
}

export interface DecisionResult {
  decisionId: string;
  engine: 'trutopia' | 'internal' | 'fallback';
  engineVersion: string;
  /** True when the persisted `engine` reflects a fallback from another
   * engine (e.g. Trutopia upstream failed → internal scorer ran). */
  engineFallback: boolean;
  rankedLenders: RankedLender[];
  eligibleCount: number;
  excludedCount: number;
  topPropensityScore: number | null;
  latencyMs: number;
}

/* ---------- Reg B reason-code mapping (Task #47) ---------- */

const REG_B_PRINCIPAL_TEXT: Record<RegBReasonCode, string> = {
  INCOME_INSUFFICIENT: 'Income insufficient for amount of credit requested',
  CREDIT_HISTORY_INSUFFICIENT: 'Insufficient number of credit references provided',
  CREDIT_PROFILE_NEGATIVE: 'Credit application incomplete',
  DTI_EXCESSIVE: 'Excessive obligations in relation to income',
  RESIDENCE_DURATION: 'Length of residence',
  EMPLOYMENT_DURATION: 'Length of employment',
  GEOGRAPHY: 'We do not grant credit in your state at this time',
  LOAN_AMOUNT_TOO_SMALL: 'Loan amount below minimum',
  LOAN_AMOUNT_TOO_LARGE: 'Loan amount above maximum',
};

/**
 * Translate an internal engine reason code into a CFPB Reg B reason
 * code + principal-reason text. The engine's internal codes encode
 * engineering context (which envelope, which tier) and are NOT
 * compliant adverse-action language under 12 CFR 1002.9.
 *
 * Mappings:
 *   • `brand_mismatch:*`                → GEOGRAPHY (we treat brand
 *     verticals like geographic markets — we don't extend credit in
 *     this vertical at this time)
 *   • `tier_mismatch:*`                 → CREDIT_PROFILE_NEGATIVE
 *   • `amount_outside_envelope:MIN-MAX` → LOAN_AMOUNT_TOO_SMALL or
 *     LOAN_AMOUNT_TOO_LARGE, picked by comparing the requested amount
 *     against the envelope bounds embedded in the code
 *   • Unknown                            → CREDIT_PROFILE_NEGATIVE
 *     (conservative default; TODO add an explicit mapping if a new
 *     internal code lands)
 *
 * `requestedAmountCents` is only consulted for envelope codes — if
 * omitted on an envelope code, defaults to LOAN_AMOUNT_TOO_SMALL.
 */
export function internalReasonToRegB(
  code: string,
  requestedAmountCents?: number,
): { regBReasonCode: RegBReasonCode; principalReasonText: string } {
  if (code.startsWith('brand_mismatch:')) {
    return {
      regBReasonCode: 'GEOGRAPHY',
      // Tailored variant of GEOGRAPHY for vertical-locked lenders.
      // CFPB allows the principal reason to be reworded so long as it
      // reflects the same factor (1002.9(b)(2)).
      principalReasonText: 'We do not extend credit in this vertical at this time',
    };
  }
  if (code.startsWith('tier_mismatch:')) {
    return {
      regBReasonCode: 'CREDIT_PROFILE_NEGATIVE',
      principalReasonText: REG_B_PRINCIPAL_TEXT.CREDIT_PROFILE_NEGATIVE,
    };
  }
  if (code.startsWith('amount_outside_envelope:')) {
    // Code shape: `amount_outside_envelope:<min>-<max>` in cents.
    const bounds = code.slice('amount_outside_envelope:'.length).split('-');
    const min = Number(bounds[0]);
    const max = Number(bounds[1]);
    if (
      requestedAmountCents != null &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      requestedAmountCents > max
    ) {
      return {
        regBReasonCode: 'LOAN_AMOUNT_TOO_LARGE',
        principalReasonText: REG_B_PRINCIPAL_TEXT.LOAN_AMOUNT_TOO_LARGE,
      };
    }
    return {
      regBReasonCode: 'LOAN_AMOUNT_TOO_SMALL',
      principalReasonText: REG_B_PRINCIPAL_TEXT.LOAN_AMOUNT_TOO_SMALL,
    };
  }
  // TODO add an explicit mapping when a new internal reason code is
  // introduced; the default lands on a generic Reg B code that's safe
  // to send but is less precise than it should be.
  return {
    regBReasonCode: 'CREDIT_PROFILE_NEGATIVE',
    principalReasonText: REG_B_PRINCIPAL_TEXT.CREDIT_PROFILE_NEGATIVE,
  };
}

/* ---------- metrics (in-memory; surfaced via getMetricsSnapshot) ---------- */

interface MetricsCounters {
  /** DB transaction failures that landed in the DLQ. */
  decisionPersistDlq: number;
  /** Trutopia fetch timeouts (AbortError) that triggered fallback. */
  trutopiaTimeout: number;
  /** Trutopia non-timeout failures (network / non-2xx). */
  trutopiaFailure: number;
}

const metrics: MetricsCounters = {
  decisionPersistDlq: 0,
  trutopiaTimeout: 0,
  trutopiaFailure: 0,
};

/** Snapshot of the in-memory metric counters. Cleared on process restart. */
export function getMetricsSnapshot(): Readonly<MetricsCounters> {
  return { ...metrics };
}

/** Test-only: reset counters between specs. */
export function _resetMetricsForTest(): void {
  metrics.decisionPersistDlq = 0;
  metrics.trutopiaTimeout = 0;
  metrics.trutopiaFailure = 0;
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

/** Build an excluded `RankedLender` row from an internal reason code,
 * filling the Reg B fields by way of the mapper. Centralises the
 * Reg B-population invariant: no excluded row leaves this module
 * without `regBReasonCode` populated (Task #47). */
function excludedLender(
  lender: (typeof SAMPLE_LENDERS)[number],
  reasonCode: string,
  requestedAmountCents: number,
): RankedLender {
  const regB = internalReasonToRegB(reasonCode, requestedAmountCents);
  return {
    lenderId: lender.id,
    displayName: lender.id,
    propensityScore: 0,
    rank: 999,
    included: false,
    reasonCode,
    regBReasonCode: regB.regBReasonCode,
    principalReasonText: regB.principalReasonText,
    estimatedAprBps: null,
    estimatedMaxCents: null,
  };
}

/** Heuristic eligibility check + propensity score for one lender. */
function scoreLender(lender: (typeof SAMPLE_LENDERS)[number], inputs: PrequalInputs): RankedLender {
  // Hard rule: brand allowlist.
  if (!lender.brands.includes(inputs.brand)) {
    return excludedLender(lender, `brand_mismatch:${inputs.brand}`, inputs.amountCents);
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
    return excludedLender(lender, `tier_mismatch:${inputs.tier}`, inputs.amountCents);
  }

  // Hard rule: amount envelope.
  if (
    inputs.amountCents < lender.min_amount_cents ||
    inputs.amountCents > lender.max_amount_cents
  ) {
    return excludedLender(
      lender,
      `amount_outside_envelope:${lender.min_amount_cents}-${lender.max_amount_cents}`,
      inputs.amountCents,
    );
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
    regBReasonCode: null,
    principalReasonText: null,
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

/** Trutopia fetch timeout. Consumer-facing apply flow blocks on this
 * call, so an 800ms ceiling keeps the worst-case under the 1s budget
 * before the user perceives a hang. Trutopia's published p99 is 612ms. */
const TRUTOPIA_TIMEOUT_MS = 800;

export async function evaluateDecision(opts: EvaluateOpts): Promise<DecisionResult> {
  const t0 = Date.now();
  // `let` (Task #44b) so the catch block can reassign on fallback.
  let engine: 'trutopia' | 'internal' | 'fallback' = selectEngine(opts);
  let engineVersion = engine === 'trutopia' ? 'trutopia_cloud_v1' : 'internal_v1';
  let engineFallback = false;

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
        // Task #49 — bound the upstream call. AbortSignal.timeout
        // surfaces as an AbortError, which we classify separately
        // from network failures below.
        signal: AbortSignal.timeout(TRUTOPIA_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Trutopia engine ${res.status}`);
      const body = (await res.json()) as { rankedLenders: RankedLender[] };
      rankedLenders = body.rankedLenders;
    } catch (err) {
      // Task #44b — relabel the persisted record so the audit row tells
      // the truth about which engine actually produced the decision.
      engine = 'internal';
      engineVersion = 'internal_v1_fallback_from_trutopia';
      engineFallback = true;

      // Task #49 — distinguish timeouts from other failures for the
      // monitoring dashboard. An AbortError is a SLA-breach signal;
      // other errors are typically network/5xx noise.
      const isTimeout =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isTimeout) {
        metrics.trutopiaTimeout += 1;
        safeLog.warn({
          event: 'trutopia.timeout',
          applicationId: opts.applicationId,
          timeoutMs: TRUTOPIA_TIMEOUT_MS,
        });
      } else {
        metrics.trutopiaFailure += 1;
        safeLog.warn({
          event: 'trutopia.failure',
          applicationId: opts.applicationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

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
  // Pre-allocate a UUID so the DLQ entry and the eventual DB row share
  // the same id — operators can reconcile on replay. Widened to `string`
  // so the DB-returned id (also a UUID, but typed as plain text by
  // Drizzle) can be reassigned without a template-literal mismatch.
  let decisionId: string = randomUUID();

  if (shouldPersist) {
    try {
      const db = getDb();
      // Task #44a — atomic write of decision + audit event. If either
      // insert fails, both roll back and we land in the DLQ branch.
      const insertedId = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.decisions)
          .values({
            applicationId: opts.applicationId,
            engine,
            engineVersion,
            engineFallback,
            inputsJson: JSON.stringify(opts.prequal),
            rankedLendersJson: JSON.stringify(rankedLenders),
            eligibleLenderCount: included.length,
            excludedLenderCount: excluded.length,
            topPropensityScore: topScore,
            latencyMs,
          })
          .returning({ id: schema.decisions.id });
        if (!row) throw new Error('decisions insert returned no row');

        await tx.insert(schema.applicationEvents).values({
          applicationId: opts.applicationId,
          type: 'lender_quoted',
          payload: JSON.stringify({
            decisionId: row.id,
            engine,
            engineFallback,
            eligibleCount: included.length,
            topPropensityScore: topScore,
          }),
          actor: 'decision_engine',
        });
        return row.id;
      });
      decisionId = insertedId;
    } catch (err) {
      // Task #44a — DO NOT swallow. A regulator replay must be able to
      // reconstruct every decision; if Postgres is down the payload
      // goes to a file-backed DLQ so an operator can replay on recovery.
      metrics.decisionPersistDlq += 1;
      const errMessage = err instanceof Error ? err.message : String(err);
      const errName = err instanceof Error ? err.name : 'UnknownError';

      safeLog.error({
        event: 'decision.persist.dlq',
        decisionId,
        applicationId: opts.applicationId,
        engine,
        engineFallback,
        error: errMessage,
        errorName: errName,
      });

      try {
        const dlqDir = join(process.cwd(), 'dlq', 'decisions');
        mkdirSync(dlqDir, { recursive: true });
        const dlqPath = join(dlqDir, `${decisionId}.json`);
        writeFileSync(
          dlqPath,
          JSON.stringify(
            {
              decisionId,
              applicationId: opts.applicationId,
              engine,
              engineVersion,
              engineFallback,
              inputsJson: JSON.stringify(opts.prequal),
              rankedLendersJson: JSON.stringify(rankedLenders),
              eligibleLenderCount: included.length,
              excludedLenderCount: excluded.length,
              topPropensityScore: topScore,
              latencyMs,
              error: { name: errName, message: errMessage },
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      } catch (dlqErr) {
        // DLQ write itself failed — disk full, perms, etc. Log loudly;
        // there is no further fallback. The structured log line is the
        // last-resort audit trail.
        safeLog.error({
          event: 'decision.persist.dlq.write_failed',
          decisionId,
          applicationId: opts.applicationId,
          error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
        });
      }
    }
  }

  return {
    decisionId,
    engine,
    engineVersion,
    engineFallback,
    rankedLenders,
    eligibleCount: included.length,
    excludedCount: excluded.length,
    topPropensityScore: topScore,
    latencyMs,
  };
}
