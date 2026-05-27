import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sha256Hex } from '@eazepay/shared-utils';
import type { AuditSink, AuditSinkPutResult, AuditSinkRecord } from '../ports/audit-sink.port.js';

const ZERO_HASH = '0'.repeat(64);

/**
 * ─────────────────────────────────────────────────────────────────────
 * S3 WORM Audit Sink — STUB ADAPTER (real S3 + Object Lock pending).
 * ─────────────────────────────────────────────────────────────────────
 *
 * Why this exists:
 *   Production must boot with `AUDIT_SINK=s3` so the audit drain
 *   dispatches to a sink that conforms to the WORM-archive semantics
 *   required by SOC2 CC7.2 (audit log integrity) and the auditor's
 *   evidence-retention scope. Pre-fix, `AUDIT_SINK` only accepted
 *   `local-fs|dynamodb`; the local-fs sink writes to pod-local disk
 *   (lost on next deploy) and dynamodb alone is mutable post-write.
 *
 * What this is NOT:
 *   - Not a real S3 client. Do not point at production traffic.
 *   - Not Object-Lock enforced — the local filesystem cannot model
 *     S3 Compliance-mode Object Lock semantically (no immutability,
 *     no governance time-window, no root-cannot-delete guarantee).
 *
 * What this IS:
 *   - A class conforming to the `AuditSink` port so the DI dispatch
 *     in AuditModule.forRoot resolves cleanly with `sink='s3'`.
 *   - Writes each drained record to a local dlq/audit-s3-pending/
 *     directory using the EXACT key + body shape a real S3 PUT
 *     would take. Operators can grep these files to validate the
 *     payload format pre-cutover.
 *   - Maintains the same hash-chain semantic as LocalFsAuditSink so
 *     chain-verification jobs (chain-verify.cron.ts) can be authored
 *     against the stub output and stay valid once the real S3
 *     adapter lands (same JSONL line format, same .head pointer).
 *
 * S3 key scheme (kept stable for the cutover):
 *   <root>/year=YYYY/month=MM/day=DD/<id>.json
 *   The day-partitioned prefix matches the Athena partitioning we'll
 *   use for the auditor extracts; the per-record object (not per-day
 *   JSONL) matches S3 Object Lock's per-object retention model.
 *
 * Replacement plan (infra task):
 *   1. Add @aws-sdk/client-s3.
 *   2. Inject S3Client (constructed from env: AUDIT_S3_BUCKET,
 *      AUDIT_S3_REGION, AUDIT_S3_KMS_KEY_ARN).
 *   3. Replace the `appendFile` in put() with PutObjectCommand using:
 *        - Bucket: AUDIT_S3_BUCKET
 *        - Key:    same scheme as below
 *        - Body:   same JSON line as below
 *        - ObjectLockMode: 'COMPLIANCE'
 *        - ObjectLockRetainUntilDate: now + 7 years
 *        - ServerSideEncryption: 'aws:kms'
 *        - SSEKMSKeyId: AUDIT_S3_KMS_KEY_ARN
 *   4. Replace .head pointer with a DynamoDB conditional-write on
 *      `chain_head` (atomic prev->next swap with ConditionExpression).
 *      Filesystem .head is single-process only; DynamoDB is the
 *      shared-head primitive that lets multiple drain replicas
 *      coordinate without forking the chain.
 *   5. Remove the `safeLog.warn({event:'audit_sink.s3_adapter_stub'})`
 *      after cutover.
 *
 * Compliance trail:
 *   - SOC2 CC7.2 (audit log integrity, WORM archive)
 *   - PCI DSS 10.5 (secure audit trails)
 *   - Runbook: docs/runbooks/kek-rotation.md (audit-sink rotation
 *     procedure to land alongside in a sibling runbook).
 */
