import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@eazepay/shared-utils';
import {
  aggregateDecision,
  assertAuditSafe,
  buildAuditOutboxRow,
  buildDurableBasis,
  canonicalJson,
  deriveIdempotencyKey,
  persistDecision,
  projectAggregated,
  retentionFor,
  runDecision,
  BASIS_SCHEMA_VERSION,
  DecisionPersistenceError,
  IdentityBasisCipher,
  InMemoryDecisionRepository,
  type AggregatedDecision,
  type CanonicalPrequal,
  type CatalogProductFingerprint,
  type DecideRequest,
  type IncludedLender,
  type PersistDecisionDeps,
  type PersistDecisionInput,
} from '../src/decision/engine/index.js';

/**
 * P6 — pure persistence core (ADR-0033). Entirely DB-free: the
 * DecisionRepositoryPort and BasisCipherPort are exercised through the
 * in-memory doubles, and the clock + id factory are injected, so every
 * assertion is deterministic and no `@prisma/client` is touched.
 */

// ---- Fixtures --------------------------------------------------------------

/** Baseline applicant: tier B, TX, direct, $10,000, income $96k. */
const prequal: CanonicalPrequal = {
  tier: 'B',
  ficoBand: 720,
  dti: 0.32,
  openTradelines: 6,
  amountCents: 1_000_000,
  annualIncomeCents: 9_600_000,
  state: 'TX',
  brand: 'direct',
};
const request: DecideRequest = { applicationId: 'app_123', ...prequal };

const baseProduct: CatalogProductFingerprint = {
  lenderProductId: 'lp_base',
  lenderId: 'l_base',
  tier: 'B',
  minAmountCents: '50000',
  maxAmountCents: '2000000',
  minTermMonths: 3,
  maxTermMonths: 60,
  permittedStates: ['TX', 'CA'],
  permittedBrands: [],
  enabled: true,
  priority: 10,
};
const mk = (o: Partial<CatalogProductFingerprint>): CatalogProductFingerprint => ({
  ...baseProduct,
  ...o,
});

const included1 = mk({ lenderProductId: 'lp_b1', lenderId: 'l_b1', priority: 10 });
const included2 = mk({ lenderProductId: 'lp_b2', lenderId: 'l_b2', priority: 5 });
/** Permitted in CA/NY only — a TX applicant is a GEOGRAPHY knockout (adverse). */
const stateMiss = mk({ lenderProductId: 'lp_st', lenderId: 'l_st', permittedStates: ['CA', 'NY'] });

const offersRun = runDecision(prequal, [included1, included2]);
const offersAggregated = aggregateDecision(prequal, offersRun);

const FIXED_NOW = '2026-06-01T00:00:00.000Z';

interface Harness {
  repo: InMemoryDecisionRepository;
  cipher: IdentityBasisCipher;
  deps: PersistDecisionDeps;
  /** Number of times newId() has been called. */
  idCalls: () => number;
}

function harness(): Harness {
  const repo = new InMemoryDecisionRepository();
  const cipher = new IdentityBasisCipher();
  let n = 0;
  const deps: PersistDecisionDeps = {
    repository: repo,
    cipher,
    now: () => new Date(FIXED_NOW),
    newId: () => `dec_${++n}`,
  };
  return { repo, cipher, deps, idCalls: () => n };
}

const offersInput: PersistDecisionInput = {
  request,
  runResult: offersRun,
  aggregated: offersAggregated,
};

function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`expected ${what} to be present`);
  return value;
}

// ---- deriveIdempotencyKey --------------------------------------------------

describe('deriveIdempotencyKey', () => {
  it('is applicationId:sha256(canonical request) and is stable', () => {
    const a = deriveIdempotencyKey(request);
    const b = deriveIdempotencyKey({ ...request });
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.idempotencyKey.startsWith('app_123:')).toBe(true);
    expect(a.inputsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.idempotencyKey).toBe(`app_123:${a.inputsHash}`);
  });

  it('mints a different key when any input changes', () => {
    const base = deriveIdempotencyKey(request);
    expect(
      deriveIdempotencyKey({ ...request, annualIncomeCents: 5_000_000 }).idempotencyKey,
    ).not.toBe(base.idempotencyKey);
    expect(deriveIdempotencyKey({ ...request, applicationId: 'app_999' }).idempotencyKey).not.toBe(
      base.idempotencyKey,
    );
  });
});

