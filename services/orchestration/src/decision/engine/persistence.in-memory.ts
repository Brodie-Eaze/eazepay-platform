import type {
  AadContext,
  AuditOutboxRow,
  BasisCipherPort,
  DecisionBasisRow,
  DecisionDlqWrite,
  DecisionRecordRow,
  DecisionRepositoryPort,
  DurableDecisionWrite,
  IdempotencyRow,
  StoredDecision,
} from './persistence.port.js';

/**
 * In-memory test + shadow doubles for the persistence ports (P6, ADR-0033).
 *
 * These are the DB-free counterparts to the Prisma adapter + PiiVaultService
 * cipher that bind in P7. They let the pure core (persistence.ts) be tested
 * end-to-end with no database and no `@prisma/client`, keeping the engine
 * standalone (ADR-0027). They mirror the `InMemoryCatalogSource` pattern.
 */

/**
 * An atomic in-memory DecisionRepositoryPort. `persist` is all-or-nothing:
 * the failure hooks throw BEFORE any map is touched, so a throw leaves the
 * store untouched — exactly the contract the Prisma adapter must honour, and
 * what makes "dead-letter then retry never double-writes" safe to test.
 *
 * Failure hooks (`persistShouldThrow` / `dlqShouldThrow`) accept a boolean or
 * a specific Error, so a test can assert the rethrown DecisionPersistenceError
 * carries the original cause.
 */
export class InMemoryDecisionRepository implements DecisionRepositoryPort {
  persistShouldThrow: boolean | Error = false;
  dlqShouldThrow: boolean | Error = false;

  private readonly records = new Map<string, DecisionRecordRow>();
  private readonly bases = new Map<string, DecisionBasisRow>();
  private readonly idempotency = new Map<string, StoredDecision>();
  private readonly auditRows: AuditOutboxRow[] = [];
  private readonly dlqRows: DecisionDlqWrite[] = [];

  findByIdempotencyKey(idempotencyKey: string): Promise<StoredDecision | null> {
    return Promise.resolve(this.idempotency.get(idempotencyKey) ?? null);
  }

  persist(write: DurableDecisionWrite): Promise<void> {
    if (this.persistShouldThrow) {
      return Promise.reject(asError(this.persistShouldThrow, 'in_memory_persist_failed'));
    }
    // Commit only after the guard, so a throw writes nothing (atomic).
    this.records.set(write.record.id, { ...write.record });
    this.bases.set(write.basis.decisionId, { ...write.basis });
    this.auditRows.push({ ...write.audit });
    this.idempotency.set(write.idempotency.key, storedFrom(write.record, write.idempotency));
    return Promise.resolve();
  }

  deadLetter(entry: DecisionDlqWrite): Promise<void> {
    if (this.dlqShouldThrow) {
      return Promise.reject(asError(this.dlqShouldThrow, 'in_memory_dlq_failed'));
    }
    this.dlqRows.push({ ...entry });
    return Promise.resolve();
  }

  // ---- Inspection helpers (tests only; not part of the port) -------------

  getRecord(decisionId: string): DecisionRecordRow | undefined {
    return this.records.get(decisionId);
  }

  getBasis(decisionId: string): DecisionBasisRow | undefined {
    return this.bases.get(decisionId);
  }

  get audit(): readonly AuditOutboxRow[] {
    return this.auditRows;
  }

  get deadLetters(): readonly DecisionDlqWrite[] {
    return this.dlqRows;
  }

  /** Number of durably-committed decisions (idempotency rows). */
  get size(): number {
    return this.idempotency.size;
  }
}

function storedFrom(record: DecisionRecordRow, idempotency: IdempotencyRow): StoredDecision {
  return {
    decisionId: record.id,
    idempotencyKey: record.idempotencyKey,
    disposition: record.disposition,
    response: idempotency.responseBody,
  };
}

function asError(hook: boolean | Error, fallbackMessage: string): Error {
  return hook instanceof Error ? hook : new Error(fallbackMessage);
}

/**
 * Identity cipher for tests — base64 of an AAD-bound envelope. It is NOT
 * encryption; it stands in for PiiVaultService.sealOpaque so the core can be
 * exercised without KMS. The envelope binds the AAD so `open` rejects a
 * ciphertext presented under a different context, mirroring the real seal's
 * additional-authenticated-data guarantee. Ciphertext is never equal to the
 * plaintext, so a test can prove the record/audit hold no plaintext PII.
 */
export class IdentityBasisCipher implements BasisCipherPort {
  seal(plaintext: string, aad: AadContext): Promise<string> {
    const envelope = JSON.stringify({ aad: canonicalAad(aad), data: plaintext });
    return Promise.resolve(Buffer.from(envelope, 'utf8').toString('base64'));
  }

  open(ciphertext: string, aad: AadContext): Promise<string> {
    const decoded = Buffer.from(ciphertext, 'base64').toString('utf8');
    const envelope = JSON.parse(decoded) as { aad: string; data: string };
    if (envelope.aad !== canonicalAad(aad)) {
      throw new Error('basis_cipher_aad_mismatch');
    }
    return Promise.resolve(envelope.data);
  }
}

/** Order-independent AAD serialisation, so seal/open agree regardless of key order. */
function canonicalAad(aad: AadContext): string {
  return JSON.stringify(
    Object.keys(aad)
      .sort()
      .map((key) => [key, aad[key]]),
  );
}