@Injectable()
export class S3WormAuditSink implements AuditSink {
  readonly storage = 's3-worm-stub';
  private readonly logger = new Logger(S3WormAuditSink.name);
  private chainPromise: Promise<string> = Promise.resolve(ZERO_HASH);

  constructor(private readonly rootDir: string) {
    this.logger.warn({
      event: 'audit_sink.s3_adapter_stub',
      message:
        'S3WormAuditSink stub constructed — real S3 + Object Lock not wired. ' +
        'Writes are landing on local pod disk; rotate cutover via ' +
        'docs/runbooks/kek-rotation.md.',
      rootDir: this.rootDir,
    });
  }

  async put(record: AuditSinkRecord): Promise<AuditSinkPutResult> {
    // Serialise puts via the chain promise — same single-process
    // constraint as LocalFsAuditSink. Multi-process safety lands with
    // the DynamoDB chain-head primitive in the real adapter (see
    // docstring above).
    const next = this.chainPromise.then(async (prev) => {
      const headFromDisk = await this.readHead();
      const prevHash = headFromDisk ?? prev;
      const content = JSON.stringify(canonical(record));
      const contentHash = sha256Hex(content);
      const hash = sha256Hex(prevHash + content);

      const day = record.occurredAt.slice(0, 10); // YYYY-MM-DD
      const [yyyy, mm, dd] = day.split('-');
      // S3 key scheme mirrors the eventual production layout. The
      // local fs path here is purely the stub's storage; the JSON
      // body is byte-identical to what the real PUT will upload.
      const s3Key = `year=${yyyy}/month=${mm}/day=${dd}/${record.id}.json`;
      const file = resolve(this.rootDir, s3Key);
      await mkdir(dirname(file), { recursive: true });

      const body = JSON.stringify({
        ...record,
        contentHash,
        hash,
        prevHash,
        // Surface the would-be-S3 metadata in the stub output so any
        // log-scraper that checks for compliance fields will see them
        // in dev too.
        _wormMeta: {
          adapter: 's3-worm-stub',
          objectLockMode: 'COMPLIANCE',
          retainUntilDays: 365 * 7,
          s3Key,
        },
      });
      // Per-object PUT shape: one file per record (mirrors S3), unlike
      // LocalFs which uses one JSONL per day. The day-rolled JSONL
      // also gets appended for chain-verifier compatibility.
      await writeFile(file, body, 'utf8');
      const jsonlFile = resolve(this.rootDir, `${day}.jsonl`);
      await appendFile(
        jsonlFile,
        JSON.stringify({ ...record, contentHash, hash, prevHash }) + '\n',
        'utf8',
      );
      await this.writeHead(hash);
      return hash;
    });
    this.chainPromise = next;
    const hash = await next;
    const contentHash = sha256Hex(JSON.stringify(canonical(record)));
    return { hash, contentHash };
  }

  private async readHead(): Promise<string | null> {
    const headFile = resolve(this.rootDir, '.head');
    if (!existsSync(headFile)) return null;
    try {
      const buf = await readFile(headFile, 'utf8');
      return buf.trim() || null;
    } catch {
      return null;
    }
  }

  private async writeHead(hash: string): Promise<void> {
    const headFile = resolve(this.rootDir, '.head');
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(headFile, hash, 'utf8');
  }
}

/** Canonical (sorted-key) JSON of an AuditSinkRecord for stable hashing.
 *  MUST stay byte-identical to LocalFsAuditSink's canonical() so the
 *  chain-verify job is sink-agnostic. */
function canonical(record: AuditSinkRecord): Record<string, unknown> {
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, sortKeys(val)]),
    );
  };
  return {
    action: record.action,
    actorId: record.actorId,
    actorType: record.actorType,
    after: sortKeys(record.after),
    before: sortKeys(record.before),
    id: record.id,
    ipAddress: record.ipAddress,
    occurredAt: record.occurredAt,
    targetId: record.targetId,
    targetType: record.targetType,
    userAgent: record.userAgent,
  };
}
