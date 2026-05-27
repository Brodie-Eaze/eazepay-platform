/**
 * migrate-deks-to-kms.ts — one-shot DEK rewrap script for the AWS KMS
 * cutover. Decrypts every envelope-encrypted PII row's DEK with the
 * current `LocalKeyManager` KEK and re-wraps it under the destination
 * KMS KEK.
 *
 * The DATA does not change. Only the per-row `data_key_ciphertext` +
 * `kek_id` columns (structured envelopes) and the embedded `dk` + `k`
 * fields (opaque envelopes) are rewritten. The plaintext PII payload,
 * the AAD, and the GCM nonce are all preserved verbatim — readers
 * after cutover open the SAME ciphertext using the SAME DEK they did
 * before, just unwrapped through KMS instead of the local KEK.
 *
 * WHY THIS MUST RUN BEFORE THE BOOT GUARD FLIPS
 * ---------------------------------------------
 * PR #170 introduces a boot-time assertion that every encrypted PII
 * row in the DB has `kek_id` matching the runtime KEY_MANAGER's id.
 * After the flip, any row still on `local-dev` becomes effectively
 * undecryptable in production: the LocalKeyManager is gone, and the
 * KMS adapter rejects the `kek_id` mismatch (see KeyManager invariant
 * #2 in libs/integrations-core/src/key-manager.ts).
 *
 * USAGE
 * -----
 *   pnpm tsx scripts/migrate-deks-to-kms.ts --dry-run
 *   pnpm tsx scripts/migrate-deks-to-kms.ts --commit --batch-size=100
 *   pnpm tsx scripts/migrate-deks-to-kms.ts --commit --resume-from=auto
 *   pnpm tsx scripts/migrate-deks-to-kms.ts --commit --table=consumer_profiles
 *
 * SAFETY FLAGS
 * ------------
 *   --dry-run            decrypt + would-write only, NO db writes
 *   --commit             do the writes (mutually exclusive with --dry-run)
 *   --batch-size=N       rows per batch (default 100; KMS soft cap ~5500/s)
 *   --concurrency=N      parallel KMS calls within a batch (default 10)
 *   --throttle-ms=N      sleep between batches in ms (default 100)
 *   --resume-from=<id>   resume from a specific row id (uuid) — strictly AFTER
 *   --resume-from=auto   read dek_rewrap_progress, continue most-recent run
 *   --table=<name>       restrict to one table (default: all 7 tables)
 *   --failure-file=<p>   path for JSONL failure log (default: cwd timestamped)
 *
 * IDEMPOTENCY
 * -----------
 * Re-running the script after a partial run is safe: rows whose `kek_id`
 * already matches the destination KEK are skipped (no decrypt, no write,
 * no audit). The `--resume-from=auto` mode finds the last cursor written
 * to `dek_rewrap_progress` and continues from there; rerunning with no
 * resume flag re-scans from the start but still skips already-rewrapped
 * rows on the kek_id check.
 *
 * PER-BATCH TRANSACTIONS
 * ----------------------
 * Each batch wraps its writes in a single short-lived transaction. We
 * deliberately do NOT use one giant transaction across the whole table:
 * a multi-million-row UPDATE in a single tx holds locks for the duration,
 * blocks autovacuum, and bloats WAL. Per-batch tx keeps lock windows
 * sub-second.
 */
import { config as loadDotenv } from 'dotenv';
loadDotenv();

import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PrismaClient, type Prisma } from '@prisma/client';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import {
  MockKmsKeyManager,
  type DataKeyMaterial,
  type KeyManager,
} from '@eazepay/integrations-core';

