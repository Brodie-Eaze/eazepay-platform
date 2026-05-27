import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { canonicalJson, type AuditRow } from '@eazepay/integrations-core';
import {
  S3AuditWormAdapter,
  loadS3AuditWormConfigFromEnv,
} from '../src/adapters/s3-audit-worm.adapter.js';

/**
 * Acceptance:
 *   - WORM writes carry GOVERNANCE Object Lock + 7yr retain-until +
 *     SSE-KMS with the configured customer key.
 *   - S3 errors are mapped to a typed `AuditSinkError` with a correct
 *     `retryable` flag — KMS denial = terminal, throttle = retryable.
 *   - Read returns rows in lex-stable order across pages so a chain
 *     verifier can replay deterministically.
 *   - verifyDay re-computes the chain with real `crypto.createHash` —
 *     no mocked hashing — so the test catches the literal hash rule.
 *   - Construction refuses to boot if AUDIT_S3_BUCKET is missing.
 */

const ZERO_HASH = '0'.repeat(64);
const FIXED_NOW = new Date('2026-05-27T12:00:00.000Z');
const KMS_KEY_ID = 'arn:aws:kms:us-east-1:111122223333:key/test-key';
const BUCKET = 'eaze-audit-worm-test';
const REGION = 'us-east-1';

/** Real-crypto sha256 hex — the adapter's chain rule is verified
 *  against the canonical SDK, NOT a mock. */
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Build a chained row from a payload object. */
function makeRow(opts: {
  id: string;
  prevHash: string;
  payload: Record<string, unknown>;
  writtenAt?: string;
}): AuditRow {
  const hash = sha256(opts.prevHash + canonicalJson(opts.payload));
  return {
    id: opts.id,
    prevHash: opts.prevHash,
    hash,
    payload: opts.payload,
    writtenAt: opts.writtenAt ?? FIXED_NOW.toISOString(),
  };
}

function jsonlBody(row: AuditRow): string {
  return (
    JSON.stringify({
      id: row.id,
      prevHash: row.prevHash,
      hash: row.hash,
      payload: row.payload,
      writtenAt: row.writtenAt,
    }) + '\n'
  );
}

function buildAdapter(): { adapter: S3AuditWormAdapter; s3Mock: ReturnType<typeof mockClient> } {
  const client = new S3Client({ region: REGION });
  const s3Mock = mockClient(client);
  const adapter = new S3AuditWormAdapter({
    bucket: BUCKET,
    region: REGION,
    kmsKeyId: KMS_KEY_ID,
    now: () => FIXED_NOW,
    client,
  });
  return { adapter, s3Mock };
}

