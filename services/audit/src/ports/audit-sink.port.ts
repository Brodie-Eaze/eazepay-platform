/**
 * Append-only sink for the drained AuditOutbox. Production target:
 * DynamoDB (hot, 90d) + S3 with Object Lock (cold, retained per
 * record class) — both write-once. The sink computes a hash chain
 * across rows so tampering is detectable.
 *
 * Hash chain rule:
 *   row.hash = SHA-256(prev.hash || canonicalJson(row))
 * The first row's prev.hash is the all-zero hash (`00..00`). The
 * sink is responsible for retrieving prev.hash for the chain it
 * owns; callers pass the canonical row content only.
 */
export interface AuditSinkRecord {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string; // ISO datetime
}

export interface AuditSinkPutResult {
  /** SHA-256 of (prevHash || canonicalJson(row)) — the chained hash. */
  hash: string;
  /** SHA-256 of canonicalJson(row) alone — record-level integrity. */
  contentHash: string;
}

export interface AuditSink {
  readonly storage: string;
  put(record: AuditSinkRecord): Promise<AuditSinkPutResult>;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');