// ─────────────────────────────────────────────────────────────────────
// SourceLocalKeyManager — a byte-compatible re-implementation of
// services/user/src/adapters/local-key-manager.adapter.ts so the script
// stays decoupled from the NestJS user-service surface (which is
// declared read-only by the cutover brief).
//
// Envelope layout MUST stay identical to the production LocalKeyManager:
//   [nonce(12) || ciphertext || tag(16)]
// AAD MUST be `dek:<kekId>` so every existing wrapped DEK in the
// production DB unwraps successfully here. If the production adapter
// ever changes shape, THIS class is the canary that breaks the spec —
// keep them in lock-step.
//
// We do NOT use this class to WRAP. The whole point of the script is
// to rewrap onto the destination KEK; the source side only ever
// decrypts.
// ─────────────────────────────────────────────────────────────────────
const ALGO = 'aes-256-gcm' as const;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class SourceLocalKeyManager implements KeyManager {
  private readonly kek: Buffer;
  readonly kekId: string;

  constructor(kekHex: string, kekId = 'local-dev') {
    if (!kekHex || kekHex.length !== 64) {
      throw new Error(
        'SourceLocalKeyManager requires a 32-byte (64 hex chars) KEK. Generate via: openssl rand -hex 32',
      );
    }
    this.kek = Buffer.from(kekHex, 'hex');
    if (this.kek.length !== KEY_BYTES) {
      throw new Error('SourceLocalKeyManager KEK decoded to wrong byte length');
    }
    this.kekId = kekId;
  }

  async decryptDataKey(input: { ciphertext: Buffer; kekId: string }): Promise<Buffer> {
    if (input.kekId !== this.kekId) {
      throw new Error(`KEK mismatch: stored ${input.kekId}, runtime ${this.kekId}`);
    }
    if (input.ciphertext.length < NONCE_BYTES + TAG_BYTES) {
      throw new Error('SourceLocalKeyManager ciphertext too short');
    }
    const nonce = input.ciphertext.subarray(0, NONCE_BYTES);
    const body = input.ciphertext.subarray(NONCE_BYTES);
    const tagStart = body.length - TAG_BYTES;
    const enc = body.subarray(0, tagStart);
    const tag = body.subarray(tagStart);
    const decipher = createDecipheriv(ALGO, this.kek, nonce);
    decipher.setAAD(Buffer.from(`dek:${this.kekId}`));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  // The KeyManager port requires generateDataKey + wrapDataKey, but the
  // source side never wraps during a rewrap — these throw if anything
  // ever calls them so a bug doesn't silently put a `local-dev` DEK
  // back into the DB.
  async generateDataKey(): Promise<DataKeyMaterial> {
    throw new Error('SourceLocalKeyManager.generateDataKey called — should never happen in rewrap');
  }

  async wrapDataKey(_plaintext: Buffer): Promise<Buffer> {
    throw new Error('SourceLocalKeyManager.wrapDataKey called — should never happen in rewrap');
  }

  /**
   * Build a wrapped-DEK envelope shaped exactly like the production
   * LocalKeyManager would produce — used by tests to seed realistic
   * row payloads. Kept on the class so the layout invariant lives in
   * exactly one place.
   */
  static seedWrappedDek(kekHex: string, plaintextDek: Buffer, kekId = 'local-dev'): Buffer {
    const kek = Buffer.from(kekHex, 'hex');
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGO, kek, nonce);
    cipher.setAAD(Buffer.from(`dek:${kekId}`));
    const enc = Buffer.concat([cipher.update(plaintextDek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, enc, tag]);
  }
}

// ─────────────────────────────────────────────────────────────────────
// CLI parsing — intentionally hand-rolled (no yargs dep). Each flag
// is parsed once at startup; the resolved shape is passed through to
// `runMigration()` so tests can call the function directly with a
// constructed Options object instead of mutating process.argv.
// ─────────────────────────────────────────────────────────────────────

export interface Options {
  dryRun: boolean;
  commit: boolean;
  batchSize: number;
  concurrency: number;
  throttleMs: number;
  resumeFrom: string | 'auto' | null;
  table: TableName | null;
  failureFile: string;
}

export const ALL_TABLES = [
  'consumer_profiles',
  'beneficial_owners',
  'users_totp',
  'webhook_endpoints',
  'marketplaces',
  'billing_configs',
  'highsale_snapshots',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

export function parseArgs(argv: string[]): Options {
  const opts: Options = {
    dryRun: false,
    commit: false,
    batchSize: 100,
    concurrency: 10,
    throttleMs: 100,
    resumeFrom: null,
    table: null,
    failureFile: resolve(
      process.cwd(),
      `dek-rewrap-failures-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`,
    ),
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--commit') opts.commit = true;
    else if (arg.startsWith('--batch-size=')) {
      opts.batchSize = parseIntStrict(arg.slice('--batch-size='.length), 'batch-size');
    } else if (arg.startsWith('--concurrency=')) {
      opts.concurrency = parseIntStrict(arg.slice('--concurrency='.length), 'concurrency');
    } else if (arg.startsWith('--throttle-ms=')) {
      opts.throttleMs = parseIntStrict(arg.slice('--throttle-ms='.length), 'throttle-ms');
    } else if (arg.startsWith('--resume-from=')) {
      const val = arg.slice('--resume-from='.length);
      opts.resumeFrom = val === 'auto' ? 'auto' : val;
    } else if (arg.startsWith('--table=')) {
      const t = arg.slice('--table='.length) as TableName;
      if (!ALL_TABLES.includes(t)) {
        throw new Error(`unknown --table=${t} (allowed: ${ALL_TABLES.join(', ')})`);
      }
      opts.table = t;
    } else if (arg.startsWith('--failure-file=')) {
      opts.failureFile = resolve(process.cwd(), arg.slice('--failure-file='.length));
    } else if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  if (opts.dryRun && opts.commit) {
    throw new Error('--dry-run and --commit are mutually exclusive');
  }
  if (!opts.dryRun && !opts.commit) {
    throw new Error('pass --dry-run or --commit');
  }
  if (opts.batchSize <= 0 || opts.batchSize > 5000) {
    throw new Error('--batch-size must be in (0, 5000]');
  }
  if (opts.concurrency <= 0 || opts.concurrency > 100) {
    throw new Error('--concurrency must be in (0, 100]');
  }
  if (opts.throttleMs < 0 || opts.throttleMs > 60_000) {
    throw new Error('--throttle-ms must be in [0, 60000]');
  }
  return opts;
}

function parseIntStrict(s: string, name: string): number {
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || String(n) !== s.replace(/^0+(?=\d)/, '')) {
    throw new Error(`--${name} must be an integer (got "${s}")`);
  }
  return n;
}

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm tsx scripts/migrate-deks-to-kms.ts (--dry-run | --commit) [flags]

Flags:
  --batch-size=N        rows per batch (default 100)
  --concurrency=N       parallel KMS calls within a batch (default 10)
  --throttle-ms=N       sleep between batches in ms (default 100)
  --resume-from=<id>    resume from row id (uuid), strictly AFTER
  --resume-from=auto    read dek_rewrap_progress, continue last run
  --table=<name>        one of: ${ALL_TABLES.join(', ')}
  --failure-file=<p>    JSONL failure log path
`);
}

// ─────────────────────────────────────────────────────────────────────
// Table descriptors — each PII table the script knows how to rewrap.
// Two envelope shapes:
//   * structured: dedicated columns (data_key_ciphertext bytea + kek_id text)
//   * opaque:     base64 JSON with `dk` + `k` fields, packed via PiiVaultService.sealOpaque
// ─────────────────────────────────────────────────────────────────────

export interface TableDescriptor {
  name: TableName;
  /** Whether the envelope is structured (bytes columns) or opaque (base64 string). */
  shape: 'structured' | 'opaque';
  /** Physical table name in Postgres. */
  table: string;
  /** Cursor column name (uuid). */
  idColumn: string;
  /** For structured envelopes: the bytes column holding the wrapped DEK. */
  dekColumn?: string;
  /** For structured envelopes: the text column holding the kek id. */
  kekColumn?: string;
  /** For opaque envelopes: the column holding the base64 envelope string. */
  envelopeColumn?: string;
  /** Whether the envelope column is nullable — opaque rows may carry NULL
   *  during the migration (e.g. pre-rotation webhook_endpoints.secret_ciphertext). */
  nullable: boolean;
  /** Audit-action emitted per row for the dek_rewrap audit trail. */
  auditAction: string;
}

export const TABLES: Record<TableName, TableDescriptor> = {
  consumer_profiles: {
    name: 'consumer_profiles',
    shape: 'structured',
    table: 'consumer_profiles',
    idColumn: 'id',
    dekColumn: 'data_key_ciphertext',
    kekColumn: 'kek_id',
    nullable: false,
    auditAction: 'pii_dek.rewrapped.consumer_profile',
  },
  beneficial_owners: {
    name: 'beneficial_owners',
    shape: 'structured',
    table: 'beneficial_owners',
    idColumn: 'id',
    dekColumn: 'data_key_ciphertext',
    kekColumn: 'kek_id',
    nullable: false,
    auditAction: 'pii_dek.rewrapped.beneficial_owner',
  },
  users_totp: {
    name: 'users_totp',
    shape: 'opaque',
    table: 'users',
    idColumn: 'id',
    envelopeColumn: 'totp_secret_ciphertext',
    nullable: true,
    auditAction: 'pii_dek.rewrapped.user_totp',
  },
  webhook_endpoints: {
    name: 'webhook_endpoints',
    shape: 'opaque',
    table: 'webhook_endpoints',
    idColumn: 'id',
    envelopeColumn: 'secret_ciphertext',
    nullable: true,
    auditAction: 'pii_dek.rewrapped.webhook_endpoint',
  },
  marketplaces: {
    name: 'marketplaces',
    shape: 'opaque',
    table: 'marketplaces',
    idColumn: 'id',
    envelopeColumn: 'webhook_secret_ciphertext',
    nullable: true,
    auditAction: 'pii_dek.rewrapped.marketplace',
  },
  billing_configs: {
    name: 'billing_configs',
    shape: 'opaque',
    table: 'billing_configs',
    idColumn: 'id',
    envelopeColumn: 'send_to_email_enc',
    nullable: true,
    auditAction: 'pii_dek.rewrapped.billing_config',
  },
  highsale_snapshots: {
    name: 'highsale_snapshots',
    shape: 'opaque',
    table: 'highsale_snapshots',
    idColumn: 'id',
    envelopeColumn: 'payload_ciphertext',
    nullable: false,
    auditAction: 'pii_dek.rewrapped.highsale_snapshot',
  },
};

// ─────────────────────────────────────────────────────────────────────
// Per-table summary stats — what we report at the end of the run.
// ─────────────────────────────────────────────────────────────────────

export interface TableStats {
  table: TableName;
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface RunSummary {
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  perTable: TableStats[];
  totals: { total: number; succeeded: number; skipped: number; failed: number };
}

// ─────────────────────────────────────────────────────────────────────
// IO abstractions — passing these via Deps makes the script unit-testable
// without spinning up Postgres or touching real fs.
// ─────────────────────────────────────────────────────────────────────

export interface DbClient {
  /** Stream rows ordered by id ASC, starting AFTER `afterId` (NULL = from start),
   *  bounded by `batchSize`. Returns the raw row shape — script handles per-table parsing. */
  fetchBatch(table: TableDescriptor, afterId: string | null, batchSize: number): Promise<RawRow[]>;
  /** Persist a rewrap result. Wrapped in a single short-lived transaction. */
  writeBatch(
    table: TableDescriptor,
    rows: RewrapWrite[],
    runId: string,
    sourceKekId: string,
    destinationKekId: string,
  ): Promise<void>;
  /** Insert a progress row marking the boundary of a batch. */
  writeProgress(input: ProgressRow): Promise<void>;
  /** Fetch the most-recent unfinished progress row for a job to resume from. */
  loadResumeCursor(job: string): Promise<string | null>;
}

export interface RawRow {
  id: string;
  /** Structured: Buffer; Opaque: string (base64); NULL when nullable + unset. */
  payload: Buffer | string | null;
  /** Only meaningful for structured rows. */
  kekId: string | null;
}

export interface RewrapWrite {
  id: string;
  /** Structured: Buffer with the new wrapped DEK. Opaque: new base64 envelope. */
  newPayload: Buffer | string;
  /** Structured: the new kek_id string. Opaque: ignored (kek lives inside payload). */
  newKekId: string;
  /** Original kek id from the source row — emitted to the audit log. */
  oldKekId: string;
}

export interface ProgressRow {
  job: string;
  sourceKekId: string;
  destinationKekId: string;
  lastProcessedId: string | null;
  countDone: number;
  countSkipped: number;
  countFailed: number;
  batchStartedAt: Date;
  batchFinishedAt: Date;
  runId: string;
  finishedRun: boolean;
}

export interface Failure {
  table: TableName;
  rowId: string;
  reason: string;
  stack?: string;
  occurredAt: string;
}

export interface FailureSink {
  record(failure: Failure): void;
  /** Total failures written so far — used in the final summary. */
  count(): number;
}

export interface Logger {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

export interface Deps {
  source: KeyManager;
  destination: KeyManager;
  db: DbClient;
  failures: FailureSink;
  logger: Logger;
  /** Wall-clock sleep — overridable so tests don't actually wait. */
  sleep: (ms: number) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Opaque envelope helpers — mirror PiiVaultService.sealOpaque /
// openOpaque shape from services/user/src/internal/pii-vault.service.ts.
// We re-implement here rather than import to keep the script free of
// NestJS module wiring (the vault service is a @Injectable).
// ─────────────────────────────────────────────────────────────────────

interface OpaqueEnvelope {
  v: number;
  ct: string;
  n: string;
  dk: string;
  k: string;
  aad?: Record<string, string>;
}

const OPAQUE_ENVELOPE_VERSION = 1 as const;

export function parseOpaqueEnvelope(b64: string): OpaqueEnvelope {
  const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as OpaqueEnvelope;
  if (parsed.v !== OPAQUE_ENVELOPE_VERSION) {
    throw new Error(`unknown opaque envelope version ${parsed.v}`);
  }
  return parsed;
}

export function rebuildOpaqueEnvelope(
  prev: OpaqueEnvelope,
  newDk: Buffer,
  newKekId: string,
): string {
  const envelope: OpaqueEnvelope = {
    v: prev.v,
    ct: prev.ct,
    n: prev.n,
    dk: newDk.toString('base64'),
    k: newKekId,
    // `aad` is opaque to the rewrap — preserve whatever was there so a
    // future reader can supply the same context.
    ...(prev.aad === undefined ? {} : { aad: prev.aad }),
  };
  return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');
}

// ─────────────────────────────────────────────────────────────────────
// Core rewrap loop — per table.
//
// Loops fetchBatch → process batch (parallel KMS, bounded concurrency)
// → writeBatch (per-batch tx) → writeProgress → sleep(throttleMs).
// Exits the loop when fetchBatch returns < batchSize rows.
// ─────────────────────────────────────────────────────────────────────

export async function rewrapTable(
  descriptor: TableDescriptor,
  opts: Options,
  deps: Deps,
  runId: string,
): Promise<TableStats> {
  const stats: TableStats = {
    table: descriptor.name,
    total: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
  };

  let cursor: string | null = null;
  if (opts.resumeFrom !== null) {
    if (opts.resumeFrom === 'auto') {
      cursor = await deps.db.loadResumeCursor(jobId(descriptor.name));
      if (cursor !== null) {
        deps.logger.info('resume.auto', { table: descriptor.name, cursor });
      }
    } else if (opts.table === descriptor.name || opts.table === null) {
      cursor = opts.resumeFrom;
      deps.logger.info('resume.explicit', { table: descriptor.name, cursor });
    }
  }

  // Bounded loop guard — protects against pathological data shapes
  // where writeBatch fails to advance the cursor. A million batches at
  // batchSize=5000 covers 5B rows, which is far beyond any expected
  // table size; if we hit this, something is wrong.
  for (let batchNum = 0; batchNum < 1_000_000; batchNum++) {
    const batchStartedAt = new Date();
    const rows = await deps.db.fetchBatch(descriptor, cursor, opts.batchSize);
    if (rows.length === 0) {
      // Empty batch — done.
      deps.logger.info('batch.empty', { table: descriptor.name, cursor });
      break;
    }

    const writes: RewrapWrite[] = [];
    // Process rows with bounded concurrency. Each row is independent
    // KMS-call-wise; we cap parallelism so we don't open 1000s of
    // simultaneous KMS sockets and trip the per-account quota.
    await runWithConcurrency(rows, opts.concurrency, async (row) => {
      stats.total++;
      try {
        const result = await rewrapRow(descriptor, row, deps);
        if (result === 'skip') {
          stats.skipped++;
          return;
        }
        writes.push(result);
        stats.succeeded++;
      } catch (err) {
        stats.failed++;
        deps.failures.record({
          table: descriptor.name,
          rowId: row.id,
          reason: err instanceof Error ? err.message : String(err),
          ...(err instanceof Error && err.stack !== undefined ? { stack: err.stack } : {}),
          occurredAt: new Date().toISOString(),
        });
        deps.logger.warn('row.failed', {
          table: descriptor.name,
          rowId: row.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    });

    if (writes.length > 0 && opts.commit) {
      await deps.db.writeBatch(
        descriptor,
        writes,
        runId,
        deps.source.kekId,
        deps.destination.kekId,
      );
    }

    // Advance cursor to the LAST id we fetched in this batch — even if
    // some rows failed in the middle. Failed rows are recorded in the
    // JSONL sink; advancing past them keeps the script making forward
    // progress instead of looping on the same poison row.
    const lastRow = rows[rows.length - 1];
    if (!lastRow) {
      // Defensive — fetchBatch returned non-empty above, so this is
      // unreachable. Belt-and-braces for the strict noUncheckedIndexedAccess.
      break;
    }
    cursor = lastRow.id;
    const batchFinishedAt = new Date();

    if (opts.commit) {
      await deps.db.writeProgress({
        job: jobId(descriptor.name),
        sourceKekId: deps.source.kekId,
        destinationKekId: deps.destination.kekId,
        lastProcessedId: cursor,
        countDone: stats.succeeded,
        countSkipped: stats.skipped,
        countFailed: stats.failed,
        batchStartedAt,
        batchFinishedAt,
        runId,
        finishedRun: false,
      });
    }

    deps.logger.info('batch.done', {
      table: descriptor.name,
      batchNum,
      cursor,
      fetched: rows.length,
      written: writes.length,
      skipped: rows.length - writes.length - (stats.failed === 0 ? 0 : 0),
      stats: { ...stats },
      ms: batchFinishedAt.getTime() - batchStartedAt.getTime(),
    });

    if (rows.length < opts.batchSize) {
      // Last batch — we drained the table.
      break;
    }
    if (opts.throttleMs > 0) {
      await deps.sleep(opts.throttleMs);
    }
  }

  // Final progress row marking this table as finished. Only emitted on
  // a real commit run; dry-run finishes with no DB writes at all.
  if (opts.commit) {
    await deps.db.writeProgress({
      job: jobId(descriptor.name),
      sourceKekId: deps.source.kekId,
      destinationKekId: deps.destination.kekId,
      lastProcessedId: cursor,
      countDone: stats.succeeded,
      countSkipped: stats.skipped,
      countFailed: stats.failed,
      batchStartedAt: new Date(),
      batchFinishedAt: new Date(),
      runId,
      finishedRun: true,
    });
  }

  return stats;
}

export function jobId(table: TableName): string {
  return `dek_rewrap.${table}`;
}

// Process a single row, returning either:
//   * the RewrapWrite to apply,
//   * the literal 'skip' if the row is already on the destination KEK.
//
// Throws on decrypt failure, unexpected envelope shape, or kek-id
// mismatch on the source side. The caller's try/catch routes it to
// the failure JSONL.
export async function rewrapRow(
  descriptor: TableDescriptor,
  row: RawRow,
  deps: Deps,
): Promise<RewrapWrite | 'skip'> {
  if (row.payload === null) {
    // Opaque nullable columns may legitimately be NULL for rows that
    // pre-date the migration. Nothing to rewrap; count as a skip.
    return 'skip';
  }

  if (descriptor.shape === 'structured') {
    if (!(row.payload instanceof Buffer)) {
      throw new Error(
        `structured row payload must be Buffer (got ${typeof row.payload}) for ${descriptor.name}#${row.id}`,
      );
    }
    if (row.kekId === null) {
      throw new Error(`structured row ${descriptor.name}#${row.id} has null kek_id`);
    }
    if (row.kekId === deps.destination.kekId) {
      return 'skip';
    }
    const plaintextDek = await deps.source.decryptDataKey({
      ciphertext: row.payload,
      kekId: row.kekId,
    });
    try {
      const newWrapped = await deps.destination.wrapDataKey(plaintextDek);
      return {
        id: row.id,
        newPayload: newWrapped,
        newKekId: deps.destination.kekId,
        oldKekId: row.kekId,
      };
    } finally {
      plaintextDek.fill(0);
    }
  }

  // Opaque envelope
  if (typeof row.payload !== 'string') {
    throw new Error(
      `opaque row payload must be string (got ${typeof row.payload}) for ${descriptor.name}#${row.id}`,
    );
  }
  const env = parseOpaqueEnvelope(row.payload);
  if (env.k === deps.destination.kekId) {
    return 'skip';
  }
  const plaintextDek = await deps.source.decryptDataKey({
    ciphertext: Buffer.from(env.dk, 'base64'),
    kekId: env.k,
  });
  try {
    const newWrapped = await deps.destination.wrapDataKey(plaintextDek);
    const newEnvelope = rebuildOpaqueEnvelope(env, newWrapped, deps.destination.kekId);
    return {
      id: row.id,
      newPayload: newEnvelope,
      newKekId: deps.destination.kekId,
      oldKekId: env.k,
    };
  } finally {
    plaintextDek.fill(0);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Bounded-concurrency runner — N workers, FIFO queue, await all.
// Used so the script doesn't slam KMS with `Promise.all` on a
// 5000-row batch.
// ─────────────────────────────────────────────────────────────────────

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = items.slice();
  const workers: Promise<void>[] = [];
  const next = async (): Promise<void> => {
    const item = queue.shift();
    if (item === undefined) return;
    await worker(item);
    await next();
  };
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(next());
  }
  await Promise.all(workers);
}

