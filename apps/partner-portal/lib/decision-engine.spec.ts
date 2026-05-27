import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Specs for the decision engine (Tasks #44, #47, #49).
 *
 * Covers:
 *   1. Each tier (A/B/C/D) produces a non-empty ranked list with the
 *      correct propensity floor.
 *   2. Every excluded `RankedLender` row carries a Reg B reason code +
 *      principal-reason text matching the internal code.
 *   3. Trutopia timeout → fallback to internal scorer with
 *      `engineFallback: true` and `engine: 'internal'`.
 *   4. DB transaction failure does NOT throw; payload lands in
 *      `dlq/decisions/<id>.json` and the metric counter increments.
 *   5. `db.transaction()` rolls back both inserts on failure (mocked
 *      transaction handle simulates the rollback).
 */

// ---------------------------------------------------------------------------
// Module-level mocks. `vi.mock` is hoisted, so these must come before
// importing the module under test.
// ---------------------------------------------------------------------------

const hasDbMock = vi.fn(() => false);
const transactionMock = vi.fn();

vi.mock('./db', async () => {
  const real = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...real,
    hasDb: () => hasDbMock(),
    getDb: () => ({
      transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn),
    }),
  };
});

import {
  evaluateDecision,
  internalReasonToRegB,
  getMetricsSnapshot,
  isProfileTooThinForInternalScorer,
  _resetMetricsForTest,
  type PrequalInputs,
  type RankedLender,
  type IncludedLender,
  type ExcludedLender,
} from './decision-engine';
import type { Brand } from './api-v1/shared';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const APP_ID = '11111111-1111-4111-8111-111111111111';

