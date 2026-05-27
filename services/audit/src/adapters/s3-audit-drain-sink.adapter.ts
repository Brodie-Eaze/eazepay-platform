import { Injectable, Logger } from '@nestjs/common';
import { sha256Hex } from '@eazepay/shared-utils';
import { canonicalJson, type AuditSink as WormAuditSink } from '@eazepay/integrations-core';
import type {
  AuditSink as DrainAuditSink,
  AuditSinkPutResult,
  AuditSinkRecord,
} from '../ports/audit-sink.port.js';

/** Genesis prevHash for a fresh chain. */
const ZERO_HASH = '0'.repeat(64);

/**
 * Bridge between the drain's `AuditSink.put(record)` port (computes the
 * chain inside the sink) and the WORM `AuditSink.append(row)` port
 * (writer pre-computes the chain). The drain emits one record at a
 * time; the bridge serialises emissions via a promise chain so the
 * hash chain is contiguous in emit order even under concurrent
 * `put()` calls.
 *
 * Single-replica drain: this assumes ONE process owns the chain head
 * — which is enforced by `CronLeaderService` (pg_try_advisory_lock at
 * LOCK_ID_AUDIT_DRAIN). The in-memory chain head is bootstrapped to
 * the all-zero hash on cold start; replays of already-emitted rows
 * are safe because the WORM tier's S3 key (`audit/.../<row.id>.jsonl`)
 * is idempotent on the row uuid — re-puts overwrite the same object,
 * the chain still verifies, and ObjectLock keeps the original
 * retention window.
 */
@Injectable()
export class S3AuditDrainSink implements DrainAuditSink {
  readonly storage = 's3-aws-audit';
  private readonly logger = new Logger(S3AuditDrainSink.name);
  private chainPromise: Promise<string> = Promise.resolve(ZERO_HASH);

  constructor(private readonly worm: WormAuditSink) {}

  async put(record: AuditSinkRecord): Promise<AuditSinkPutResult> {
    const payload = toCanonicalPayload(record);
    const content = canonicalJson(payload);
    const contentHash = sha256Hex(content);

    const next = this.chainPromise.then(async (prevHash) => {
      const hash = sha256Hex(prevHash + content);
      await this.worm.append({
        id: record.id,
        prevHash,
        hash,
        payload,
        writtenAt: record.occurredAt,
      });
      return hash;
    });
    // Capture the chain promise BEFORE awaiting so a concurrent put
    // sees the new head. If `append()` throws, swap back to the
    // previous head so the chain doesn't dead-end on a transient
    // failure (the drain re-tries the row next sweep).
    const prevChain = this.chainPromise;
    this.chainPromise = next.catch(() => prevChain);

    const hash = await next;
    return { hash, contentHash };
  }
}

/** Canonical (sorted-key) payload object derived from an
 *  `AuditSinkRecord`. The WORM adapter re-canonicalises on its own
 *  for verifyDay, but the drain bridge canonicalises here to keep
 *  the chain hash stable. */
function toCanonicalPayload(record: AuditSinkRecord): Record<string, unknown> {
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