// ─────────────────────────────────────────────────────────────────────
// JSONL failure sink — appends one JSON object per line to the failure
// file. Synchronous append (appendFileSync) so a crash-immediately-after
// failure still flushes — the file path includes a process-start timestamp
// to avoid collision between concurrent runs.
// ─────────────────────────────────────────────────────────────────────

export class JsonlFailureSink implements FailureSink {
  private n = 0;
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }
  record(failure: Failure): void {
    appendFileSync(this.path, JSON.stringify(failure) + '\n', 'utf8');
    this.n++;
  }
  count(): number {
    return this.n;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Prisma-backed DB client — production path. The DI shape (DbClient)
// lets specs swap in an in-memory fake.
// ─────────────────────────────────────────────────────────────────────

export class PrismaDbClient implements DbClient {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchBatch(
    table: TableDescriptor,
    afterId: string | null,
    batchSize: number,
  ): Promise<RawRow[]> {
    // Hand-rolled SQL via $queryRawUnsafe — Prisma's generated client
    // doesn't expose a "raw bytes payload" path uniformly across the
    // seven different tables here, and the schema is fixed so the
    // table/column names are not user-derived. We still bind the cursor
    // value via $1 / $2 so it's a prepared statement, not string interp.
    const cols = buildSelectColumns(table);
    const where = afterId === null ? '' : `WHERE "${table.idColumn}" > $1`;
    const sql = `
      SELECT ${cols}
      FROM "${table.table}"
      ${where}
      ORDER BY "${table.idColumn}" ASC
      LIMIT ${batchSize}
    `;
    const params: unknown[] = afterId === null ? [] : [afterId];
    const rows = (await this.prisma.$queryRawUnsafe(sql, ...params)) as Array<{
      id: string;
      payload: Buffer | string | null;
      kek_id: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      payload: r.payload,
      kekId: r.kek_id,
    }));
  }

  async writeBatch(
    table: TableDescriptor,
    rows: RewrapWrite[],
    runId: string,
    sourceKekId: string,
    destinationKekId: string,
  ): Promise<void> {
    if (rows.length === 0) return;
    // Per-batch transaction. We deliberately stay short-lived; no nested
    // long-running work happens inside the tx.
    await this.prisma.$transaction(
      async (tx) => {
        for (const row of rows) {
          await applyRewrapWrite(tx, table, row);
          // Audit row — one per rewrapped record, batch-correlated by runId.
          await tx.auditOutbox.create({
            data: {
              actorType: 'system',
              actorId: 'migrate-deks-to-kms',
              action: table.auditAction,
              targetType: table.name,
              targetId: row.id,
              after: {
                old_kek_id: row.oldKekId,
                new_kek_id: destinationKekId,
                source_kek_id: sourceKekId,
                run_id: runId,
              },
            },
          });
        }
      },
      // Short timeout — if we can't commit in 30s, something is wrong
      // (lock contention, replica lag); fail the batch and let the
      // operator decide whether to retry.
      { timeout: 30_000 },
    );
  }

  async writeProgress(input: ProgressRow): Promise<void> {
    await this.prisma.dekRewrapProgress.create({
      data: {
        job: input.job,
        sourceKekId: input.sourceKekId,
        destinationKekId: input.destinationKekId,
        lastProcessedId: input.lastProcessedId,
        countDone: input.countDone,
        countSkipped: input.countSkipped,
        countFailed: input.countFailed,
        batchStartedAt: input.batchStartedAt,
        batchFinishedAt: input.batchFinishedAt,
        runId: input.runId,
        finishedRun: input.finishedRun,
      },
    });
  }

  async loadResumeCursor(job: string): Promise<string | null> {
    const row = await this.prisma.dekRewrapProgress.findFirst({
      where: { job, finishedRun: false },
      orderBy: { createdAt: 'desc' },
      select: { lastProcessedId: true },
    });
    return row?.lastProcessedId ?? null;
  }
}