// ---- canonicalJson ---------------------------------------------------------

describe('canonicalJson', () => {
  it('sorts keys at every depth, order-independently', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson({ arr: [{ y: 1, x: 2 }] })).toBe('{"arr":[{"x":2,"y":1}]}');
  });

  it('serialises a Date to ISO-8601 (the deliberate divergence from stableJsonSha256)', () => {
    expect(canonicalJson({ d: new Date(FIXED_NOW) })).toBe(`{"d":"${FIXED_NOW}"}`);
    // The bug it routes around: stableJsonSha256 would mangle a Date to {}.
    expect(canonicalJson({ d: new Date(FIXED_NOW) })).not.toBe('{"d":{}}');
  });

  it('drops undefined-valued keys, like JSON.stringify', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

// ---- retentionFor ----------------------------------------------------------

describe('retentionFor', () => {
  it('is +14 days for offers and +25 months for the basis floor', () => {
    const now = new Date(FIXED_NOW);
    const { offersValidUntil, retainUntil } = retentionFor(now);
    expect(offersValidUntil.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(retainUntil.toISOString()).toBe('2028-07-01T00:00:00.000Z');
    // Does not mutate its argument.
    expect(now.toISOString()).toBe(FIXED_NOW);
  });
});

// ---- projectAggregated -----------------------------------------------------

describe('projectAggregated', () => {
  const offer: IncludedLender = {
    included: true,
    lenderId: 'l',
    displayName: 'l',
    propensityScore: 50,
    rank: 1,
    estimatedAprBps: 1000,
    estimatedMaxCents: 1000,
  };

  it('OFFERS → offers + count, no reasons', () => {
    const agg: AggregatedDecision = { disposition: 'OFFERS', offers: [offer] };
    const p = projectAggregated(agg);
    expect(p.disposition).toBe('OFFERS');
    expect(p.offerCount).toBe(1);
    expect(p.offers).toHaveLength(1);
    expect(p.reasonCodes).toEqual([]);
    expect(p.incompleteFields).toEqual([]);
  });

  it('ADVERSE_ACTION → reasons, zero offers', () => {
    const p = projectAggregated({ disposition: 'ADVERSE_ACTION', reasonCodes: ['GEOGRAPHY'] });
    expect(p.reasonCodes).toEqual(['GEOGRAPHY']);
    expect(p.offerCount).toBe(0);
    expect(p.offers).toEqual([]);
  });

  it('INCOMPLETE → incomplete fields', () => {
    const p = projectAggregated({
      disposition: 'INCOMPLETE',
      incompleteFields: ['annualIncomeCents'],
    });
    expect(p.incompleteFields).toEqual(['annualIncomeCents']);
    expect(p.offerCount).toBe(0);
  });

  it('NO_OFFER → everything empty', () => {
    const p = projectAggregated({ disposition: 'NO_OFFER' });
    expect(p.offerCount).toBe(0);
    expect(p.reasonCodes).toEqual([]);
    expect(p.incompleteFields).toEqual([]);
    expect(p.offers).toEqual([]);
  });
});

// ---- buildDurableBasis -----------------------------------------------------

describe('buildDurableBasis', () => {
  const projected = projectAggregated(offersAggregated);
  const build = (req: DecideRequest) =>
    buildDurableBasis({ request: req, runResult: offersRun, projected, decidedAtIso: FIXED_NOW });

  it('fingerprint = sha256(plaintext) and is stable for identical inputs', () => {
    const a = build(request);
    const b = build({ ...request });
    expect(a.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(a.fingerprint).toBe(sha256Hex(a.plaintext));
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('carries the PII prequal echo + §615(a) factors in the plaintext', () => {
    const { plaintext, basis } = build(request);
    expect(basis.schemaVersion).toBe(BASIS_SCHEMA_VERSION);
    const parsed = JSON.parse(plaintext) as typeof basis;
    expect(parsed.input.annualIncomeCents).toBe(9_600_000);
    expect(parsed.input.ficoBand).toBe(720);
    expect(parsed.score.factors.length).toBeGreaterThan(0);
    // The basis never echoes the applicationId into the input block.
    expect(parsed.input).not.toHaveProperty('applicationId');
  });

  it('changes the fingerprint when an echoed input changes', () => {
    expect(build({ ...request, annualIncomeCents: 5_000_000 }).fingerprint).not.toBe(
      build(request).fingerprint,
    );
  });
});

// ---- assertAuditSafe + buildAuditOutboxRow ---------------------------------

describe('assertAuditSafe', () => {
  it('throws on a banned key at any depth', () => {
    expect(() => assertAuditSafe({ ssn: '1' })).toThrow(/forbidden_field/);
    expect(() => assertAuditSafe({ nested: { homeAddress: 'x' } })).toThrow(/nested\.homeAddress/);
    expect(() => assertAuditSafe({ arr: [{ email: 'x' }] })).toThrow(/arr\[0\]\.email/);
  });

  it('passes a PII-free payload', () => {
    expect(() =>
      assertAuditSafe({ decisionId: 'x', reasonCodes: ['GEOGRAPHY'], offerCount: 2 }),
    ).not.toThrow();
  });
});

describe('buildAuditOutboxRow', () => {
  it('is a system actor targeting the application, PII-free', () => {
    const row = buildAuditOutboxRow({
      decisionId: 'dec_1',
      applicationId: 'app_123',
      idempotencyKey: 'k',
      disposition: 'OFFERS',
      reasonCodes: [],
      offerCount: 2,
      versions: offersRun.snapshot.versions,
      basisFingerprint: 'fp',
    });
    expect(row.actorType).toBe('system');
    expect(row.actorId).toBeNull();
    expect(row.action).toBe('decision.offers');
    expect(row.targetType).toBe('Application');
    expect(row.targetId).toBe('app_123');
    expect(row.after.basisFingerprint).toBe('fp');
    expect(JSON.stringify(row)).not.toMatch(/annualIncome|ficoBand|"input"|"ssn"/i);
  });
});

// ---- persistDecision: happy path ------------------------------------------

describe('persistDecision — atomic write', () => {
  it('writes record + basis + audit + idempotency exactly once', async () => {
    const { repo, deps } = harness();
    const result = await persistDecision(offersInput, deps);

    expect(result.replayed).toBe(false);
    expect(result.decisionId).toBe('dec_1');
    expect(result.disposition).toBe('OFFERS');
    expect(result.response).toBe(offersRun.response);

    expect(repo.size).toBe(1);
    expect(repo.audit).toHaveLength(1);
    expect(repo.getRecord('dec_1')).toBeDefined();
    expect(repo.getBasis('dec_1')).toBeDefined();
  });

  it('keeps the record + audit free of plaintext PII field names', async () => {
    const { repo, deps } = harness();
    await persistDecision(offersInput, deps);
    const recordJson = JSON.stringify(repo.getRecord('dec_1'));
    const auditJson = JSON.stringify(repo.audit[0]);
    const pii = /annualIncomeCents|ficoBand|"dti"|openTradelines|"input"/;
    expect(recordJson).not.toMatch(pii);
    expect(auditJson).not.toMatch(pii);
  });

  it('stores the basis as opaque ciphertext that decrypts to the PII basis', async () => {
    const { repo, cipher, deps } = harness();
    await persistDecision(offersInput, deps);
    const basisRow = must(repo.getBasis('dec_1'), 'basis');
    const { idempotencyKey } = deriveIdempotencyKey(request);

    expect(basisRow.ciphertext).not.toContain('annualIncomeCents');
    const plaintext = await cipher.open(basisRow.ciphertext, {
      entity: 'decision_basis',
      applicationId: 'app_123',
      idempotencyKey,
    });
    expect(basisRow.fingerprint).toBe(sha256Hex(plaintext));
    const parsed = JSON.parse(plaintext) as { input: CanonicalPrequal };
    expect(parsed.input.annualIncomeCents).toBe(9_600_000);
    expect(parsed.input.ficoBand).toBe(720);
  });

  it('binds the fingerprint across record, basis, and audit', async () => {
    const { repo, deps } = harness();
    await persistDecision(offersInput, deps);
    const record = must(repo.getRecord('dec_1'), 'record');
    const basisRow = must(repo.getBasis('dec_1'), 'basis');
    expect(record.basisFingerprint).toBe(basisRow.fingerprint);
    expect(repo.audit[0].after.basisFingerprint).toBe(record.basisFingerprint);
  });

  it('applies dual retention: 14d offers, 25mo basis floor on record + basis', async () => {
    const { repo, deps } = harness();
    await persistDecision(offersInput, deps);
    const record = must(repo.getRecord('dec_1'), 'record');
    const basisRow = must(repo.getBasis('dec_1'), 'basis');
    expect(record.decidedAt.toISOString()).toBe(FIXED_NOW);
    expect(record.offersValidUntil.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(record.retainUntil.toISOString()).toBe('2028-07-01T00:00:00.000Z');
    expect(basisRow.retainUntil.toISOString()).toBe('2028-07-01T00:00:00.000Z');
  });

  it('records an ADVERSE_ACTION decision with ordered Reg B reason codes', async () => {
    const { repo, deps } = harness();
    const run = runDecision(prequal, [stateMiss]);
    const aggregated = aggregateDecision(prequal, run);
    expect(aggregated.disposition).toBe('ADVERSE_ACTION');

    await persistDecision({ request, runResult: run, aggregated }, deps);
    const record = must(repo.getRecord('dec_1'), 'record');
    expect(record.disposition).toBe('ADVERSE_ACTION');
    expect(record.reasonCodes).toEqual(['GEOGRAPHY']);
    expect(record.offerCount).toBe(0);
    expect(repo.audit[0].action).toBe('decision.adverse_action');
  });
});

// ---- persistDecision: idempotent replay -----------------------------------

describe('persistDecision — replay', () => {
  it('replays a prior decision without a second write', async () => {
    const { repo, deps, idCalls } = harness();
    const first = await persistDecision(offersInput, deps);
    const second = await persistDecision(offersInput, deps);

    expect(second.replayed).toBe(true);
    expect(second.decisionId).toBe(first.decisionId);
    expect(second.disposition).toBe(first.disposition);
    expect(second.response).toEqual(first.response);
    expect(repo.size).toBe(1);
    expect(idCalls()).toBe(1); // newId minted once — no second decisionId
  });
});

// ---- persistDecision: dead-letter on failure ------------------------------

describe('persistDecision — dead-letter', () => {
  it('encrypts the bundle and rethrows DecisionPersistenceError on write failure', async () => {
    const { repo, cipher, deps } = harness();
    const dbErr = new Error('db_down');
    repo.persistShouldThrow = dbErr;

    let caught: unknown;
    try {
      await persistDecision(offersInput, deps);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DecisionPersistenceError);
    expect((caught as DecisionPersistenceError).message).toBe('decision_durable_write_failed');
    expect((caught as { cause?: unknown }).cause).toBe(dbErr);

    // All-or-nothing: nothing committed.
    expect(repo.size).toBe(0);
    expect(repo.getRecord('dec_1')).toBeUndefined();

    // One encrypted dead-letter, PII-free, retained at the 25mo floor.
    expect(repo.deadLetters).toHaveLength(1);
    const dlq = repo.deadLetters[0];
    const { idempotencyKey } = deriveIdempotencyKey(request);
    expect(dlq.idempotencyKey).toBe(idempotencyKey);
    expect(dlq.applicationId).toBe('app_123');
    expect(dlq.failureReason).toBe('durable_write_failed');
    expect(dlq.retainUntil.toISOString()).toBe('2028-07-01T00:00:00.000Z');
    expect(dlq.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(dlq.ciphertext).not.toContain('annualIncomeCents');

    const bundle = await cipher.open(dlq.ciphertext, {
      entity: 'decision_dlq',
      applicationId: 'app_123',
      idempotencyKey,
    });
    // The basis inside the bundle is itself sealed, so no PII field names leak.
    expect(bundle).not.toMatch(/annualIncomeCents|ficoBand/);
  });

  it('still rethrows the ORIGINAL cause when the dead-letter also fails', async () => {
    const { repo, deps } = harness();
    const persistErr = new Error('db_down_persist');
    repo.persistShouldThrow = persistErr;
    repo.dlqShouldThrow = new Error('db_down_dlq');

    let caught: unknown;
    try {
      await persistDecision(offersInput, deps);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(DecisionPersistenceError);
    expect((caught as { cause?: unknown }).cause).toBe(persistErr); // not the DLQ error
    expect(repo.size).toBe(0);
    expect(repo.deadLetters).toHaveLength(0);
  });
});
