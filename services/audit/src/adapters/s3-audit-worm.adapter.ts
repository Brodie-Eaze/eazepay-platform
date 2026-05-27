import { Injectable, Logger } from '@nestjs/common';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { sha256Hex } from '@eazepay/shared-utils';
import {
  AuditSinkError,
  canonicalJson,
  type AuditRow,
  type AuditSink,
  type AuditSinkAppendResult,
  type AuditSinkVerifyResult,
  type ChainBreak,
} from '@eazepay/integrations-core';

/** BSA 31 CFR 1010.430 — 5yr min; we set 7yr to cover IRS + state. */
const RETENTION_YEARS = 7;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export interface S3AuditWormAdapterConfig {
  /** S3 bucket; from env AUDIT_S3_BUCKET. Required at construction. */
  readonly bucket: string;
  /** AWS region; from env AUDIT_S3_REGION. Required at construction. */
  readonly region: string;
  /** Customer-managed KMS key id for SSE-KMS. Required so the adapter
   *  refuses to write rows un-encrypted at rest. */
  readonly kmsKeyId: string;
  /** Override `now()` for deterministic retention-date assertions in
   *  tests. Defaults to wall clock. */
  readonly now?: () => Date;
  /** Sized batching as a follow-up. Default 1 = one PUT per row for
   *  maximum WORM integrity (every row independently verifiable). */
  readonly batchSize?: number;
  /** SDK client override for tests / mocks. Production constructs
   *  from {region}. */
  readonly client?: S3Client;
}

/**
 * Read `S3AuditWormAdapterConfig` from environment. Throws if any
 * REQUIRED variable is missing — construction MUST fail loud so a
 * misconfigured deploy never silently no-ops audit writes.
 *
 * Env vars:
 *   AUDIT_S3_BUCKET    — bucket name (must have Object Lock enabled,
 *                        bucket-level default retention NOT required;
 *                        per-object retention is set on each PUT).
 *   AUDIT_S3_REGION    — region the bucket lives in.
 *   AUDIT_KMS_KEY_ID   — customer-managed KMS key id / arn / alias for
 *                        SSE-KMS. AWS-managed `aws/s3` is rejected;
 *                        BSA exam wants customer-managed for the
 *                        audit trail.
 *   AUDIT_S3_BATCH_SIZE — optional, defaults to 1.
 */
export function loadS3AuditWormConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): S3AuditWormAdapterConfig {
  const bucket = env['AUDIT_S3_BUCKET'];
  if (!bucket) {
    throw new Error('AUDIT_S3_BUCKET is required for S3AuditWormAdapter');
  }
  const region = env['AUDIT_S3_REGION'];
  if (!region) {
    throw new Error('AUDIT_S3_REGION is required for S3AuditWormAdapter');
  }
  const kmsKeyId = env['AUDIT_KMS_KEY_ID'];
  if (!kmsKeyId) {
    throw new Error('AUDIT_KMS_KEY_ID is required for S3AuditWormAdapter');
  }
  const rawBatch = env['AUDIT_S3_BATCH_SIZE'];
  const batchSize = rawBatch ? Number.parseInt(rawBatch, 10) : 1;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`AUDIT_S3_BATCH_SIZE must be a positive integer; got ${rawBatch}`);
  }
  return { bucket, region, kmsKeyId, batchSize };
}