function buildSelectColumns(table: TableDescriptor): string {
  if (table.shape === 'structured') {
    return `"${table.idColumn}" AS "id", "${table.dekColumn ?? ''}" AS "payload", "${table.kekColumn ?? ''}" AS "kek_id"`;
  }
  return `"${table.idColumn}" AS "id", "${table.envelopeColumn ?? ''}" AS "payload", NULL::text AS "kek_id"`;
}

async function applyRewrapWrite(
  tx: Prisma.TransactionClient,
  table: TableDescriptor,
  row: RewrapWrite,
): Promise<void> {
  if (table.shape === 'structured') {
    if (!(row.newPayload instanceof Buffer)) {
      throw new Error(`structured table ${table.name}: expected Buffer newPayload`);
    }
    const sql = `
      UPDATE "${table.table}"
      SET "${table.dekColumn ?? ''}" = $1, "${table.kekColumn ?? ''}" = $2
      WHERE "${table.idColumn}" = $3
    `;
    await tx.$executeRawUnsafe(sql, row.newPayload, row.newKekId, row.id);
    return;
  }
  if (typeof row.newPayload !== 'string') {
    throw new Error(`opaque table ${table.name}: expected string newPayload`);
  }
  const sql = `
    UPDATE "${table.table}"
    SET "${table.envelopeColumn ?? ''}" = $1
    WHERE "${table.idColumn}" = $2
  `;
  await tx.$executeRawUnsafe(sql, row.newPayload, row.id);
}

