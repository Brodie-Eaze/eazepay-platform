import { sha256Hex, stableJsonSha256 } from '@eazepay/shared-utils';
import type { CanonicalPrequal } from './financials.js';
import type { DecideRequest, IncludedLender } from './wire.js';
import type { RunDecisionResult } from './decide.js';
import type { AggregatedDecision, DecisionDisposition, IncompleteField } from './aggregate.js';
import type { RegBReasonCode } from './reason-codes.js';
import type { EngineVersionPins } from './decision-engine.port.js';
import { scorePropensity, type ScoreContribution } from './scorer.js';
import {
  DecisionPersistenceError,
  type AadContext,
  type AuditDecisionAfter,
  type AuditOutboxRow,
  type BasisCipherPort,
  type DecisionBasisRow,
  type DecisionRecordRow,
  type DecisionRepositoryPort,
  type DurableDecisionWrite,
  type IdempotencyRow,
  type PersistedDecision,
} from './persistence.port.js';

/**
 * The pure decision-persistence core (P6, ADR-0033).
 *
 * Standalone-pure (ADR-0027): this file imports ONLY @eazepay/shared-utils
 * and engine-internal modules — no `@prisma/client`, no sibling service. The
 * durable write reaches the database through `DecisionRepositoryPort` and the
 * §615(a) basis is encrypted through `BasisCipherPort`; the clock and the id
 * factory are injected. So the whole core is deterministic and DB-free under
 * test, and the Prisma binding lands later (P7) without touching this logic.
 *
 * What it guarantees:
 *   • PII lives in exactly ONE durable place — the encrypted DecisionBasis —
 *     and only as ciphertext. The queryable DecisionRecord and the audit
 *     outbox carry ids, reason CODES, version pins, counts and fingerprints.
 *   • The write is idempotent (ADR-0015): the derived key replays a prior
 *     decision instead of writing a second.
 *   • The write is all-or-nothing (the repository's contract). On failure the
 *     bundle is best-effort dead-lettered (encrypted) and a
 *     DecisionPersistenceError is rethrown — fail-closed, retry-safe.
 */

/** Bump when the durable basis JSON shape changes (migration signal). */
export const BASIS_SCHEMA_VERSION = 1;

/** The route the idempotency backstop records this decision under. */
export const DECIDE_PATH = '/v1/decide';

/** Offer freshness window — a Highsale-pull liveness bound, NOT a purge. */
export const OFFERS_VALID_DAYS = 14;

/** FCRA 12 CFR 1002.12(b) basis-retention floor. record + basis + dlq co-retain. */
export const BASIS_RETENTION_MONTHS = 25;

/**
 * Canonical JSON for the basis plaintext, the basis fingerprint, and the DLQ
 * bundle. Sorted keys at every depth give a byte-identical serialisation for
 * the same value, so the fingerprint is stable across replays (ADR-0028).
 *
 * It deliberately diverges from `stableJsonSha256` in ONE way: it maps a Date
 * to its ISO-8601 string. `stableJsonSha256` runs Dates through
 * `Object.fromEntries(Object.entries(date))`, which yields `{}` and silently
 * loses the timestamp. The DLQ bundle carries real Date fields
 * (offersValidUntil / retainUntil / decidedAt), so it MUST use this function.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Default sort = UTF-16 code-unit order: locale-independent and stable,
    // which is what a replay-critical canonical form needs.
    for (const key of Object.keys(source).sort()) {
      const canonical = canonicalize(source[key]);
      // Mirror JSON.stringify: an undefined-valued key is dropped entirely.
      if (canonical !== undefined) out[key] = canonical;
    }
    return out;
  }
  return value;
}

/**
 * Derive the idempotency key for a decide request (ADR-0015 + ADR-0033). The
 * key is `applicationId:sha256(canonical request)`, so two byte-identical
 * requests for the same application collapse to one durable decision and a
 * changed input necessarily mints a new key — there is no 409 path by
 * construction. `DecideRequest` has no Date fields, so `stableJsonSha256` is
 * safe (and intentionally reused) here.
 */
export function deriveIdempotencyKey(request: DecideRequest): {
  idempotencyKey: string;
  inputsHash: string;
} {
  const inputsHash = stableJsonSha256(request);
  return { idempotencyKey: `${request.applicationId}:${inputsHash}`, inputsHash };
}