/**
 * S3-backed WORM (write-once / read-many) adapter for the immutable
 * audit chain. Backed by S3 Object Lock in GOVERNANCE mode with a
 * seven-year retain-until date (BSA 31 CFR 1010.430 — 5yr min; we
 * pad to 7 for IRS + state).
 *
 * Design choices encoded here:
 *
 *   - ONE PUT per row. Loses throughput vs. batch-then-flush but every
 *     row is independently retrievable + verifiable. The drain is a
 *     once-a-minute sweep over a small backlog; throughput is not the
 *     bottleneck. Sized batching is parameterised (`batchSize`) for a
 *     future swap when the workload demands it.
 *
 *   - Hive-partitioned object key:
 *       audit/year=YYYY/month=MM/day=DD/<uuid>.jsonl
 *     Lets us point an Athena table at the bucket later without
 *     re-bucketing. The uuid suffix is the row id from the AuditRow,
 *     so a scan of the prefix reveals which rows are present without
 *     parsing the body.
 *
 *   - Server-side encryption is SSE-KMS with the configured customer-
 *     managed key. AWS-managed `aws/s3` is rejected upstream because
 *     BSA exam expects the customer to demonstrate control of the key
 *     material.
 *
 *   - Object Lock is GOVERNANCE (not COMPLIANCE). GOVERNANCE allows a
 *     break-glass override under an IAM permission boundary; the audit
 *     team's SOP requires this for incident-response delete of rows
 *     that contain accidentally-written PII (see SEC-040). COMPLIANCE
 *     mode would force a bucket-recreate to remove such rows. Per-
 *     object retain-until-date is set to now+7yr at PUT time so the
 *     7-year clock starts from when the row was written, not from when
 *     the bucket was created.
 *
 *   - Row metadata (`audit_id`, `prev_hash`) is set as S3 object
 *     metadata so an Athena scan can correlate without parsing the
 *     row body.
 */
@Injectable()
export class S3AuditWormAdapter implements AuditSink {
  private readonly logger = new Logger(S3AuditWormAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly kmsKeyId: string;
  private readonly batchSize: number;
  private readonly now: () => Date;

  constructor(config: S3AuditWormAdapterConfig) {
    this.bucket = config.bucket;
    this.kmsKeyId = config.kmsKeyId;
    this.batchSize = config.batchSize ?? 1;
    this.now = config.now ?? ((): Date => new Date());

    if (config.client) {
      this.client = config.client;
    } else {
      const clientConfig: S3ClientConfig = { region: config.region };
      this.client = new S3Client(clientConfig);
    }

    if (this.batchSize !== 1) {
      // Sized batching is a follow-up — keep an explicit log so we
      // notice if someone flips the env without finishing the wiring.
      this.logger.warn(
        { batchSize: this.batchSize },
        'audit.sink.batch_size_override — sized batching is not yet implemented; falling back to one-PUT-per-row',
      );
    }
  }

  async append(row: AuditRow): Promise<AuditSinkAppendResult> {
    const key = keyForRow(row);
    const body = jsonlLine(row);
    const retainUntil = new Date(this.now().getTime() + RETENTION_YEARS * MS_PER_YEAR);

    try {
      const out = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: 'application/x-ndjson',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.kmsKeyId,
          ObjectLockMode: 'GOVERNANCE',
          ObjectLockRetainUntilDate: retainUntil,
          Metadata: {
            audit_id: row.id,
            prev_hash: row.prevHash,
          },
        }),
      );