describe('S3AuditWormAdapter', () => {
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  describe('append', () => {
    it('puts to the right Hive-partitioned key with GOVERNANCE Object Lock + 7yr retain + KMS', async () => {
      const { adapter, s3Mock } = buildAdapter();
      s3Mock.on(PutObjectCommand).resolves({ ETag: '"deadbeef"', VersionId: 'v1' });

      const row = makeRow({
        id: '11111111-1111-1111-1111-111111111111',
        prevHash: ZERO_HASH,
        payload: { action: 'application.approved', applicationId: 'app_1' },
        writtenAt: '2026-05-27T12:34:56.789Z',
      });
      const result = await adapter.append(row);

      expect(result.etag).toBe('deadbeef');
      expect(result.versionId).toBe('v1');

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      const input = calls[0]!.args[0].input;
      expect(input.Bucket).toBe(BUCKET);
      expect(input.Key).toBe(
        'audit/year=2026/month=05/day=27/11111111-1111-1111-1111-111111111111.jsonl',
      );
      expect(input.ServerSideEncryption).toBe('aws:kms');
      expect(input.SSEKMSKeyId).toBe(KMS_KEY_ID);
      expect(input.ObjectLockMode).toBe('GOVERNANCE');
      expect(input.ContentType).toBe('application/x-ndjson');
      expect(input.Metadata).toEqual({
        audit_id: '11111111-1111-1111-1111-111111111111',
        prev_hash: ZERO_HASH,
      });

      // Retain-until is exactly 7 years from the fixed `now()`.
      const retain = input.ObjectLockRetainUntilDate as Date;
      const expectedRetain = new Date(FIXED_NOW.getTime() + 7 * 365.25 * 24 * 60 * 60 * 1000);
      expect(retain.toISOString()).toBe(expectedRetain.toISOString());

      // Body is a single JSONL line.
      const body = String(input.Body);
      expect(body.endsWith('\n')).toBe(true);
      expect(JSON.parse(body.trim())).toEqual({
        id: row.id,
        prevHash: row.prevHash,
        hash: row.hash,
        payload: row.payload,
        writtenAt: row.writtenAt,
      });
    });

    it('wraps a KMS access denied error as AuditSinkError({retryable: false})', async () => {
      const { adapter, s3Mock } = buildAdapter();
      const kmsErr = Object.assign(new Error('Access denied to the KMS key'), {
        name: 'KMSAccessDeniedException',
        $metadata: { httpStatusCode: 400 },
      });
      s3Mock.on(PutObjectCommand).rejects(kmsErr);

      const row = makeRow({
        id: '22222222-2222-2222-2222-222222222222',
        prevHash: ZERO_HASH,
        payload: { action: 'noop' },
      });

      await expect(adapter.append(row)).rejects.toMatchObject({
        name: 'AuditSinkError',
        code: 'KMSAccessDeniedException',
        retryable: false,
      });
    });

    it('wraps an S3 throttle as AuditSinkError({retryable: true})', async () => {
      const { adapter, s3Mock } = buildAdapter();
      const throttleErr = Object.assign(new Error('Rate exceeded'), {
        name: 'ThrottlingException',
        $metadata: { httpStatusCode: 429 },
        $retryable: { throttling: true },
      });
      s3Mock.on(PutObjectCommand).rejects(throttleErr);

      const row = makeRow({
        id: '33333333-3333-3333-3333-333333333333',
        prevHash: ZERO_HASH,
        payload: { action: 'noop' },
      });

      await expect(adapter.append(row)).rejects.toMatchObject({
        name: 'AuditSinkError',
        code: 'ThrottlingException',
        retryable: true,
      });
    });
  });

  describe('read', () => {
    it('returns rows in stable lex order across a multi-page list response', async () => {
      const { adapter, s3Mock } = buildAdapter();
      const day = new Date('2026-05-27T00:00:00.000Z');
      const prefix = 'audit/year=2026/month=05/day=27/';

      const rowA = makeRow({
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        prevHash: ZERO_HASH,
        payload: { seq: 1 },
      });
      const rowBPayload = { seq: 2 };
      const rowB = makeRow({
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        prevHash: rowA.hash,
        payload: rowBPayload,
      });
      const rowCPayload = { seq: 3 };
      const rowC = makeRow({
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        prevHash: rowB.hash,
        payload: rowCPayload,
      });

      const keyA = `${prefix}${rowA.id}.jsonl`;
      const keyB = `${prefix}${rowB.id}.jsonl`;
      const keyC = `${prefix}${rowC.id}.jsonl`;

      // Page 1: returns B then A (out of lex order on purpose to prove
      // the adapter sorts). Truncated; continuation returns C.
      s3Mock
        .on(ListObjectsV2Command, { Bucket: BUCKET, Prefix: prefix })
        .resolvesOnce({
          Contents: [
            { Key: keyB, ETag: '"b"' },
            { Key: keyA, ETag: '"a"' },
          ],
          IsTruncated: true,
          NextContinuationToken: 'token-2',
        })
        .resolvesOnce({
          Contents: [{ Key: keyC, ETag: '"c"' }],
          IsTruncated: false,
        });

      s3Mock
        .on(GetObjectCommand, { Bucket: BUCKET, Key: keyA })
        .resolves({ Body: Readable.from([Buffer.from(jsonlBody(rowA))]) as never });
      s3Mock
        .on(GetObjectCommand, { Bucket: BUCKET, Key: keyB })
        .resolves({ Body: Readable.from([Buffer.from(jsonlBody(rowB))]) as never });
      s3Mock
        .on(GetObjectCommand, { Bucket: BUCKET, Key: keyC })
        .resolves({ Body: Readable.from([Buffer.from(jsonlBody(rowC))]) as never });

      const collected: AuditRow[] = [];
      for await (const r of adapter.read(day)) {
        collected.push(r);
      }
      expect(collected.map((r) => r.id)).toEqual([rowA.id, rowB.id, rowC.id]);
    });
  });

  describe('verifyDay', () => {
    it('returns {ok: true} for a valid contiguous chain', async () => {
      const { adapter, s3Mock } = buildAdapter();
      const day = new Date('2026-05-27T00:00:00.000Z');
      const prefix = 'audit/year=2026/month=05/day=27/';

      const r1 = makeRow({
        id: 'a1111111-1111-1111-1111-111111111111',
        prevHash: ZERO_HASH,
        payload: { seq: 1, action: 'a' },
      });
      const r2 = makeRow({
        id: 'b2222222-2222-2222-2222-222222222222',
        prevHash: r1.hash,
        payload: { seq: 2, action: 'b' },
      });
      const r3 = makeRow({
        id: 'c3333333-3333-3333-3333-333333333333',
        prevHash: r2.hash,
        payload: { seq: 3, action: 'c' },
      });

      const rows = [r1, r2, r3];
      s3Mock.on(ListObjectsV2Command, { Bucket: BUCKET, Prefix: prefix }).resolves({
        Contents: rows.map((r) => ({ Key: `${prefix}${r.id}.jsonl`, ETag: `"${r.id}"` })),
        IsTruncated: false,
      });
      for (const r of rows) {
        s3Mock
          .on(GetObjectCommand, { Bucket: BUCKET, Key: `${prefix}${r.id}.jsonl` })
          .resolves({ Body: Readable.from([Buffer.from(jsonlBody(r))]) as never });
      }

      const result = await adapter.verifyDay(day);
      expect(result).toEqual({ ok: true });
    });

    it('returns {ok: false, breaks: [...]} when one row hash is tampered', async () => {
      const { adapter, s3Mock } = buildAdapter();
      const day = new Date('2026-05-27T00:00:00.000Z');
      const prefix = 'audit/year=2026/month=05/day=27/';

      const r1 = makeRow({
        id: 'a1111111-1111-1111-1111-111111111111',
        prevHash: ZERO_HASH,
        payload: { seq: 1, action: 'a' },
      });
      const r2 = makeRow({
        id: 'b2222222-2222-2222-2222-222222222222',
        prevHash: r1.hash,
        payload: { seq: 2, action: 'b' },
      });
      // Tamper r2 by changing the payload AFTER hash computed.
      const r2Tampered: AuditRow = { ...r2, payload: { seq: 2, action: 'BAD' } };
      const r3 = makeRow({
        id: 'c3333333-3333-3333-3333-333333333333',
        prevHash: r2.hash,
        payload: { seq: 3, action: 'c' },
      });

      const rows = [r1, r2Tampered, r3];
      s3Mock.on(ListObjectsV2Command, { Bucket: BUCKET, Prefix: prefix }).resolves({
        Contents: rows.map((r) => ({ Key: `${prefix}${r.id}.jsonl`, ETag: `"${r.id}"` })),
        IsTruncated: false,
      });
      for (const r of rows) {
        s3Mock
          .on(GetObjectCommand, { Bucket: BUCKET, Key: `${prefix}${r.id}.jsonl` })
          .resolves({ Body: Readable.from([Buffer.from(jsonlBody(r))]) as never });
      }

      const result = await adapter.verifyDay(day);
      expect(result.ok).toBe(false);
      expect(result.breaks).toBeDefined();
      const breaks = result.breaks ?? [];
      // The tampered row's recomputed hash will not match the stored hash.
      const hashMismatch = breaks.find(
        (b) => b.rowId === r2Tampered.id && b.reason === 'hash_mismatch',
      );
      expect(hashMismatch).toBeDefined();
      expect(hashMismatch!.observedHash).toBe(r2Tampered.hash);
      expect(hashMismatch!.expectedHash).toBe(
        sha256(r2Tampered.prevHash + canonicalJson(r2Tampered.payload)),
      );
    });
  });

  describe('construction', () => {
    it('loadS3AuditWormConfigFromEnv throws if AUDIT_S3_BUCKET is unset', () => {
      const env: NodeJS.ProcessEnv = {
        AUDIT_S3_REGION: 'us-east-1',
        AUDIT_KMS_KEY_ID: 'arn:aws:kms:...',
      };
      expect(() => loadS3AuditWormConfigFromEnv(env)).toThrow(/AUDIT_S3_BUCKET/);
    });

    it('loadS3AuditWormConfigFromEnv throws if AUDIT_S3_REGION is unset', () => {
      const env: NodeJS.ProcessEnv = {
        AUDIT_S3_BUCKET: 'b',
        AUDIT_KMS_KEY_ID: 'k',
      };
      expect(() => loadS3AuditWormConfigFromEnv(env)).toThrow(/AUDIT_S3_REGION/);
    });

    it('loadS3AuditWormConfigFromEnv throws if AUDIT_KMS_KEY_ID is unset', () => {
      const env: NodeJS.ProcessEnv = {
        AUDIT_S3_BUCKET: 'b',
        AUDIT_S3_REGION: 'us-east-1',
      };
      expect(() => loadS3AuditWormConfigFromEnv(env)).toThrow(/AUDIT_KMS_KEY_ID/);
    });

    it('loadS3AuditWormConfigFromEnv defaults BATCH_SIZE to 1', () => {
      const cfg = loadS3AuditWormConfigFromEnv({
        AUDIT_S3_BUCKET: 'b',
        AUDIT_S3_REGION: 'us-east-1',
        AUDIT_KMS_KEY_ID: 'k',
      });
      expect(cfg.batchSize).toBe(1);
    });

    it('loadS3AuditWormConfigFromEnv rejects invalid BATCH_SIZE', () => {
      expect(() =>
        loadS3AuditWormConfigFromEnv({
          AUDIT_S3_BUCKET: 'b',
          AUDIT_S3_REGION: 'us-east-1',
          AUDIT_KMS_KEY_ID: 'k',
          AUDIT_S3_BATCH_SIZE: 'not-a-number',
        }),
      ).toThrow(/AUDIT_S3_BATCH_SIZE/);

      expect(() =>
        loadS3AuditWormConfigFromEnv({
          AUDIT_S3_BUCKET: 'b',
          AUDIT_S3_REGION: 'us-east-1',
          AUDIT_KMS_KEY_ID: 'k',
          AUDIT_S3_BATCH_SIZE: '0',
        }),
      ).toThrow(/AUDIT_S3_BATCH_SIZE/);
    });
  });

  it('append throws an unretryable AuditSinkError for an Object Lock retention violation', async () => {
    // why: ObjectLock violations are terminal (the row needs a human
    // — break-glass override under GOVERNANCE). Retrying just burns
    // KMS quota and never succeeds.
    const { adapter, s3Mock } = buildAdapter();
    const violationErr = Object.assign(new Error('Retention period cannot be shortened'), {
      name: 'InvalidRetentionPeriod',
      $metadata: { httpStatusCode: 400 },
    });
    s3Mock.on(PutObjectCommand).rejects(violationErr);

    const row = makeRow({
      id: '44444444-4444-4444-4444-444444444444',
      prevHash: ZERO_HASH,
      payload: { action: 'x' },
    });

    await expect(adapter.append(row)).rejects.toMatchObject({
      name: 'AuditSinkError',
      code: 'InvalidRetentionPeriod',
      retryable: false,
    });
  });
});
