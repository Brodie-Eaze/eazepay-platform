import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { PRISMA } from '../internal/tokens.js';
import {
  DECISION_REPOSITORY_PORT,
  type DecisionBasisRow,
  type DecisionDlqWrite,
  type DecisionRecordRow,
  type DurableDecisionWrite,
  type StoredDecision,
} from './engine/persistence.port.js';
import type { DecideResponse } from './engine/wire.js';

/**
 * Prisma-backed DecisionRepositoryPort (P7b, ADR-0033).
 *
 * All writes use raw SQL (`Prisma.sql` tagged templates / `$executeRaw`) so
 * this adapter compiles against the shared `@prisma/client` without needing
 * generated `DecisionRecord` / `DecisionBasis` / `DecisionDlq` model types —
 * those require `prisma generate` to be re-run with the feature-branch schema,
 * which is incompatible with the pnpm virtual-store constraint in CI until the
 * branch merges and generate runs from main.
 *
 * The four writes in `persist()` are wrapped in a single interactive
 * transaction so they are ALL-OR-NOTHING: decision_records, decision_bases,
 * audit_outbox, idempotency_records. If the transaction rolls back the caller
 * receives the thrown error, dead-letters the already-encrypted basis, and
 * retries under the same derived idempotency key (fail-closed, retry-safe).
 *
 * Exported token re-export: callers importing the port symbol use
 * DECISION_REPOSITORY_PORT from persistence.port.ts; this module re-exports
 * it so the module wiring file has a single import site.
 */
export { DECISION_REPOSITORY_PORT };

@Injectable()
export class DecisionPrismaRepository {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Return the stored decision for a prior run under this key, or null when
   * the key is new. The response body is read from idempotency_records (where
   * it was persisted as JSONB) so replay is wire-identical.
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<StoredDecision | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        idempotency_key: string;
        disposition: string;
        response_body: unknown;
      }>
    >(Prisma.sql`
      SELECT dr.id,
             dr.idempotency_key,
             dr.disposition,
             ir.response_body
        FROM decision_records    dr
        JOIN idempotency_records ir ON ir.key = dr.idempotency_key
       WHERE dr.idempotency_key = ${idempotencyKey}
       LIMIT 1
    `);

    if (rows.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = rows[0]!; // length > 0 guaranteed by guard above
    return {
      decisionId: row.id,
      idempotencyKey: row.idempotency_key,
      disposition: row.disposition as StoredDecision['disposition'],
      response: row.response_body as DecideResponse,
    };
  }

  /**
   * Atomically write all four rows that constitute one durable decision:
   *   1. decision_records   — queryable spine, no PII
   *   2. decision_bases     — encrypted §615(a) basis
   *   3. audit_outbox       — PII-free event for the audit chain (ADR-0011)
   *   4. idempotency_records — stores the wire response for replay
   *
   * The four inserts are a single $transaction so either all succeed or all
   * roll back. The caller is responsible for catching the error and dead-
   * lettering before rethrowing DecisionPersistenceError.
   */
  async persist(write: DurableDecisionWrite): Promise<void> {
    const { record, basis, audit, idempotency } = write;

    await this.prisma.$transaction(async (tx) => {
      await insertRecord(tx as PrismaClient, record);
      await insertBasis(tx as PrismaClient, basis, record.id);
      await insertAuditOutbox(tx as PrismaClient, audit);
      await insertIdempotency(tx as PrismaClient, idempotency, record.offersValidUntil);
    });
  }

  /**
   * Best-effort dead-letter insert (ADR-0033). Called by `safeDeadLetter` in
   * persistence.ts AFTER the main transaction has already failed — this runs
   * outside any transaction so a hard-down DB simply swallows the error.
   */
  async deadLetter(entry: DecisionDlqWrite): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO decision_dlq (
        idempotency_key,
        application_id,
        ciphertext,
        fingerprint,
        failure_reason,
        retain_until
      ) VALUES (
        ${entry.idempotencyKey},
        ${entry.applicationId ?? null}::uuid,
        ${entry.ciphertext},
        ${entry.fingerprint},
        ${entry.failureReason},
        ${entry.retainUntil}
      )
    `;
  }
}

// ─── private helpers ──────────────────────────────────────────────────────────

async function insertRecord(tx: PrismaClient, r: DecisionRecordRow): Promise<void> {
  // reason_codes is TEXT[]. We serialise as a PostgreSQL array literal so the
  // raw-parameter binding round-trips cleanly through the pg driver.
  const reasonCodesLiteral = Prisma.raw(
    `ARRAY[${r.reasonCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(',')}]::TEXT[]`,
  );

  await tx.$executeRaw`
    INSERT INTO decision_records (
      id,
      application_id,
      merchant_id,
      idempotency_key,
      disposition,
      reason_codes,
      offer_count,
      policy_version,
      rule_version,
      scorer_version,
      effective_catalog_snapshot_id,
      basis_fingerprint,
      offers_valid_until,
      retain_until,
      decided_at
    ) VALUES (
      ${r.id}::uuid,
      ${r.applicationId}::uuid,
      ${r.merchantId ?? null}::uuid,
      ${r.idempotencyKey},
      ${r.disposition}::"DecisionDisposition",
      ${reasonCodesLiteral},
      ${r.offerCount},
      ${r.policyVersion},
      ${r.ruleVersion},
      ${r.scorerVersion},
      ${r.effectiveCatalogSnapshotId},
      ${r.basisFingerprint},
      ${r.offersValidUntil},
      ${r.retainUntil},
      ${r.decidedAt}
    )
  `;
}

async function insertBasis(
  tx: PrismaClient,
  b: DecisionBasisRow,
  decisionId: string,
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO decision_bases (
      decision_id,
      ciphertext,
      fingerprint,
      inputs_hash,
      schema_version,
      retain_until
    ) VALUES (
      ${decisionId}::uuid,
      ${b.ciphertext},
      ${b.fingerprint},
      ${b.inputsHash},
      ${b.schemaVersion},
      ${b.retainUntil}
    )
  `;
}

async function insertAuditOutbox(
  tx: PrismaClient,
  audit: DurableDecisionWrite['audit'],
): Promise<void> {
  // after is serialised to JSONB. Prisma raw handles the cast via ::jsonb.
  const afterJson = JSON.stringify(audit.after);

  await tx.$executeRaw`
    INSERT INTO audit_outbox (
      actor_type,
      actor_id,
      action,
      target_type,
      target_id,
      after
    ) VALUES (
      ${audit.actorType},
      ${audit.actorId ?? null},
      ${audit.action},
      ${audit.targetType},
      ${audit.targetId},
      ${afterJson}::jsonb
    )
  `;
}

async function insertIdempotency(
  tx: PrismaClient,
  ir: DurableDecisionWrite['idempotency'],
  offersValidUntil: Date,
): Promise<void> {
  // The IdempotencyRow port does not carry userId or expiresAt — the adapter
  // adds them: userId is null for system-issued decisions (no user context in
  // World A prequal), expiresAt mirrors offersValidUntil (14 days, ADR-0030).
  const responseBodyJson = JSON.stringify(ir.responseBody);

  await tx.$executeRaw`
    INSERT INTO idempotency_records (
      key,
      user_id,
      method,
      path,
      request_hash,
      response_code,
      response_body,
      expires_at
    ) VALUES (
      ${ir.key},
      ${null}::uuid,
      ${ir.method},
      ${ir.path},
      ${ir.requestHash},
      ${ir.responseCode},
      ${responseBodyJson}::jsonb,
      ${offersValidUntil}
    )
  `;
}