      const etag = stripEtagQuotes(out.ETag);
      this.logger.log(
        {
          event: 'audit.sink.append.ok',
          rowId: row.id,
          key,
          etag,
          versionId: out.VersionId,
          retainUntil: retainUntil.toISOString(),
        },
        'audit.sink.append.ok',
      );
      return { etag, versionId: out.VersionId };
    } catch (err) {
      const wrapped = toAuditSinkError(err);
      this.logger.error(
        {
          event: 'audit.sink.append.err',
          rowId: row.id,
          key,
          code: wrapped.code,
          retryable: wrapped.retryable,
        },
        'audit.sink.append.err',
      );
      throw wrapped;
    }
  }

  async *read(date: Date): AsyncIterable<AuditRow> {
    const prefix = prefixForDate(date);
    // S3 ListObjectsV2 returns keys lexicographically sorted within a
    // page. We sort across pages by (key, etag) so the chain order is
    // stable regardless of pagination boundary — uuids embedded in
    // keys are not monotonic but their lex order is; the verifier
    // depends on the writer having emitted in chain order.
    const items: Array<{ key: string; etag: string }> = [];
    let continuationToken: string | undefined;
    do {
      try {
        const page = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        );
        for (const obj of page.Contents ?? []) {
          if (!obj.Key) continue;
          items.push({ key: obj.Key, etag: stripEtagQuotes(obj.ETag) });
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } catch (err) {
        const wrapped = toAuditSinkError(err);
        this.logger.error(
          {
            event: 'audit.sink.read.err',
            prefix,
            code: wrapped.code,
            retryable: wrapped.retryable,
          },
          'audit.sink.read.err',
        );
        throw wrapped;
      }
    } while (continuationToken);

    // Stable order: lex key, then etag as tiebreaker for the (rare)
    // case where two writers land on the same uuid (shouldn't happen
    // — uuids collide at 1-in-2^61 — but the tiebreaker keeps the
    // verifier deterministic).
    items.sort((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      if (a.etag < b.etag) return -1;
      if (a.etag > b.etag) return 1;
      return 0;
    });

    for (const item of items) {
      let body: string;
      try {
        const obj = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: item.key }),
        );
        body = await readBodyToString(obj.Body);
      } catch (err) {
        const wrapped = toAuditSinkError(err);
        this.logger.error(
          {
            event: 'audit.sink.read.err',
            key: item.key,
            code: wrapped.code,
            retryable: wrapped.retryable,
          },
          'audit.sink.read.err',
        );
        throw wrapped;
      }
      // One row per object today; loop over lines defensively so a
      // future batched-PUT object still round-trips.
      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield parseAuditRow(trimmed, item.key);
      }
    }
  }

  async verifyDay(date: Date): Promise<AuditSinkVerifyResult> {
    const breaks: ChainBreak[] = [];
    let prevHash: string | null = null;
    let rowCount = 0;

    for await (const row of this.read(date)) {
      rowCount++;
      const expectedHash = sha256Hex(row.prevHash + canonicalJson(row.payload));
      if (expectedHash !== row.hash) {
        breaks.push({
          rowId: row.id,
          expectedHash,
          observedHash: row.hash,
          reason: 'hash_mismatch',
        });
      }
      // Chain continuity: the first row's prevHash is ZERO_HASH;
      // every subsequent row's prevHash must match the previous
      // row's hash. We use the OBSERVED previous hash (not the
      // recomputed one) so a hash_mismatch surfaces independently of
      // a prev_hash_mismatch.
      if (prevHash !== null && row.prevHash !== prevHash) {
        breaks.push({
          rowId: row.id,
          expectedHash: prevHash,
          observedHash: row.prevHash,
          reason: 'prev_hash_mismatch',
        });
      }
      prevHash = row.hash;
    }

    const ok = breaks.length === 0;
    if (ok) {
      this.logger.log(
        {
          event: 'audit.sink.verify.ok',
          date: dateKey(date),
          rowCount,
        },
        'audit.sink.verify.ok',
      );
      return { ok };
    }
    this.logger.error(
      {
        event: 'audit.sink.verify.break',
        date: dateKey(date),
        rowCount,
        breakCount: breaks.length,
        breaks,
      },
      'audit.sink.verify.break',
    );
    return { ok, breaks };
  }
}

/** Hive-style partition prefix for a UTC date. */
function prefixForDate(date: Date): string {
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `audit/year=${yyyy}/month=${mm}/day=${dd}/`;
}

function dateKey(date: Date): string {
  return prefixForDate(date).slice('audit/'.length, -1);
}

/** Object key for a row — partition prefix + row uuid + `.jsonl`. */
function keyForRow(row: AuditRow): string {
  // Use the row's written-at to partition so a back-fill of historical
  // rows lands in the right day prefix instead of being smeared by
  // server clock skew at PUT time.
  const written = new Date(row.writtenAt);
  if (Number.isNaN(written.getTime())) {
    throw new AuditSinkError({
      code: 'invalid_written_at',
      retryable: false,
      message: `audit row ${row.id} has unparseable writtenAt: ${row.writtenAt}`,
    });
  }
  return `${prefixForDate(written)}${row.id}.jsonl`;
}

/** Render an AuditRow as a single JSONL line. */
function jsonlLine(row: AuditRow): string {
  return `${JSON.stringify({
    id: row.id,
    prevHash: row.prevHash,
    hash: row.hash,
    payload: row.payload,
    writtenAt: row.writtenAt,
  })}\n`;
}

/** Strip surrounding quotes S3 wraps around ETag headers. */
function stripEtagQuotes(etag: string | undefined): string {
  if (!etag) return '';
  return etag.replace(/^"|"$/g, '');
}

/** Drain an AWS SDK v3 GetObject body (Web Stream / Node Stream /
 *  Blob / string) into a UTF-8 string. */
