/**
 * AuditSink — port for the immutable, hash-chained audit archive.
 *
 * WHY THIS LIVES IN integrations-core (NOT services/audit)
 * --------------------------------------------------------
 * The drain in `services/audit` already owns a sink port
 * (`AuditSink` in `services/audit/src/ports/audit-sink.port.ts`)
 * shaped for its `put(record)` flow. THAT port is the drain's
 * contract: it computes the hash chain inside the adapter and
 * returns the resulting hash for the drain to persist.
 *
 * THIS port describes the cold archive on the OTHER side of the
 * drain — the WORM (write-once / read-many) layer the chain
 * verifier reads back during regulatory exams. The adapter
 * receives a fully-formed `AuditRow` (the drain has already
 * computed the chain hash), persists it once, and exposes a
 * `read()` + `verifyDay()` pair so an out-of-band verifier can
 * replay the chain without going through the live drain path.
 *
 * Splitting the port lets the AWS adapter live alongside the
 * Azure / GCS adapters we'll add for parity (BSA 31 CFR 1010.430
 * requires a second jurisdiction for the seven-year retention
 * window), without pulling a NestJS / Prisma dependency into
 * integrations-core.
 *
 * HASH CHAIN RULE
 * ---------------
 *   row.hash = sha256(prevHash || canonicalJson(row.payload))
 *
 * The first row's `prevHash` is the all-zero hex string. Chain
 * heads are owned by whoever WRITES the row; the WORM adapter
 * persists what it is given and re-computes during
 * `verifyDay()` to detect tampering after the fact.
 */

export interface AuditRow {
  /** Stable per-row id (uuid). Used as the WORM key fragment so a
   *  scan reveals the originating row without parsing the body. */
  readonly id: string;
  /** Hex SHA-256 of the previous row in the chain. All-zeros for
   *  the first row of the chain. */
  readonly prevHash: string;
  /** Hex SHA-256 of `prevHash || canonicalJson(payload)`. The
   *  adapter MUST NOT recompute this on write; the chain head is
   *  the writer's responsibility. */
  readonly hash: string;
  /** Caller-owned payload object. Hashed in canonical (sorted-key)
   *  JSON form for chain stability. */
  readonly payload: Record<string, unknown>;
  /** ISO-8601 UTC instant the row was emitted by the writer. The
   *  WORM adapter uses this to derive the partition key — DO NOT
   *  rely on server-side clock for partitioning. */
  readonly writtenAt: string;
}

export interface AuditSinkAppendResult {
  /** S3 (or vendor-equivalent) ETag of the persisted object.
   *  Surfaced in the drain audit log as evidence the write reached
   *  the WORM tier. */
  readonly etag: string;
  /** Vendor-specific version id (S3 versioning). Optional because
   *  not every backing store exposes versions. */
  readonly versionId?: string;
}

/**
 * A single break in the hash chain detected by `verifyDay()`.
 * Surfaces the offending row + both the expected and observed
 * hashes so the on-call can correlate against the drain's emit
 * trail.
 */
export interface ChainBreak {
  readonly rowId: string;
  readonly expectedHash: string;
  readonly observedHash: string;
  readonly reason: 'hash_mismatch' | 'prev_hash_mismatch';
}

export interface AuditSinkVerifyResult {
  readonly ok: boolean;
  readonly breaks?: ChainBreak[];
}

/**
 * AuditSinkError — adapters MUST wrap vendor SDK errors in this
 * class so the drain can decide retry policy without sniffing
 * vendor-specific error shapes.
 *
 *   - `retryable: true`  — transient (throttle, 5xx, network);
 *                          the drain leaves the row un-published
 *                          and the next sweep re-tries.
 *   - `retryable: false` — terminal (KMS permission, object lock
 *                          violation, bucket missing); the drain
 *                          leaves the row un-published AND alerts
 *                          on-call. Re-trying won't help.
 *
 * `code` is the vendor's error code passed through verbatim so a
 * grep across logs lines up the platform's view with what AWS /
 * Azure / GCS reported.
 */
export class AuditSinkError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(input: { code: string; retryable: boolean; message?: string; cause?: unknown }) {
    super(input.message ?? `audit_sink_error:${input.code}`);
    this.name = 'AuditSinkError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.cause = input.cause;
  }
}

/**
 * Port consumed by the chain verifier + WORM-backed cold archive.
 * Adapters: S3 + Object Lock (today), Azure Blob immutability +
 * GCS bucket lock (planned for cross-cloud redundancy).
 */
export interface AuditSink {
  /** Persist a single row. Returns the WORM-tier evidence handle
   *  (ETag + optional version id) for the drain audit log. */
  append(row: AuditRow): Promise<AuditSinkAppendResult>;
  /** Replay a UTC day's worth of rows in ETag-stable order so the
   *  verifier can re-compute the chain. */
  read(date: Date): AsyncIterable<AuditRow>;
  /** Re-compute the chain for a UTC day. Returns `{ ok: true }`
   *  when every row's hash matches `sha256(prevHash ||
   *  canonicalJson(payload))`; otherwise the list of breaks. */
  verifyDay(date: Date): Promise<AuditSinkVerifyResult>;
}

/**
 * Canonical JSON for a payload — deterministic key ordering at
 * every nesting depth so the hash is stable across language
 * runtimes and node versions. Exported because both the writer
 * (drain) and the verifier (WORM adapter) need byte-identical
 * canonicalisation.
 */
export function canonicalJson(payload: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)]),
    );
  };
  return JSON.stringify(sortKeys(payload));
}