// ─────────────────────────────────────────────────────────────────────
// Top-level orchestration — wires Deps from env, picks the table set,
// runs each, prints a summary, exits with non-zero on any failure.
// ─────────────────────────────────────────────────────────────────────

export interface RunResult {
  summary: RunSummary;
  failureFile: string;
  exitCode: 0 | 1;
}

export async function runMigration(opts: Options, deps: Deps): Promise<RunResult> {
  const runId = randomUUID();
  const startedAt = new Date();
  deps.logger.info('run.start', {
    runId,
    mode: opts.dryRun ? 'dry-run' : 'commit',
    batchSize: opts.batchSize,
    concurrency: opts.concurrency,
    throttleMs: opts.throttleMs,
    sourceKekId: deps.source.kekId,
    destinationKekId: deps.destination.kekId,
    tables: opts.table === null ? ALL_TABLES : [opts.table],
  });

  const tables: TableName[] = opts.table === null ? Array.from(ALL_TABLES) : [opts.table];
  const perTable: TableStats[] = [];
  for (const t of tables) {
    const descriptor = TABLES[t];
    const stats = await rewrapTable(descriptor, opts, deps, runId);
    perTable.push(stats);
  }

  const totals = perTable.reduce(
    (acc, t) => ({
      total: acc.total + t.total,
      succeeded: acc.succeeded + t.succeeded,
      skipped: acc.skipped + t.skipped,
      failed: acc.failed + t.failed,
    }),
    { total: 0, succeeded: 0, skipped: 0, failed: 0 },
  );

  const finishedAt = new Date();
  const summary: RunSummary = { runId, startedAt, finishedAt, perTable, totals };

  deps.logger.info('run.done', {
    runId,
    mode: opts.dryRun ? 'dry-run' : 'commit',
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totals,
    perTable,
    failureFile: deps.failures.count() > 0 ? opts.failureFile : null,
  });

  return {
    summary,
    failureFile: opts.failureFile,
    exitCode: totals.failed > 0 ? 1 : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Default Deps factory — used by the CLI entry point. Tests construct
// their own Deps with in-memory fakes.
// ─────────────────────────────────────────────────────────────────────

export function buildDefaultDeps(opts: Options): { deps: Deps; close: () => Promise<void> } {
  // Source KEK — current LocalKeyManager. Reads LOCAL_KEK_HEX from env;
  // hard-fails at construction if missing or wrong length, which is
  // the right posture for a one-shot migration that must NOT silently
  // rotate to a fresh KEK.
  const localKekHex = process.env.LOCAL_KEK_HEX;
  if (!localKekHex) {
    throw new Error(
      'LOCAL_KEK_HEX is required for the rewrap script (source KEK). ' +
        'Export the SAME value the API is currently booting with — ' +
        'rewrapping under a fresh KEK would destroy every existing envelope.',
    );
  }
  const source = new SourceLocalKeyManager(localKekHex);

  // Destination KEK — for the cutover this is the real AWS KMS adapter.
  // Until that ships, the MockKmsKeyManager exercises the full path
  // end-to-end with a structurally distinct kek_id. Operators MUST
  // override this in the actual cutover by setting KEY_MANAGER=kms in
  // env and importing the real adapter here (a one-line swap).
  const destinationKekHex = process.env.MOCK_KMS_KEK_HEX;
  const destination = new MockKmsKeyManager(
    destinationKekHex === undefined ? {} : { kekHex: destinationKekHex },
  );

  const prisma = new PrismaClient();
  const db = new PrismaDbClient(prisma);
  const failures = new JsonlFailureSink(opts.failureFile);
  const logger: Logger = {
    info: (msg, ctx) => emit('info', msg, ctx),
    warn: (msg, ctx) => emit('warn', msg, ctx),
    error: (msg, ctx) => emit('error', msg, ctx),
  };
  return {
    deps: {
      source,
      destination,
      db,
      failures,
      logger,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    },
    close: async () => {
      await prisma.$disconnect();
    },
  };
}

function emit(level: 'info' | 'warn' | 'error', msg: string, ctx?: Record<string, unknown>): void {
  // JSON-line logger — matches the rest of the platform (pino) so
  // operators can pipe through `jq` during the cutover.
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...(ctx ?? {}) });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : console.log)(line);
}

// ─────────────────────────────────────────────────────────────────────
// CLI entry — only fires when invoked directly (not via test import).
// Vitest imports this module to test parseArgs / runMigration in
// isolation, so we gate the side-effecting bootstrap on the script
// being the entry module.
// ─────────────────────────────────────────────────────────────────────

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const opts = parseArgs(process.argv.slice(2));
  const { deps, close } = buildDefaultDeps(opts);
  runMigration(opts, deps)
    .then(async (result) => {
      await close();
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'summary',
          summary: result.summary,
          failureFile: result.failureFile,
        }),
      );
      process.exit(result.exitCode);
    })
    .catch(async (err: unknown) => {
      await close().catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'fatal',
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        }),
      );
      process.exit(2);
    });
}