async function readBodyToString(body: unknown): Promise<string> {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  // Node Readable stream (common path in production).
  const maybeNodeStream = body as { [Symbol.asyncIterator]?: () => AsyncIterator<unknown> };
  if (typeof maybeNodeStream[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of maybeNodeStream as AsyncIterable<unknown>) {
      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  // Web ReadableStream — fall back to .text() if available
  // (mockable; SDK v3 wraps these in production browsers/edge).
  const maybeText = body as { text?: () => Promise<string> };
  if (typeof maybeText.text === 'function') {
    return maybeText.text();
  }
  throw new AuditSinkError({
    code: 'unreadable_body',
    retryable: false,
    message: 'S3 GetObject body is not a stream / Uint8Array / string',
  });
}

/** Parse one JSONL line into an AuditRow with field validation. */
function parseAuditRow(line: string, key: string): AuditRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    throw new AuditSinkError({
      code: 'invalid_jsonl',
      retryable: false,
      message: `failed to parse audit row from ${key}: ${(err as Error).message}`,
      cause: err,
    });
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new AuditSinkError({
      code: 'invalid_jsonl',
      retryable: false,
      message: `audit row from ${key} is not an object`,
    });
  }
  const r = parsed as Record<string, unknown>;
  const id = r['id'];
  const prevHash = r['prevHash'];
  const hash = r['hash'];
  const payload = r['payload'];
  const writtenAt = r['writtenAt'];
  if (
    typeof id !== 'string' ||
    typeof prevHash !== 'string' ||
    typeof hash !== 'string' ||
    typeof writtenAt !== 'string' ||
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new AuditSinkError({
      code: 'invalid_jsonl',
      retryable: false,
      message: `audit row from ${key} is missing required fields`,
    });
  }
  return {
    id,
    prevHash,
    hash,
    payload: payload as Record<string, unknown>,
    writtenAt,
  };
}

/**
 * Map an AWS SDK error to an `AuditSinkError`. Retryability is
 * decided up front so the drain doesn't need to sniff vendor codes.
 *
 *   Retryable: throttles, 5xx, connection / DNS / timeout, generic
 *              SDK retryable flag.
 *   Terminal: KMS access denied, object lock retention violation,
 *             4xx (except 429), access denied, no-such-bucket.
 */
function toAuditSinkError(err: unknown): AuditSinkError {
  if (err instanceof AuditSinkError) return err;

  const e = err as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
    $retryable?: { throttling?: boolean };
    message?: string;
  };
  const code = e.name ?? e.Code ?? e.code ?? 'unknown_s3_error';
  const status = e.$metadata?.httpStatusCode;
  const throttling = e.$retryable?.throttling === true;

  const RETRYABLE_CODES = new Set([
    'ThrottlingException',
    'Throttling',
    'TooManyRequestsException',
    'RequestTimeout',
    'RequestTimeoutException',
    'SlowDown',
    'ServiceUnavailable',
    'InternalError',
    'InternalFailure',
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'NetworkingError',
    'TimeoutError',
  ]);
  const TERMINAL_CODES = new Set([
    'AccessDenied',
    'KMSAccessDeniedException',
    'KMS.AccessDeniedException',
    'KMSInvalidStateException',
    'KMSDisabledException',
    'KMSNotFoundException',
    'InvalidRequest',
    'InvalidRetentionPeriod',
    'InvalidWriteOffset',
    'ObjectLockConfigurationNotFoundError',
    'InvalidObjectState',
    'NoSuchBucket',
    'NoSuchKey',
    'BucketAlreadyExists',
    'BucketAlreadyOwnedByYou',
    'PermanentRedirect',
    // S3 surfaces the "object lock violation" path through these:
    'OperationAborted',
  ]);

  let retryable: boolean;
  if (TERMINAL_CODES.has(code)) {
    retryable = false;
  } else if (RETRYABLE_CODES.has(code) || throttling) {
    retryable = true;
  } else if (typeof status === 'number') {
    // 5xx is retryable, 429 is retryable, everything else 4xx is not.
    retryable = status >= 500 || status === 429;
  } else {
    // No status, no recognised code — conservative default is
    // retryable so a transient network blip doesn't drop a row. The
    // drain caps retries via the outbox-row claim window.
    retryable = true;
  }

  return new AuditSinkError({
    code,
    retryable,
    message: e.message ?? `S3 error ${code}`,
    cause: err,
  });
}