/**
 * The two retention horizons (ADR-0033). `offersValidUntil` is a 14-day offer
 * freshness bound; `retainUntil` is the 25-month FCRA basis floor shared by
 * the record, the basis, and any dead-letter. Months are a calendar add via
 * setUTCMonth, so a month-end rollover only ever lengthens retention — safe
 * for a floor, never short.
 */
export function retentionFor(now: Date): { offersValidUntil: Date; retainUntil: Date } {
  return {
    offersValidUntil: addDays(now, OFFERS_VALID_DAYS),
    retainUntil: addMonths(now, BASIS_RETENTION_MONTHS),
  };
}

function addDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(from: Date, months: number): Date {
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** The flattened decision facts the record, audit row, and basis all draw from. */
export interface ProjectedAggregate {
  disposition: DecisionDisposition;
  reasonCodes: RegBReasonCode[];
  incompleteFields: IncompleteField[];
  offers: IncludedLender[];
  offerCount: number;
}

/**
 * Flatten an AggregatedDecision into the fields every durable row needs, via
 * an exhaustive switch so a new disposition is a compile error, never a
 * silently-dropped case. Only the matching arm is populated; the rest stay
 * empty, which keeps illegal combinations (offers on a denial) unrepresentable.
 */
export function projectAggregated(aggregated: AggregatedDecision): ProjectedAggregate {
  switch (aggregated.disposition) {
    case 'OFFERS':
      return {
        disposition: 'OFFERS',
        reasonCodes: [],
        incompleteFields: [],
        offers: [...aggregated.offers],
        offerCount: aggregated.offers.length,
      };
    case 'ADVERSE_ACTION':
      return {
        disposition: 'ADVERSE_ACTION',
        reasonCodes: [...aggregated.reasonCodes],
        incompleteFields: [],
        offers: [],
        offerCount: 0,
      };
    case 'INCOMPLETE':
      return {
        disposition: 'INCOMPLETE',
        reasonCodes: [],
        incompleteFields: [...aggregated.incompleteFields],
        offers: [],
        offerCount: 0,
      };
    case 'NO_OFFER':
      return {
        disposition: 'NO_OFFER',
        reasonCodes: [],
        incompleteFields: [],
        offers: [],
        offerCount: 0,
      };
    default: {
      const exhaustive: never = aggregated;
      throw new Error(`unhandled disposition: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** The explainable §615(a) score block stored inside the basis. */
export interface DurableBasisScore {
  propensityScore: number;
  baseScoreScaled: number;
  internalScoreScaled: number;
  clamped: boolean;
  scoreScale: number;
  /** The SR 11-7 / §615(a) key-factors record, in application order. */
  factors: ScoreContribution[];
}

/**
 * The full §615(a) basis — the ONLY structure that carries PII (the prequal
 * echo + the score factors). It is canonicalised, fingerprinted, then sealed
 * by the cipher BEFORE the transaction, so plaintext never reaches the repo.
 */
export interface DurableBasis {
  schemaVersion: number;
  applicationId: string;
  /** The exact prequal inputs the decision reasoned over (PII). */
  input: CanonicalPrequal;
  disposition: DecisionDisposition;
  reasonCodes: RegBReasonCode[];
  incompleteFields: IncompleteField[];
  offers: IncludedLender[];
  score: DurableBasisScore;
  versions: EngineVersionPins;
  configDigest: string;
  catalogFingerprint: string;
  effectiveCatalogSnapshotId: string;
  /** ISO-8601 decision time, mirrored from the record's decidedAt. */
  decidedAt: string;
}

/**
 * Build the durable basis, its canonical plaintext, and its tamper-evidence
 * fingerprint. The input echo is constructed field-by-field (never spread)
 * so `applicationId` can never leak into it and the basis carries exactly the
 * eight classified prequal fields and nothing else.
 */
export function buildDurableBasis(args: {
  request: DecideRequest;
  runResult: RunDecisionResult;
  projected: ProjectedAggregate;
  decidedAtIso: string;
}): { basis: DurableBasis; plaintext: string; fingerprint: string } {
  const { request, runResult, projected, decidedAtIso } = args;

  const input: CanonicalPrequal = {
    tier: request.tier,
    ficoBand: request.ficoBand,
    dti: request.dti,
    openTradelines: request.openTradelines,
    amountCents: request.amountCents,
    annualIncomeCents: request.annualIncomeCents,
    state: request.state,
    brand: request.brand,
  };

  const score = scorePropensity(input, runResult.snapshot.config);

  const basis: DurableBasis = {
    schemaVersion: BASIS_SCHEMA_VERSION,
    applicationId: request.applicationId,
    input,
    disposition: projected.disposition,
    reasonCodes: projected.reasonCodes,
    incompleteFields: projected.incompleteFields,
    offers: projected.offers,
    score: {
      propensityScore: score.propensityScore,
      baseScoreScaled: score.baseScoreScaled,
      internalScoreScaled: score.internalScoreScaled,
      clamped: score.clamped,
      scoreScale: score.scoreScale,
      factors: score.contributions,
    },
    versions: runResult.snapshot.versions,
    configDigest: runResult.snapshot.configDigest,
    catalogFingerprint: runResult.snapshot.catalogFingerprint,
    effectiveCatalogSnapshotId: runResult.snapshot.snapshotId,
    decidedAt: decidedAtIso,
  };

  const plaintext = canonicalJson(basis);
  return { basis, plaintext, fingerprint: sha256Hex(plaintext) };
}

/**
 * Local mirror of the SEC-040 banned-key regex. The engine re-implements the
 * guard rather than importing services/audit so it stays standalone-pure
 * (ADR-0027); the two must stay byte-equal.
 */
const BANNED_AUDIT_KEY = /ssn|dob|name|address|phone|email|account|routing/i;

/**
 * Throw if any key (at any depth) matches the banned-name regex (ADR-0033
 * defense-in-depth). The `after` payload is statically PII-free, but a typed
 * shape can drift and this is the immutable system-of-record — re-check at
 * construction. Throws a plain Error: a banned key is a programmer error.
 */
export function assertAuditSafe(payload: unknown, path = ''): void {
  if (payload === null || typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      assertAuditSafe(payload[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (BANNED_AUDIT_KEY.test(key)) {
      throw new Error(
        `decision_audit_forbidden_field: '${path ? `${path}.${key}` : key}' matches the SEC-040 banned-key regex; reference the subject by id instead`,
      );
    }
    assertAuditSafe(value, path ? `${path}.${key}` : key);
  }
}

/**
 * Build the same-transaction audit outbox row (ADR-0011). The `after` payload
 * is PII-free by construction — ids, reason codes, version pins, counts, and
 * the basis fingerprint — and is re-checked by `assertAuditSafe`.
 */
export function buildAuditOutboxRow(args: {
  decisionId: string;
  applicationId: string;
  idempotencyKey: string;
  disposition: DecisionDisposition;
  reasonCodes: RegBReasonCode[];
  offerCount: number;
  versions: EngineVersionPins;
  basisFingerprint: string;
}): AuditOutboxRow {
  const after: AuditDecisionAfter = {
    decisionId: args.decisionId,
    idempotencyKey: args.idempotencyKey,
    disposition: args.disposition,
    reasonCodes: args.reasonCodes,
    offerCount: args.offerCount,
    versions: args.versions,
    basisFingerprint: args.basisFingerprint,
  };
  assertAuditSafe(after);
  return {
    actorType: 'system',
    actorId: null,
    action: `decision.${args.disposition.toLowerCase()}`,
    targetType: 'Application',
    targetId: args.applicationId,
    after,
  };
}

/** What `persistDecision` needs from the outside world (all injected). */
export interface PersistDecisionInput {
  request: DecideRequest;
  runResult: RunDecisionResult;
  aggregated: AggregatedDecision;
  /** Denormalised tenant for RLS; null when no merchant context applies. */
  merchantId?: string | null;
}

export interface PersistDecisionDeps {
  repository: DecisionRepositoryPort;
  cipher: BasisCipherPort;
  /** Injected clock — the decision time, controlled for replay. */
  now: () => Date;
  /** Injected id factory — mints the decisionId deterministically under test. */
  newId: () => string;
}

/**
 * Persist one decision idempotently and atomically (ADR-0033).
 *
 *   1. Derive the key; a prior decision under it replays (no second write).
 *   2. Encrypt the §615(a) basis BEFORE the transaction — plaintext never
 *      reaches the repository.
 *   3. Write record + basis + audit + idempotency as ALL-OR-NOTHING.
 *   4. On failure: best-effort encrypted dead-letter, then rethrow
 *      DecisionPersistenceError so the caller 5xx's and the client retries
 *      under the same derived key (fail-closed, retry-safe).
 */
export async function persistDecision(
  input: PersistDecisionInput,
  deps: PersistDecisionDeps,
): Promise<PersistedDecision> {
  const { request, runResult, aggregated } = input;
  const merchantId = input.merchantId ?? null;
  const { repository, cipher, now, newId } = deps;

  const { idempotencyKey, inputsHash } = deriveIdempotencyKey(request);

  const existing = await repository.findByIdempotencyKey(idempotencyKey);
  if (existing !== null) {
    return { ...existing, replayed: true };
  }

  const decidedAt = now();
  const projected = projectAggregated(aggregated);
  const versions = runResult.snapshot.versions;

  // Only the sealed plaintext + its fingerprint are durable; the `basis`
  // object itself is exposed by buildDurableBasis for callers/tests.
  const { plaintext, fingerprint } = buildDurableBasis({
    request,
    runResult,
    projected,
    decidedAtIso: decidedAt.toISOString(),
  });

  const ciphertext = await cipher.seal(plaintext, basisAad(request.applicationId, idempotencyKey));

  const decisionId = newId();
  const { offersValidUntil, retainUntil } = retentionFor(decidedAt);

  const record: DecisionRecordRow = {
    id: decisionId,
    applicationId: request.applicationId,
    merchantId,
    idempotencyKey,
    disposition: projected.disposition,
    reasonCodes: projected.reasonCodes,
    offerCount: projected.offerCount,
    policyVersion: versions.policyVersion,
    ruleVersion: versions.ruleVersion,
    scorerVersion: versions.scorerVersion,
    effectiveCatalogSnapshotId: versions.effectiveCatalogSnapshotId,
    basisFingerprint: fingerprint,
    offersValidUntil,
    retainUntil,
    decidedAt,
  };

  const basisRow: DecisionBasisRow = {
    decisionId,
    ciphertext,
    fingerprint,
    inputsHash,
    schemaVersion: BASIS_SCHEMA_VERSION,
    retainUntil,
  };

  const audit = buildAuditOutboxRow({
    decisionId,
    applicationId: request.applicationId,
    idempotencyKey,
    disposition: projected.disposition,
    reasonCodes: projected.reasonCodes,
    offerCount: projected.offerCount,
    versions,
    basisFingerprint: fingerprint,
  });

  const idempotency: IdempotencyRow = {
    key: idempotencyKey,
    method: 'POST',
    path: DECIDE_PATH,
    requestHash: inputsHash,
    responseCode: 200,
    responseBody: runResult.response,
  };

  const write: DurableDecisionWrite = { record, basis: basisRow, audit, idempotency };

  try {
    await repository.persist(write);
  } catch (cause) {
    await safeDeadLetter(write, retainUntil, { repository, cipher });
    throw new DecisionPersistenceError('decision_durable_write_failed', { cause });
  }

  return {
    decisionId,
    idempotencyKey,
    disposition: projected.disposition,
    response: runResult.response,
    replayed: false,
  };
}

/** AAD that binds the sealed basis to this decision so it can't be replayed elsewhere. */
function basisAad(applicationId: string, idempotencyKey: string): AadContext {
  return { entity: 'decision_basis', applicationId, idempotencyKey };
}

/**
 * Best-effort encrypted dead-letter on write failure. The bundle is already
 * PII-free at the basis (ciphertext only), but it is sealed again under its
 * own AAD so the DLQ row carries zero plaintext. A hard-down database fails
 * the dead-letter too; that error is swallowed so the original
 * DecisionPersistenceError surfaces and the client retries under the same key.
 */
async function safeDeadLetter(
  write: DurableDecisionWrite,
  retainUntil: Date,
  deps: { repository: DecisionRepositoryPort; cipher: BasisCipherPort },
): Promise<void> {
  try {
    const bundleJson = canonicalJson(write);
    const ciphertext = await deps.cipher.seal(bundleJson, {
      entity: 'decision_dlq',
      applicationId: write.record.applicationId,
      idempotencyKey: write.record.idempotencyKey,
    });
    await deps.repository.deadLetter({
      idempotencyKey: write.record.idempotencyKey,
      applicationId: write.record.applicationId,
      ciphertext,
      fingerprint: sha256Hex(bundleJson),
      failureReason: 'durable_write_failed',
      retainUntil,
    });
  } catch {
    // Intentionally swallowed — see the function doc. The durable write stays
    // all-or-nothing and the original error is what the caller sees.
  }
}
