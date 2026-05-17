import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { sha256Hex } from '@eazepay/shared-utils';
import type { AuditSink, AuditSinkPutResult, AuditSinkRecord } from '../ports/audit-sink.port.js';

const ZERO_HASH = '0'.repeat(64);

/**
 * DEV ONLY filesystem sink. Writes one JSON-line per record to a
 * day-rolled file at <root>/<yyyy-mm-dd>.jsonl, plus a tiny pointer
 * file <root>/.head that holds the latest chained hash.
 *
 * Production swaps to a DynamoDB sink (atomic write + ConditionExpression
 * on the prev-hash to detect chain forks) plus an S3-Object-Lock cold
 * archive on a daily roll.
 *
 * Concurrency note: we serialise puts via an in-memory chain so a
 * single-process drain is consistent. A multi-process drain MUST
 * coordinate via the production sink's chain-head primitive (DynamoDB
 * conditional write) — single-replica only here.
 */
@Injectable()
export class LocalFsAuditSink implements AuditSink {
  readonly storage = 'local-fs-audit';
  private readonly logger = new Logger(LocalFsAuditSink.name);
  private chainPromise: Promise<string> = Promise.resolve(ZERO_HASH);

  constructor(private readonly rootDir: string) {}

  async put(record: AuditSinkRecord): Promise<AuditSinkPutResult> {
    // Serialise puts: each call awaits the previous chain head before
    // computing its own. The promise chain doubles as the lock.
    const next = this.chainPromise.then(async (prev) => {
      const headFromDisk = await this.readHead();
      const prevHash = headFromDisk ?? prev;
      const content = JSON.stringify(canonical(record));
      const contentHash = sha256Hex(content);
      const hash = sha256Hex(prevHash + content);
      const day = record.occurredAt.slice(0, 10);
      const file = resolve(this.rootDir, `${day}.jsonl`);
      await mkdir(dirname(file), { recursive: true });
      const line = JSON.stringify({ ...record, contentHash, hash, prevHash }) + '\n';
      await appendFile(file, line, 'utf8');
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

/** Canonical (sorted-key) JSON of an AuditSinkRecord for stable hashing. */
function canonical(record: AuditSinkRecord): Record<string, unknown> {
  // Object key order matters for sha256 stability. Build with explicit
  // ordering and recursively sort nested objects in before/after.
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
