import { sha256Hex } from '@eazepay/shared-utils';
import { ENGINE_CONFIG_V1, type EngineConfig } from './config.js';
import { runDecision } from './decide.js';
import { aggregateDecision } from './aggregate.js';
import type { CatalogProductFingerprint } from './snapshot.js';
import type { DecideRequest } from './wire.js';
import {
  buildDurableBasis,
  canonicalJson,
  projectAggregated,
  type DurableBasis,
} from './persistence.js';

/**
 * Reproducible-replay harness (P7a, ADR-0028).
 *
 * Standalone-pure (ADR-0027): re-runs the decision pipeline from a stored
 * DurableBasis and proves it reproduces byte-identically. The basis is the
 * complete decision input — the prequal echo (`input`) plus `mlaCovered`
 * (ADR-0030) — so given the same catalog + config the engine MUST mint the
 * same disposition, reasons, offers, snapshot ids, and fingerprint.
 *
 * A mismatch is the signal, not an error. It localises drift to one of:
 *   • engine logic changed (a version pin moved without a basis migration),
 *   • the catalog/config supplied to replay differs from decision time
 *     (caught as a configDigest / catalogFingerprint mismatch — replay never
 *     silently "repairs" drift, it surfaces it),
 *   • the stored basis was tampered with.
 *
 * It does NOT re-encrypt, re-persist, or fire any side effect — it only
 * recomputes and compares, so it is safe to run against production bases.
 */

export interface ReplayResult {
  /** True iff every compared field AND the fingerprint reproduce exactly. */
  matches: boolean;
  /**
   * Human-readable, PII-safe field divergences. Fields derived from PII
   * (`input`, `offers`, `score`) report "differs" without echoing values.
   */
  mismatches: string[];
  /** Fingerprint of the stored basis (what was recorded). */
  expectedFingerprint: string;
  /** Fingerprint of the freshly re-derived basis (what the engine yields now). */
  actualFingerprint: string;
}

/**
 * Re-derive a decision from its stored basis and compare to the original.
 * `products` is the catalog to replay against (supply the snapshot the
 * decision was made under for a true reproduction); `config` defaults to
 * ENGINE_CONFIG_V1 and a digest mismatch is reported rather than hidden.
 */
export function replayDecision(args: {
  basis: DurableBasis;
  products: readonly CatalogProductFingerprint[];
  config?: EngineConfig;
}): ReplayResult {
  const { basis, products } = args;
  const config = args.config ?? ENGINE_CONFIG_V1;

  // The basis splits applicationId out of the prequal echo; reassemble the
  // request shape buildDurableBasis expects, field-by-field via spread of the
  // canonical input (which provably carries no applicationId).
  const request: DecideRequest = { applicationId: basis.applicationId, ...basis.input };

  const runResult = runDecision(basis.input, products, { config, mlaCovered: basis.mlaCovered });
  const aggregated = aggregateDecision(basis.input, runResult);
  const projected = projectAggregated(aggregated);

  const { basis: rebuilt, fingerprint: actualFingerprint } = buildDurableBasis({
    request,
    runResult,
    projected,
    mlaCovered: basis.mlaCovered,
    // Mirror the recorded decision time so a clock difference never shows up
    // as a spurious fingerprint mismatch — replay isolates LOGIC drift.
    decidedAtIso: basis.decidedAt,
  });

  // The stored basis re-canonicalised + hashed reproduces the fingerprint that
  // was recorded at write time (canonicalJson is deterministic).
  const expectedFingerprint = sha256Hex(canonicalJson(basis));
  const mismatches = diffBasis(basis, rebuilt);

  return {
    matches: mismatches.length === 0 && expectedFingerprint === actualFingerprint,
    mismatches,
    expectedFingerprint,
    actualFingerprint,
  };
}

/**
 * Diff every durable field, emitting a localised message per divergence.
 * PII-bearing fields are compared by value but reported WITHOUT the value
 * (PII-first) — they can only diverge under a logic/tamper fault, and a diff
 * tool must never be the thing that leaks income or FICO into a log.
 */
function diffBasis(expected: DurableBasis, actual: DurableBasis): string[] {
  const mismatches: string[] = [];
  const check = (label: string, e: unknown, a: unknown, redact = false): void => {
    const ej = canonicalJson(e);
    const aj = canonicalJson(a);
    if (ej === aj) return;
    mismatches.push(
      redact
        ? `${label}: differs (values redacted — PII)`
        : `${label}: expected ${ej}, actual ${aj}`,
    );
  };

  // Non-PII spine — safe to surface values for diagnosis.
  check('schemaVersion', expected.schemaVersion, actual.schemaVersion);
  check(
    'effectiveCatalogSnapshotId',
    expected.effectiveCatalogSnapshotId,
    actual.effectiveCatalogSnapshotId,
  );
  check('configDigest', expected.configDigest, actual.configDigest);
  check('catalogFingerprint', expected.catalogFingerprint, actual.catalogFingerprint);
  check('versions', expected.versions, actual.versions);
  check('mlaCovered', expected.mlaCovered, actual.mlaCovered);
  check('disposition', expected.disposition, actual.disposition);
  check('reasonCodes', expected.reasonCodes, actual.reasonCodes);
  check('incompleteFields', expected.incompleteFields, actual.incompleteFields);

  // PII-derived — compared, but values redacted in the message.
  check('input', expected.input, actual.input, true);
  check('offers', expected.offers, actual.offers, true);
  check('score', expected.score, actual.score, true);

  return mismatches;
}
