/**
 * migrate-deks-to-kms.spec.ts — unit-level coverage of the DEK rewrap
 * script. We do NOT spin up Postgres or KMS; both are mocked. The
 * cryptographic primitives in MockKmsKeyManager are real (it's a thin
 * AES-256-GCM wrapper), but the rest of the world is faked so each
 * spec finishes in millis.
 *
 * What this spec is NOT
 * ---------------------
 *   * NOT an integration test against the real schema. The Prisma
 *     adapter (PrismaDbClient) is covered by manual dry-run against a
 *     test DB at cutover time; the runbook documents the exact step.
 *   * NOT a fuzz of the AES envelope. The shared-utils `crypto.spec.ts`
 *     already pins the GCM contract; we trust it here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MockKmsKeyManager } from '@eazepay/integrations-core';
import type { KeyManager } from '@eazepay/integrations-core';

import {
  ALL_TABLES,
  JsonlFailureSink,
  SourceLocalKeyManager,
  TABLES,
  jobId,
  parseArgs,
  parseOpaqueEnvelope,
  rebuildOpaqueEnvelope,
  rewrapRow,
  rewrapTable,
  runMigration,
  runWithConcurrency,
  type DbClient,
  type Deps,
  type Failure,
  type FailureSink,
  type Logger,
  type Options,
  type ProgressRow,
  type RawRow,
  type RewrapWrite,
  type TableDescriptor,
} from './migrate-deks-to-kms.js';

// ─────────────────────────────────────────────────────────────────────
// Fakes — in-memory DB, in-memory failure sink, no-op sleep, silent logger.
// ─────────────────────────────────────────────────────────────────────

class InMemoryDb implements DbClient {
  fetched: Array<{ table: string; afterId: string | null; batchSize: number }> = [];
  writes: Array<{ table: string; rows: RewrapWrite[]; runId: string }> = [];
  progress: ProgressRow[] = [];
  resumeCursor: Record<string, string | null> = {};

  constructor(private readonly tableRows: Record<string, RawRow[]>) {}

  async fetchBatch(
    table: TableDescriptor,
    afterId: string | null,
    batchSize: number,
  ): Promise<RawRow[]> {
    this.fetched.push({ table: table.name, afterId, batchSize });
    const all = this.tableRows[table.name] ?? [];
    const sorted = [...all].sort((a, b) => a.id.localeCompare(b.id));
    const filtered = afterId === null ? sorted : sorted.filter((r) => r.id > afterId);
    return filtered.slice(0, batchSize);
  }

  async writeBatch(table: TableDescriptor, rows: RewrapWrite[], runId: string): Promise<void> {
    this.writes.push({ table: table.name, rows: rows.slice(), runId });
    // Reflect the writes back into the in-memory table so a subsequent
    // fetch returns the rewrapped state (idempotency check on re-run).
    const target = this.tableRows[table.name] ?? [];
    for (const w of rows) {
      const row = target.find((r) => r.id === w.id);
      if (!row) continue;
      row.payload = w.newPayload;
      if (table.shape === 'structured') {
        row.kekId = w.newKekId;
      }
    }
  }

  async writeProgress(input: ProgressRow): Promise<void> {
    this.progress.push(input);
  }

  async loadResumeCursor(job: string): Promise<string | null> {
    return this.resumeCursor[job] ?? null;
  }
}

class InMemoryFailureSink implements FailureSink {
  records: Failure[] = [];
  record(f: Failure): void {
    this.records.push(f);
  }
  count(): number {
    return this.records.length;
  }
}

const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

// Build an Options struct with sensible defaults; specs override
// individual fields they care about.
function makeOpts(overrides: Partial<Options> = {}): Options {
  return {
    dryRun: false,
    commit: true,
    batchSize: 100,
    concurrency: 4,
    throttleMs: 0,
    resumeFrom: null,
    table: 'consumer_profiles',
    failureFile: '/tmp/should-not-be-written',
    ...overrides,
  };
}

// Fixture: a single structured ConsumerProfile row whose DEK is wrapped
// under the source KEK so the script can decrypt it.
function makeStructuredRow(sourceKekHex: string, id?: string): RawRow {
  const plaintextDek = randomBytes(32);
  const ciphertext = SourceLocalKeyManager.seedWrappedDek(sourceKekHex, plaintextDek);
  return {
    id: id ?? randomUUID(),
    payload: ciphertext,
    kekId: 'local-dev',
  };
}

// Fixture: an opaque envelope row (mirrors PiiVaultService.sealOpaque
// shape) wrapped under the source KEK.
function makeOpaqueRow(sourceKekHex: string, id?: string): RawRow {
  const plaintextDek = randomBytes(32);
  const wrapped = SourceLocalKeyManager.seedWrappedDek(sourceKekHex, plaintextDek);
  const envelope = {
    v: 1,
    ct: Buffer.from('payload-ct').toString('base64'),
    n: Buffer.from(randomBytes(12)).toString('base64'),
    dk: wrapped.toString('base64'),
    k: 'local-dev',
    aad: { scope: 'webhook_endpoint_secret', endpointId: id ?? 'ep-1' },
  };
  return {
    id: id ?? randomUUID(),
    payload: Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'),
    kekId: null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// parseArgs — sanity coverage so the CLI surface doesn't silently
// accept malformed flags during a 4am cutover.
// ─────────────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('accepts --dry-run with defaults', () => {
    const opts = parseArgs(['--dry-run']);
    expect(opts.dryRun).toBe(true);
    expect(opts.commit).toBe(false);
    expect(opts.batchSize).toBe(100);
  });

  it('accepts --commit with custom flags', () => {
    const opts = parseArgs([
      '--commit',
      '--batch-size=500',
      '--concurrency=20',
      '--throttle-ms=250',
      '--resume-from=00000000-0000-0000-0000-000000000001',
      '--table=consumer_profiles',
    ]);
    expect(opts.commit).toBe(true);
    expect(opts.batchSize).toBe(500);
    expect(opts.concurrency).toBe(20);
    expect(opts.throttleMs).toBe(250);
    expect(opts.resumeFrom).toBe('00000000-0000-0000-0000-000000000001');
    expect(opts.table).toBe('consumer_profiles');
  });

  it('rejects --dry-run + --commit together', () => {
    expect(() => parseArgs(['--dry-run', '--commit'])).toThrow(/mutually exclusive/);
  });

  it('rejects neither flag', () => {
    expect(() => parseArgs([])).toThrow(/--dry-run or --commit/);
  });

  it('rejects unknown --table', () => {
    expect(() => parseArgs(['--commit', '--table=nope'])).toThrow(/unknown --table/);
  });

  it('rejects non-integer --batch-size', () => {
    expect(() => parseArgs(['--commit', '--batch-size=abc'])).toThrow(/must be an integer/);
  });

  it('rejects --batch-size out of range', () => {
    expect(() => parseArgs(['--commit', '--batch-size=0'])).toThrow(/in \(0, 5000\]/);
  });

  it('treats --resume-from=auto specially', () => {
    const opts = parseArgs(['--commit', '--resume-from=auto']);
    expect(opts.resumeFrom).toBe('auto');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Opaque envelope helpers — shape preservation under rewrap.
// ─────────────────────────────────────────────────────────────────────

describe('opaque envelope helpers', () => {
  it('parseOpaqueEnvelope round-trips through rebuild', () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const row = makeOpaqueRow(sourceKekHex);
    const env = parseOpaqueEnvelope(row.payload as string);
    const newDk = Buffer.from('A'.repeat(32));
    const newEnv = rebuildOpaqueEnvelope(env, newDk, 'mock-kms');
    const reparsed = parseOpaqueEnvelope(newEnv);
    // Payload, nonce, AAD all unchanged.
    expect(reparsed.ct).toBe(env.ct);
    expect(reparsed.n).toBe(env.n);
    expect(reparsed.aad).toEqual(env.aad);
    // Only dk + k changed.
    expect(reparsed.k).toBe('mock-kms');
    expect(reparsed.dk).toBe(newDk.toString('base64'));
    expect(reparsed.dk).not.toBe(env.dk);
  });

  it('parseOpaqueEnvelope rejects unknown version', () => {
    const bogus = Buffer.from(JSON.stringify({ v: 9999 }), 'utf8').toString('base64');
    expect(() => parseOpaqueEnvelope(bogus)).toThrow(/unknown opaque envelope version/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// rewrapRow — per-row decision matrix (skip / rewrap / fail).
// ─────────────────────────────────────────────────────────────────────

describe('rewrapRow', () => {
  it('skips a structured row already on the destination KEK', async () => {
    const source = makeMockKm({ kekId: 'src' });
    const destination = makeMockKm({ kekId: 'dst' });
    const deps = makeDeps({ source, destination });
    const row: RawRow = {
      id: randomUUID(),
      payload: Buffer.from('opaque-bytes'),
      kekId: 'dst',
    };
    const result = await rewrapRow(TABLES.consumer_profiles, row, deps);
    expect(result).toBe('skip');
    // No KMS calls at all — idempotency guarantee.
    expect((source.decryptDataKey as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    expect((destination.wrapDataKey as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('skips an opaque row already on the destination KEK', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const row = makeOpaqueRow(sourceKekHex);
    // Manually edit the envelope to look like it's already on dst.
    const env = parseOpaqueEnvelope(row.payload as string);
    env.k = 'mock-kms';
    row.payload = Buffer.from(JSON.stringify(env), 'utf8').toString('base64');

    const source = makeMockKm({ kekId: 'src' });
    const destination = makeMockKm({ kekId: 'mock-kms' });
    const deps = makeDeps({ source, destination });
    const result = await rewrapRow(TABLES.webhook_endpoints, row, deps);
    expect(result).toBe('skip');
    expect((source.decryptDataKey as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('skips a null opaque payload (legitimately unset row)', async () => {
    const source = makeMockKm({ kekId: 'src' });
    const destination = makeMockKm({ kekId: 'dst' });
    const deps = makeDeps({ source, destination });
    const result = await rewrapRow(
      TABLES.webhook_endpoints,
      { id: randomUUID(), payload: null, kekId: null },
      deps,
    );
    expect(result).toBe('skip');
  });

  it('structured row: decrypts with source, rewraps with destination, returns new payload + new kekId', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    // Intercept wrapDataKey BEFORE the script's defensive
    // `plaintextDek.fill(0)` zeroes the buffer — we copy the bytes the
    // moment they enter the destination, otherwise the assertion sees
    // a 32-byte zero buffer (which is the correct production posture;
    // the test must work around it).
    const originalWrap = destination.wrapDataKey.bind(destination);
    let capturedDek: Buffer | null = null;
    const wrapSpy = vi
      .spyOn(destination, 'wrapDataKey')
      .mockImplementation(async (plaintext: Buffer) => {
        capturedDek = Buffer.from(plaintext);
        return originalWrap(plaintext);
      });
    const deps = makeDeps({ source, destination });

    const plaintextDek = randomBytes(32);
    const ciphertext = SourceLocalKeyManager.seedWrappedDek(sourceKekHex, plaintextDek);
    const row: RawRow = { id: randomUUID(), payload: ciphertext, kekId: 'local-dev' };

    const result = await rewrapRow(TABLES.consumer_profiles, row, deps);
    expect(result).not.toBe('skip');
    const write = result as RewrapWrite;
    expect(write.id).toBe(row.id);
    expect(write.newKekId).toBe('mock-kms');
    expect(write.oldKekId).toBe('local-dev');
    expect(Buffer.isBuffer(write.newPayload)).toBe(true);

    // The plaintext DEK passed to destination.wrapDataKey MUST equal
    // the DEK we sealed at fixture time — otherwise PII becomes
    // permanently undecryptable after cutover.
    expect(wrapSpy).toHaveBeenCalledTimes(1);
    expect(capturedDek).not.toBeNull();
    expect((capturedDek as unknown as Buffer).equals(plaintextDek)).toBe(true);

    // Sanity: destination can unwrap its own output back to the same plaintext.
    const reUnwrapped = await destination.decryptDataKey({
      ciphertext: write.newPayload as Buffer,
      kekId: 'mock-kms',
    });
    expect(reUnwrapped.equals(plaintextDek)).toBe(true);
  });

  it('opaque row: rewraps the inner dk + flips k, preserves ct/n/aad', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const deps = makeDeps({ source, destination });

    const row = makeOpaqueRow(sourceKekHex);
    const originalEnv = parseOpaqueEnvelope(row.payload as string);

    const result = await rewrapRow(TABLES.webhook_endpoints, row, deps);
    expect(result).not.toBe('skip');
    const write = result as RewrapWrite;
    expect(write.oldKekId).toBe('local-dev');
    expect(write.newKekId).toBe('mock-kms');
    const newEnv = parseOpaqueEnvelope(write.newPayload as string);
    expect(newEnv.k).toBe('mock-kms');
    expect(newEnv.ct).toBe(originalEnv.ct);
    expect(newEnv.n).toBe(originalEnv.n);
    expect(newEnv.aad).toEqual(originalEnv.aad);
    expect(newEnv.dk).not.toBe(originalEnv.dk);
  });
});

// ─────────────────────────────────────────────────────────────────────
// rewrapTable — batched loop, audit, progress, failures, resume.
// Each spec corresponds to a numbered requirement in the brief.
// ─────────────────────────────────────────────────────────────────────

describe('rewrapTable', () => {
  it('(spec #1) dry-run: decrypts every row but ZERO db writes / progress / audit', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const wrapSpy = vi.spyOn(destination, 'wrapDataKey');
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      makeStructuredRow(sourceKekHex, 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    const opts = makeOpts({ dryRun: true, commit: false, batchSize: 10 });
    const stats = await rewrapTable(TABLES.consumer_profiles, opts, deps, randomUUID());
    expect(stats.total).toBe(3);
    expect(stats.succeeded).toBe(3);
    expect(stats.failed).toBe(0);

    // Wrap was called (we computed the new envelope) — but no
    // database write fired.
    expect(wrapSpy).toHaveBeenCalledTimes(3);
    expect(db.writes).toHaveLength(0);
    expect(db.progress).toHaveLength(0);
  });

  it('(spec #2) commit: decrypts, rewraps, writes new wrapped DEK + new kek_id', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 10 }),
      deps,
      randomUUID(),
    );
    expect(stats.succeeded).toBe(2);
    expect(db.writes).toHaveLength(1);
    const batch = db.writes[0]!;
    expect(batch.rows).toHaveLength(2);
    expect(batch.rows.every((r) => r.newKekId === 'mock-kms')).toBe(true);
    expect(batch.rows.every((r) => r.oldKekId === 'local-dev')).toBe(true);
    expect(batch.rows.every((r) => Buffer.isBuffer(r.newPayload))).toBe(true);
  });

  it('(spec #3) idempotency: a row already on dst kek_id is skipped — no decrypt, no write', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const decryptSpy = vi.spyOn(source, 'decryptDataKey');
    // Row payload is irrelevant — what matters is kek_id already equals dst.
    const rows: RawRow[] = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        payload: Buffer.from('opaque-bytes-we-never-touch'),
        kekId: 'mock-kms',
      },
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 10 }),
      deps,
      randomUUID(),
    );
    expect(stats.skipped).toBe(1);
    expect(stats.succeeded).toBe(0);
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });

  it('(spec #4) resume: --resume-from cursor passes to the first fetchBatch', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      makeStructuredRow(sourceKekHex, 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({
        batchSize: 10,
        resumeFrom: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }),
      deps,
      randomUUID(),
    );
    // 2 rows STRICTLY AFTER the cursor: bbbb..., cccc...
    expect(stats.succeeded).toBe(2);
    expect(db.fetched[0]?.afterId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  });

  it('(spec #4) resume=auto: reads loadResumeCursor and continues from there', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      makeStructuredRow(sourceKekHex, 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    db.resumeCursor[jobId('consumer_profiles')] = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const deps = makeDeps({ source, destination, db });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 10, resumeFrom: 'auto' }),
      deps,
      randomUUID(),
    );
    expect(stats.succeeded).toBe(1);
    expect(db.fetched[0]?.afterId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  });

  it('(spec #5) failure handling: one row fails decryption; others still processed and logged', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const good1 = makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const good2 = makeStructuredRow(sourceKekHex, 'cccccccc-cccc-cccc-cccc-cccccccccccc');
    // Corrupt the middle row's payload (flip the last byte of the tag).
    const corruptRow = makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const bad = Buffer.from(corruptRow.payload as Buffer);
    bad[bad.length - 1] = (bad[bad.length - 1] ?? 0) ^ 0xff;
    corruptRow.payload = bad;

    const db = new InMemoryDb({ consumer_profiles: [good1, corruptRow, good2] });
    const failures = new InMemoryFailureSink();
    const deps = makeDeps({ source, destination, db, failures });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 10 }),
      deps,
      randomUUID(),
    );
    expect(stats.total).toBe(3);
    expect(stats.succeeded).toBe(2);
    expect(stats.failed).toBe(1);
    expect(failures.records).toHaveLength(1);
    expect(failures.records[0]?.rowId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(failures.records[0]?.table).toBe('consumer_profiles');

    // Two good rows did make it into the batch write.
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]?.rows).toHaveLength(2);
    expect(db.writes[0]?.rows.map((r) => r.id).sort()).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ]);
  });

  it('(spec #6) progress tracking: writes a progress row after each batch + a final finishedRun row', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      makeStructuredRow(sourceKekHex, 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
      makeStructuredRow(sourceKekHex, 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    const stats = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 2 }),
      deps,
      randomUUID(),
    );
    expect(stats.succeeded).toBe(4);
    // 2 batches of 2 rows + final finishedRun row.
    // batch 1 fetches 2 (batchSize hit → continue)
    // batch 2 fetches 2 (batchSize hit → continue)
    // batch 3 fetches 0 (empty → break)
    expect(db.progress.length).toBeGreaterThanOrEqual(2);
    const finished = db.progress.filter((p) => p.finishedRun);
    expect(finished).toHaveLength(1);
    expect(finished[0]?.lastProcessedId).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd');
    // Cumulative count on the final row equals total succeeded.
    expect(finished[0]?.countDone).toBe(4);
    expect(finished[0]?.sourceKekId).toBe('local-dev');
    expect(finished[0]?.destinationKekId).toBe('mock-kms');
  });

  it('idempotency on rerun: writing rows then running again skips all of them', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const rows = [
      makeStructuredRow(sourceKekHex, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ];
    const db = new InMemoryDb({ consumer_profiles: rows });
    const deps = makeDeps({ source, destination, db });

    await rewrapTable(TABLES.consumer_profiles, makeOpts({ batchSize: 10 }), deps, randomUUID());

    // Second run — every row now has kek_id = 'mock-kms' so the
    // skip branch fires for all of them.
    const decryptSpy = vi.spyOn(source, 'decryptDataKey');
    const stats2 = await rewrapTable(
      TABLES.consumer_profiles,
      makeOpts({ batchSize: 10 }),
      deps,
      randomUUID(),
    );
    expect(stats2.succeeded).toBe(0);
    expect(stats2.skipped).toBe(2);
    expect(decryptSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// runMigration — top-level orchestration across multiple tables.
// ─────────────────────────────────────────────────────────────────────

describe('runMigration', () => {
  it('processes a single --table when restricted, otherwise all 7 tables', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });

    // Two separate DBs — sharing one would mean the second run hits the
    // first run's already-rewrapped rows and skips them, which is the
    // correct idempotency behaviour but NOT what this spec is asserting.
    const db1 = new InMemoryDb({
      consumer_profiles: [makeStructuredRow(sourceKekHex)],
      beneficial_owners: [makeStructuredRow(sourceKekHex)],
      users_totp: [makeOpaqueRow(sourceKekHex)],
      webhook_endpoints: [makeOpaqueRow(sourceKekHex)],
      marketplaces: [makeOpaqueRow(sourceKekHex)],
      billing_configs: [makeOpaqueRow(sourceKekHex)],
      highsale_snapshots: [makeOpaqueRow(sourceKekHex)],
    });
    const db2 = new InMemoryDb({
      consumer_profiles: [makeStructuredRow(sourceKekHex)],
      beneficial_owners: [makeStructuredRow(sourceKekHex)],
      users_totp: [makeOpaqueRow(sourceKekHex)],
      webhook_endpoints: [makeOpaqueRow(sourceKekHex)],
      marketplaces: [makeOpaqueRow(sourceKekHex)],
      billing_configs: [makeOpaqueRow(sourceKekHex)],
      highsale_snapshots: [makeOpaqueRow(sourceKekHex)],
    });

    const restricted = await runMigration(
      makeOpts({ table: 'consumer_profiles', batchSize: 100 }),
      makeDeps({ source, destination, db: db1 }),
    );
    expect(restricted.summary.perTable.map((p) => p.table)).toEqual(['consumer_profiles']);

    const allOfThem = await runMigration(
      makeOpts({ table: null, batchSize: 100 }),
      makeDeps({ source, destination, db: db2 }),
    );
    expect(allOfThem.summary.perTable.map((p) => p.table).sort()).toEqual([...ALL_TABLES].sort());
    // All 7 tables had exactly one row each — totals reflect 7 succeeded.
    expect(allOfThem.summary.totals.succeeded).toBe(7);
    expect(allOfThem.exitCode).toBe(0);
  });

  it('returns exitCode=1 when any row fails', async () => {
    const sourceKekHex = randomBytes(32).toString('hex');
    const source = new SourceLocalKeyManager(sourceKekHex);
    const destination = new MockKmsKeyManager({ kekId: 'mock-kms' });
    const bad = makeStructuredRow(sourceKekHex, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    const buf = Buffer.from(bad.payload as Buffer);
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0x01;
    bad.payload = buf;
    const db = new InMemoryDb({ consumer_profiles: [bad] });
    const deps = makeDeps({ source, destination, db });

    const result = await runMigration(
      makeOpts({ table: 'consumer_profiles', batchSize: 10 }),
      deps,
    );
    expect(result.exitCode).toBe(1);
    expect(result.summary.totals.failed).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// JsonlFailureSink — appends one line per failure, survives across calls.
// ─────────────────────────────────────────────────────────────────────

describe('JsonlFailureSink', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dek-rewrap-spec-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('writes one JSON line per failure', async () => {
    const sink = new JsonlFailureSink(join(tmp, 'fails.jsonl'));
    sink.record({
      table: 'consumer_profiles',
      rowId: 'r1',
      reason: 'boom',
      occurredAt: '2026-05-27T00:00:00Z',
    });
    sink.record({
      table: 'beneficial_owners',
      rowId: 'r2',
      reason: 'kaboom',
      occurredAt: '2026-05-27T00:00:01Z',
    });
    expect(sink.count()).toBe(2);
    const { readFileSync } = await import('node:fs');
    const lines = readFileSync(join(tmp, 'fails.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ table: 'consumer_profiles', rowId: 'r1' });
    expect(JSON.parse(lines[1]!)).toMatchObject({ table: 'beneficial_owners', rowId: 'r2' });
  });
});

// ─────────────────────────────────────────────────────────────────────
// runWithConcurrency — bounded parallelism contract.
// ─────────────────────────────────────────────────────────────────────

describe('runWithConcurrency', () => {
  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);
    await runWithConcurrency(items, 5, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('processes every item exactly once', async () => {
    const seen = new Set<number>();
    const items = Array.from({ length: 17 }, (_, i) => i);
    await runWithConcurrency(items, 4, async (i) => {
      seen.add(i);
    });
    expect(seen.size).toBe(17);
  });

  it('handles concurrency > items.length without hanging', async () => {
    const items = [1, 2, 3];
    await runWithConcurrency(items, 10, async () => undefined);
    // Implicitly: no timeout.
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Helpers — shared across the specs above.
// ─────────────────────────────────────────────────────────────────────

function makeMockKm(opts: { kekId: string }): KeyManager {
  return {
    kekId: opts.kekId,
    generateDataKey: vi.fn(),
    decryptDataKey: vi.fn(),
    wrapDataKey: vi.fn(),
  } satisfies KeyManager;
}

interface DepsOverrides {
  source?: KeyManager;
  destination?: KeyManager;
  db?: DbClient;
  failures?: FailureSink;
}

function makeDeps(overrides: DepsOverrides = {}): Deps {
  return {
    source: overrides.source ?? makeMockKm({ kekId: 'src' }),
    destination: overrides.destination ?? makeMockKm({ kekId: 'dst' }),
    db: overrides.db ?? new InMemoryDb({}),
    failures: overrides.failures ?? new InMemoryFailureSink(),
    logger: silentLogger,
    sleep: async () => undefined,
  };
}