const basePrequal: PrequalInputs = {
  tier: 'A',
  ficoBand: 760,
  dti: 0.25,
  openTradelines: 6,
  amountCents: 10_000_00,
  annualIncomeCents: 120_000_00,
  state: 'CA',
  brand: 'medpay',
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('decision-engine', () => {
  let tmpCwd: string;
  let originalCwd: () => string;

  beforeEach(() => {
    _resetMetricsForTest();
    hasDbMock.mockReturnValue(false);
    transactionMock.mockReset();
    // Redirect cwd → tmp so DLQ writes don't pollute the repo.
    tmpCwd = mkdtempSync(join(tmpdir(), 'decision-engine-spec-'));
    originalCwd = process.cwd;
    process.cwd = () => tmpCwd;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.TRUTOPIA_ENGINE_URL;
    delete process.env.TRUTOPIA_ENGINE_KEY;
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmSync(tmpCwd, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Synthetic-inputs / tier coverage
  // -------------------------------------------------------------------------

  describe('runs the internal engine for each tier', () => {
    /**
     * Pair each tier with a brand that has at least one sample lender
     * serving that tier (Kestrel is the only sub_prime lender and is
     * tradepay-only; medpay has no sub_prime lender).
     */
    const tierCases: ReadonlyArray<{ tier: PrequalInputs['tier']; brand: Brand }> = [
      { tier: 'A', brand: 'medpay' },
      { tier: 'B', brand: 'medpay' },
      { tier: 'C', brand: 'medpay' },
      { tier: 'D', brand: 'tradepay' },
    ];
    it.each(tierCases)(
      'tier $tier ($brand) produces ranked lenders with positive propensity',
      async ({ tier, brand }) => {
        const result = await evaluateDecision({
          applicationId: APP_ID,
          prequal: { ...basePrequal, tier, brand },
          engine: 'internal',
          persist: false,
        });

        expect(result.engine).toBe('internal');
        expect(result.engineFallback).toBe(false);
        // New fail-closed contract (Task #44 rewrite). A clean internal
        // run with no upstream failure is `normal`, status='ok'.
        expect(result.decisionMode).toBe('normal');
        expect(result.status).toBe('ok');
        expect(result.detail).toBeNull();
        expect(result.rankedLenders.length).toBeGreaterThan(0);
        const included = result.rankedLenders.filter((r) => r.included);
        expect(included.length).toBeGreaterThan(0);
        expect(included[0]!.propensityScore).toBeGreaterThan(0);
        expect(included[0]!.rank).toBe(1);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Fail-closed profile heuristic (Task #44 rewrite)
  // -------------------------------------------------------------------------

  describe('isProfileTooThinForInternalScorer', () => {
    it('returns true when every signal is null', () => {
      expect(
        isProfileTooThinForInternalScorer({
          ...basePrequal,
          ficoBand: null,
          dti: null,
          openTradelines: null,
        }),
      ).toBe(true);
    });

    it('returns false when at least one signal is present', () => {
      expect(
        isProfileTooThinForInternalScorer({
          ...basePrequal,
          ficoBand: null,
          dti: 0.3,
          openTradelines: null,
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Reg B reason-code translation (Task #47)
  // -------------------------------------------------------------------------

  describe('internalReasonToRegB', () => {
    it('maps brand_mismatch:* → GEOGRAPHY (vertical-tailored copy)', () => {
      expect(internalReasonToRegB('brand_mismatch:medpay')).toEqual({
        regBReasonCode: 'GEOGRAPHY',
        principalReasonText: 'We do not extend credit in this vertical at this time',
      });
    });

    it('maps tier_mismatch:* → CREDIT_PROFILE_NEGATIVE', () => {
      const out = internalReasonToRegB('tier_mismatch:D');
      expect(out.regBReasonCode).toBe('CREDIT_PROFILE_NEGATIVE');
      expect(out.principalReasonText).toBe('Credit application incomplete');
    });

    it('maps amount_outside_envelope:* with too-small request → LOAN_AMOUNT_TOO_SMALL', () => {
      const out = internalReasonToRegB('amount_outside_envelope:100000-5000000', 50_000);
      expect(out.regBReasonCode).toBe('LOAN_AMOUNT_TOO_SMALL');
      expect(out.principalReasonText).toBe('Loan amount below minimum');
    });

    it('maps amount_outside_envelope:* with too-large request → LOAN_AMOUNT_TOO_LARGE', () => {
      const out = internalReasonToRegB('amount_outside_envelope:100000-5000000', 10_000_000);
      expect(out.regBReasonCode).toBe('LOAN_AMOUNT_TOO_LARGE');
      expect(out.principalReasonText).toBe('Loan amount above maximum');
    });

    it('defaults amount_outside_envelope to LOAN_AMOUNT_TOO_SMALL when amount omitted', () => {
      const out = internalReasonToRegB('amount_outside_envelope:100000-5000000');
      expect(out.regBReasonCode).toBe('LOAN_AMOUNT_TOO_SMALL');
    });

    it('falls back to CREDIT_PROFILE_NEGATIVE for unknown codes', () => {
      const out = internalReasonToRegB('something_we_have_not_seen');
      expect(out.regBReasonCode).toBe('CREDIT_PROFILE_NEGATIVE');
    });
  });

  it('every excluded RankedLender has a regBReasonCode populated', async () => {
    // Tradepay brand triggers brand_mismatch for medpay-only lenders;
    // amount of 50k (1k smaller than some lenders' 5k floor when read
    // as cents) triggers envelope mismatch for higher-min lenders.
    const result = await evaluateDecision({
      applicationId: APP_ID,
      prequal: { ...basePrequal, brand: 'tradepay' },
      engine: 'internal',
      persist: false,
    });

    // Narrowing predicate enforces the discriminated-union invariant
    // at compile time — `row.regBReasonCode` is `RegBReasonCode`, not
    // `RegBReasonCode | null`.
    const excluded = result.rankedLenders.filter((r): r is ExcludedLender => !r.included);
    expect(excluded.length).toBeGreaterThan(0);
    for (const row of excluded) {
      // Field is a required string under the new union — assert non-empty.
      expect(row.regBReasonCode).toBeTruthy();
      expect(row.principalReasonText).toBeTruthy();
      expect(row.reasonCode).toBeTruthy();
    }

    // Conversely, included rows do not even carry the Reg B keys —
    // attempting to read `row.regBReasonCode` here would be a compile
    // error. The presence/absence is enforced by the type, not by a
    // runtime null check.
    const included = result.rankedLenders.filter((r): r is IncludedLender => r.included);
    for (const row of included) {
      expect(row).not.toHaveProperty('regBReasonCode');
      expect(row).not.toHaveProperty('principalReasonText');
      expect(row).not.toHaveProperty('reasonCode');
      // Included rows DO carry the offer-ranking fields.
      expect(row.propensityScore).toBeGreaterThanOrEqual(0);
      expect(row.estimatedAprBps).toBeGreaterThan(0);
      expect(row.estimatedMaxCents).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // Regression: discriminated-union type narrowing (type-design audit fix)
  // -------------------------------------------------------------------------

  describe('RankedLender discriminated union', () => {
    it('narrows via the `included` discriminant', async () => {
      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: { ...basePrequal, brand: 'tradepay' },
        engine: 'internal',
        persist: false,
      });

      for (const r of result.rankedLenders) {
        if (r.included) {
          // Inside this branch, TS sees `IncludedLender` — the
          // adverse-action fields are not in scope. The runtime
          // assertions mirror what the type says.
          expect(typeof r.propensityScore).toBe('number');
          expect(typeof r.rank).toBe('number');
          expect(typeof r.estimatedAprBps).toBe('number');
          expect(typeof r.estimatedMaxCents).toBe('number');
        } else {
          // Inside this branch, TS sees `ExcludedLender` — propensity
          // fields are not in scope.
          expect(typeof r.reasonCode).toBe('string');
          expect(typeof r.regBReasonCode).toBe('string');
          expect(typeof r.principalReasonText).toBe('string');
        }
      }
    });

    it('DecisionResult narrows via decisionMode switch', async () => {
      const normal = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        engine: 'internal',
        persist: false,
      });

      // Exhaustive switch — TypeScript will flag a missing arm here as
      // a regression if a new DecisionMode is added without a matching
      // DecisionResult variant.
      switch (normal.decisionMode) {
        case 'normal':
          expect(normal.status).toBe('ok');
          expect(normal.detail).toBeNull();
          expect(normal.rankedLenders.length).toBeGreaterThan(0);
          break;
        case 'fallback_internal':
          expect(normal.engineFallback).toBe(true);
          expect(normal.status).toBe('ok');
          break;
        case 'failed_persisted_to_dlq':
          expect(normal.status).toBe('failed');
          // `detail` is non-null on the failed arm — enforced by type.
          expect(normal.detail.length).toBeGreaterThan(0);
          break;
        default: {
          const _exhaustive: never = normal;
          throw new Error(`unreachable: ${String(_exhaustive)}`);
        }
      }
    });

    it('RankedLender type-guard predicates compose', () => {
      const arr: RankedLender[] = [
        {
          included: true,
          lenderId: 'L1',
          displayName: 'L1',
          propensityScore: 80,
          rank: 1,
          estimatedAprBps: 999,
          estimatedMaxCents: 500_000,
        },
        {
          included: false,
          lenderId: 'L2',
          displayName: 'L2',
          reasonCode: 'tier_mismatch:D',
          regBReasonCode: 'CREDIT_PROFILE_NEGATIVE',
          principalReasonText: 'Credit application incomplete',
        },
      ];
      const inc = arr.filter((r): r is IncludedLender => r.included);
      const exc = arr.filter((r): r is ExcludedLender => !r.included);
      expect(inc).toHaveLength(1);
      expect(exc).toHaveLength(1);
      expect(inc[0]!.propensityScore).toBe(80);
      expect(exc[0]!.regBReasonCode).toBe('CREDIT_PROFILE_NEGATIVE');
    });
  });

  // -------------------------------------------------------------------------
  // Trutopia timeout → fallback (Task #49 + Task #44b)
  // -------------------------------------------------------------------------

  describe('Trutopia upstream', () => {
    beforeEach(() => {
      process.env.TRUTOPIA_ENGINE_URL = 'https://trutopia.test';
      process.env.TRUTOPIA_ENGINE_KEY = 'k_test';
    });

    it('timeout → fallback to internal with engineFallback: true', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        // Simulate AbortSignal.timeout firing — reject with an AbortError.
        await new Promise<void>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted due to timeout');
              err.name = 'TimeoutError';
              reject(err);
            });
          }
        });
        throw new Error('unreachable');
      });

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        persist: false,
      });

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(result.engine).toBe('internal');
      expect(result.engineVersion).toBe('internal_v1_fallback_from_trutopia');
      expect(result.engineFallback).toBe(true);
      // New contract: rich profile + Trutopia down → fallback_internal.
      // status remains 'ok' because offer-ranking is fail-OPEN-safe
      // when the consumer has scoring signal; sanctions-blocking would
      // be a different decision and warrant a separate code path.
      expect(result.decisionMode).toBe('fallback_internal');
      expect(result.status).toBe('ok');
      expect(result.detail).toBeNull();
      expect(result.rankedLenders.length).toBeGreaterThan(0);
      expect(getMetricsSnapshot().trutopiaTimeout).toBe(1);
      expect(getMetricsSnapshot().trutopiaFailure).toBe(0);
    });

    it('timeout + thin file → fail-CLOSED, status=failed, no ranked lenders', async () => {
      // Brutally thin profile: no FICO, no DTI, no tradelines. The
      // internal scorer's output here would be a coin flip — the
      // fail-closed branch refuses to dress that up as a decision.
      const thinPrequal: PrequalInputs = {
        ...basePrequal,
        ficoBand: null,
        dti: null,
        openTradelines: null,
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        await new Promise<void>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('timeout');
              err.name = 'TimeoutError';
              reject(err);
            });
          }
        });
        throw new Error('unreachable');
      });

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: thinPrequal,
        persist: false,
      });

      expect(result.decisionMode).toBe('failed_persisted_to_dlq');
      expect(result.status).toBe('failed');
      expect(result.detail).toBe('thin_file_no_fallback');
      expect(result.rankedLenders).toHaveLength(0);
      expect(result.eligibleCount).toBe(0);
      expect(result.topPropensityScore).toBeNull();

      // DLQ entry MUST exist — operators replay from disk on recovery.
      const dlqPath = join(tmpCwd, 'dlq', 'decisions', `${result.decisionId}.json`);
      expect(existsSync(dlqPath)).toBe(true);
      const entry = JSON.parse(readFileSync(dlqPath, 'utf8')) as {
        decisionMode: string;
        applicationStatus: string;
        detail: string;
      };
      expect(entry.decisionMode).toBe('failed_persisted_to_dlq');
      expect(entry.applicationStatus).toBe('failed_decisioning');
      expect(entry.detail).toBe('thin_file_no_fallback');
    });

    it('non-2xx response → fallback labelled as failure, not timeout', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('upstream error', { status: 502 }),
      );

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        persist: false,
      });

      expect(result.engine).toBe('internal');
      expect(result.engineFallback).toBe(true);
      expect(result.decisionMode).toBe('fallback_internal');
      expect(result.status).toBe('ok');
      expect(getMetricsSnapshot().trutopiaFailure).toBe(1);
      expect(getMetricsSnapshot().trutopiaTimeout).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence: transaction success + DLQ on failure (Task #44a)
  // -------------------------------------------------------------------------

  describe('persistence', () => {
    it('wraps both inserts in a single db.transaction()', async () => {
      hasDbMock.mockReturnValue(true);
      let txInserts = 0;
      transactionMock.mockImplementation(async (fn) => {
        const tx = {
          insert: () => ({
            values: () => ({
              returning: async () => {
                txInserts += 1;
                return [{ id: 'dec_persisted_uuid' }];
              },
            }),
          }),
        };
        // Second insert path (applicationEvents) has no .returning.
        const txWithEvents = {
          insert: (_table: unknown) => ({
            values: async (_v: unknown) => {
              txInserts += 1;
              return undefined;
            },
            // First insert path keeps the .returning chain.
            returning: async () => {
              txInserts += 1;
              return [{ id: 'dec_persisted_uuid' }];
            },
          }),
        };
        // Combine: every .insert() returns an object exposing both
        // .values().returning() (for decisions) and .values() (for
        // applicationEvents).
        const combinedTx = {
          insert: () => ({
            values: (_v: unknown) => {
              txInserts += 1;
              const builder = {
                returning: async () => [{ id: 'dec_persisted_uuid' }],
              };
              // Make awaiting the bare .values() chain work for the
              // applicationEvents insert.
              return Object.assign(Promise.resolve(undefined), builder);
            },
          }),
        };
        void tx;
        void txWithEvents;
        return fn(combinedTx);
      });

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        engine: 'internal',
      });

      expect(transactionMock).toHaveBeenCalledOnce();
      expect(txInserts).toBeGreaterThanOrEqual(2);
      expect(result.decisionId).toBe('dec_persisted_uuid');
      expect(result.decisionMode).toBe('normal');
      expect(result.status).toBe('ok');
      expect(getMetricsSnapshot().decisionPersistDlq).toBe(0);
    });

    it('transaction failure does NOT throw, lands in DLQ', async () => {
      hasDbMock.mockReturnValue(true);
      transactionMock.mockRejectedValue(new Error('connection terminated'));

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        engine: 'internal',
      });

      // Decision row still returns to the orchestrator, but the new
      // contract forces decisionMode='failed_persisted_to_dlq' +
      // status='failed' so the orchestrator MUST NOT proceed to offers.
      expect(result.rankedLenders.length).toBeGreaterThan(0);
      expect(result.engine).toBe('internal');
      expect(result.decisionMode).toBe('failed_persisted_to_dlq');
      expect(result.status).toBe('failed');
      expect(result.detail).toBe('persist_failed');

      // DLQ entry exists at the expected path.
      const dlqPath = join(tmpCwd, 'dlq', 'decisions', `${result.decisionId}.json`);
      expect(existsSync(dlqPath)).toBe(true);

      const entry = JSON.parse(readFileSync(dlqPath, 'utf8')) as {
        decisionId: string;
        applicationId: string;
        engine: string;
        error: { name: string; message: string };
        rankedLendersJson: string;
      };
      expect(entry.decisionId).toBe(result.decisionId);
      expect(entry.applicationId).toBe(APP_ID);
      expect(entry.engine).toBe('internal');
      expect(entry.error.message).toBe('connection terminated');
      expect(JSON.parse(entry.rankedLendersJson)).toHaveLength(result.rankedLenders.length);

      // Metric counter bumped.
      expect(getMetricsSnapshot().decisionPersistDlq).toBe(1);
    });

    it('transaction rollback on second insert failure still hits DLQ', async () => {
      hasDbMock.mockReturnValue(true);
      transactionMock.mockImplementation(async (fn) => {
        let callIdx = 0;
        const tx = {
          insert: () => ({
            values: (_v: unknown) => {
              callIdx += 1;
              if (callIdx === 1) {
                // decisions insert succeeds and returns a row id.
                return {
                  returning: async () => [{ id: 'dec_would_be' }],
                };
              }
              // applicationEvents insert fails → tx rolls back.
              return Promise.reject(new Error('application_events FK violation'));
            },
          }),
        };
        return fn(tx);
      });

      const result = await evaluateDecision({
        applicationId: APP_ID,
        prequal: basePrequal,
        engine: 'internal',
      });

      const dlqPath = join(tmpCwd, 'dlq', 'decisions', `${result.decisionId}.json`);
      expect(existsSync(dlqPath)).toBe(true);
      expect(getMetricsSnapshot().decisionPersistDlq).toBe(1);
      // decisionId is the pre-allocated UUID, NOT the would-be DB row id —
      // because the transaction rolled back, that row doesn't exist.
      expect(result.decisionId).not.toBe('dec_would_be');
      // Same fail-closed contract: orchestrator MUST NOT proceed.
      expect(result.decisionMode).toBe('failed_persisted_to_dlq');
      expect(result.status).toBe('failed');
    });
  });
});
