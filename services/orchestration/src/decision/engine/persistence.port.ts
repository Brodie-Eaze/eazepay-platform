import type { RegBReasonCode } from './reason-codes.js';
import type { EngineVersionPins } from './decision-engine.port.js';
import type { DecideResponse } from './wire.js';
import type { DecisionDisposition } from './aggregate.js';

/**
 * Decision persistence ports + payload types (P6, ADR-0033).
 *
 * The pure persistence core (persistence.ts) orchestrates an idempotent,
 * same-transaction durable write through two seams so the engine stays
 * standalone (ADR-0027): it imports NO `@prisma/client` and NO sibling
 * service. The Prisma binding + migration land in P7 with the handler.
 *
 *   • DecisionRepositoryPort — the atomic data-access seam. `persist` writes
 *     DecisionRecord + DecisionBasis + AuditOutbox + IdempotencyRecord as
 *     ALL-OR-NOTHING; `findByIdempotencyKey` is the ADR-0015 replay reader;
 *     `deadLetter` is the best-effort encrypted dead-letter on write failure.
 *   • BasisCipherPort — envelope encryption for the §615(a) basis (and the
 *     DLQ bundle). Prod binds to PiiVaultService.sealOpaque; tests use an
 *     identity cipher. Plaintext NEVER hits the repository.
 */

/** DI token — bind to the Prisma-backed repository in P7. */
export const DECISION_REPOSITORY_PORT = Symbol.for('eazepay.decision.repository');

/** DI token — bind to a PiiVaultService-backed cipher in P7. */
export const BASIS_CIPHER_PORT = Symbol.for('eazepay.decision.basisCipher');

/** Additional-authenticated-data context, mirroring PiiVaultService.sealOpaque. */
export type AadContext = Record<string, string>;

/**
 * Envelope encryption for the durable basis. `seal` is the only method the
 * write path needs; `open` exists for the reconcile tool + round-trip tests.
 * AAD binds ciphertext to the decision so it cannot be replayed under another.
 */
export interface BasisCipherPort {
  seal(plaintext: string, aad: AadContext): Promise<string>;
  open(ciphertext: string, aad: AadContext): Promise<string>;
}

/**
 * The PII-free queryable spine row (→ DecisionRecord). `id` is the decisionId,
 * minted by the pure core via an injected id factory so the audit row can
 * reference it deterministically within the same write.
 */
export interface DecisionRecordRow {
  id: string;
  applicationId: string;
  merchantId: string | null;
  idempotencyKey: string;
  disposition: DecisionDisposition;
  reasonCodes: RegBReasonCode[];
  offerCount: number;
  policyVersion: string;
  ruleVersion: string;
  scorerVersion: string;
  effectiveCatalogSnapshotId: string;
  basisFingerprint: string;
  offersValidUntil: Date;
  retainUntil: Date;
  decidedAt: Date;
}

/** The encrypted §615(a) basis row (→ DecisionBasis). Ciphertext only. */
export interface DecisionBasisRow {
  decisionId: string;
  ciphertext: string;
  fingerprint: string;
  inputsHash: string;
  schemaVersion: number;
  retainUntil: Date;
}

/**
 * PII-free `after` payload for the audit row. Every key here is deliberately
 * safe under the SEC-040 banned-key regex; `assertAuditSafe` re-checks at
 * construction (ADR-0033 defense-in-depth).
 */
export interface AuditDecisionAfter {
  decisionId: string;
  idempotencyKey: string;
  disposition: DecisionDisposition;
  reasonCodes: RegBReasonCode[];
  offerCount: number;
  versions: EngineVersionPins;
  basisFingerprint: string;
}

/** The same-txn audit outbox row (→ AuditOutbox, ADR-0011). No raw PII. */
export interface AuditOutboxRow {
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  after: AuditDecisionAfter;
}

/** The idempotency backstop row (→ IdempotencyRecord, ADR-0015). */
export interface IdempotencyRow {
  key: string;
  method: string;
  path: string;
  requestHash: string;
  responseCode: number;
  /** The wire response — lender-side data + scores, never consumer PII. */
  responseBody: DecideResponse;
}

/** The four rows written atomically for one decision. */
export interface DurableDecisionWrite {
  record: DecisionRecordRow;
  basis: DecisionBasisRow;
  audit: AuditOutboxRow;
  idempotency: IdempotencyRow;
}

/** The encrypted dead-letter row (→ DecisionDlq). Ciphertext only. */
export interface DecisionDlqWrite {
  idempotencyKey: string;
  applicationId: string | null;
  ciphertext: string;
  fingerprint: string;
  failureReason: string;
  retainUntil: Date;
}

/** What a stored decision projects to — the replay payload, sans liveness flag. */
export interface StoredDecision {
  decisionId: string;
  idempotencyKey: string;
  disposition: DecisionDisposition;
  response: DecideResponse;
}

/** The result of persistDecision — `replayed` distinguishes a fresh write. */
export interface PersistedDecision extends StoredDecision {
  replayed: boolean;
}

/**
 * The atomic data-access seam (ADR-0033). Implemented by an in-memory adapter
 * (P6) and a Prisma adapter (P7). `persist` MUST be all-or-nothing: a throw
 * means nothing was written, so dead-letter-then-retry never double-writes.
 */
export interface DecisionRepositoryPort {
  findByIdempotencyKey(idempotencyKey: string): Promise<StoredDecision | null>;
  persist(write: DurableDecisionWrite): Promise<void>;
  deadLetter(entry: DecisionDlqWrite): Promise<void>;
}

/**
 * Raised when the durable write fails. The original cause is attached; the
 * caller (P7 handler) maps this to a 5xx so the client retries under the same
 * derived idempotency key — fail-closed, retry-safe (ADR-0033).
 */
export class DecisionPersistenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DecisionPersistenceError';
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
