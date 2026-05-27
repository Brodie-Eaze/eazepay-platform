import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditChainVerifier } from '../src/internal/chain-verify.cron.js';
import { LocalFsAuditSink } from '../src/adapters/local-fs-audit-sink.adapter.js';
import { S3WormAuditSink } from '../src/adapters/s3-worm.adapter.js';

/**
 * PE-AUDIT-02 — Audit hash-chain integrity verifier.
 *
 * The verifier must:
 *   - Return ok=true for a clean chain written by EITHER sink adapter
 *     (LocalFs or S3-worm-stub — they MUST share a canonical-JSON form
 *     so the verifier is sink-agnostic).
 *   - Detect a `row.hash` mutation (someone edited a row in place).
 *   - Detect a `row.prevHash` mutation (someone re-ordered or forked).
 *   - Detect a deleted row (next row's prevHash no longer matches).
 *   - Tolerate an empty / nonexistent sink root.
 */
describe('AuditChainVerifier', () => {
  let tmpRoot: string;
  let verifier: AuditChainVerifier;

  const seedRecord = (id: string, action: string, occurredAt: string) => ({
    id,
    actorType: 'user',
    actorId: 'u_1',
    action,
    targetType: 'application',
    targetId: 'app_1',
    before: null,
    after: { status: 'submitted' },
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    occurredAt,
  });

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'audit-chain-test-'));
    verifier = new AuditChainVerifier();
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('returns ok on an empty sink root', async () => {
    const result = await verifier.verify(join(tmpRoot, 'does-not-exist'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rowsVerified).toBe(0);
    }
  });

  it('verifies a clean chain written by LocalFsAuditSink', async () => {
    const sink = new LocalFsAuditSink(tmpRoot);
    await sink.put(seedRecord('r1', 'CREATE', '2026-05-01T10:00:00.000Z'));
    await sink.put(seedRecord('r2', 'UPDATE', '2026-05-01T10:01:00.000Z'));
    await sink.put(seedRecord('r3', 'SUBMIT', '2026-05-01T10:02:00.000Z'));

    const result = await verifier.verify(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rowsVerified).toBe(3);
      expect(result.filesVerified).toBe(1);
      expect(result.headHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('verifies a clean chain written by S3WormAuditSink stub', async () => {
    const sink = new S3WormAuditSink(tmpRoot);
    await sink.put(seedRecord('r1', 'CREATE', '2026-05-01T10:00:00.000Z'));
    await sink.put(seedRecord('r2', 'UPDATE', '2026-05-01T10:01:00.000Z'));

    const result = await verifier.verify(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rowsVerified).toBe(2);
    }
  });

  it('detects a row-hash mutation (edit-in-place)', async () => {
    const sink = new LocalFsAuditSink(tmpRoot);
    await sink.put(seedRecord('r1', 'CREATE', '2026-05-01T10:00:00.000Z'));
    await sink.put(seedRecord('r2', 'UPDATE', '2026-05-01T10:01:00.000Z'));

    // Tamper: change the `action` on row 1 without recomputing the hash.
    const file = join(tmpRoot, '2026-05-01.jsonl');
    const raw = await readFile(file, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const row1 = JSON.parse(lines[0]);
    row1.action = 'TAMPERED';
    lines[0] = JSON.stringify(row1);
    await writeFile(file, lines.join('\n') + '\n');

    const result = await verifier.verify(tmpRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.break.kind).toBe('row_hash_mismatch');
      expect(result.break.rowId).toBe('r1');
    }
  });

  it('detects a deleted row (chain skip)', async () => {
    const sink = new LocalFsAuditSink(tmpRoot);
    await sink.put(seedRecord('r1', 'CREATE', '2026-05-01T10:00:00.000Z'));
    await sink.put(seedRecord('r2', 'UPDATE', '2026-05-01T10:01:00.000Z'));
    await sink.put(seedRecord('r3', 'SUBMIT', '2026-05-01T10:02:00.000Z'));

    // Tamper: drop row 2.
    const file = join(tmpRoot, '2026-05-01.jsonl');
    const raw = await readFile(file, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    lines.splice(1, 1);
    await writeFile(file, lines.join('\n') + '\n');

    const result = await verifier.verify(tmpRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // After r1, the next row should be r2 — finding r3 with r2's
      // prevHash absent surfaces as a prev_hash_mismatch on r3.
      expect(result.break.kind).toBe('prev_hash_mismatch');
      expect(result.break.rowId).toBe('r3');
    }
  });

  it('detects a malformed (non-JSON) row', async () => {
    const sink = new LocalFsAuditSink(tmpRoot);
    await sink.put(seedRecord('r1', 'CREATE', '2026-05-01T10:00:00.000Z'));
    const file = join(tmpRoot, '2026-05-01.jsonl');
    const raw = await readFile(file, 'utf8');
    await writeFile(file, raw + 'not-json\n');

    const result = await verifier.verify(tmpRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.break.kind).toBe('malformed_row');
    }
  });
});
