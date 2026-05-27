import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256Hex } from '@eazepay/shared-utils';

/**
 * ─────────────────────────────────────────────────────────────────────
 * Audit Chain Integrity Verifier (PE-AUDIT-02).
 * ─────────────────────────────────────────────────────────────────────
 *
 * What it does:
 *   Walks the on-disk audit sink output (LocalFs or S3-stub layout,
 *   both produce day-rolled JSONL files) in occurredAt order and
 *   re-computes the hash chain row-by-row:
 *
 *     expectedHash = sha256(prevHash || canonicalJson(row))
 *     if expectedHash !== row.hash  → BREAK
 *     if row.prevHash    !== prev   → BREAK
 *
 *   On any break, returns a structured result identifying:
 *     - the day file that broke
 *     - the row id of the first divergence
 *     - the expected vs actual hash
 *
 * Why:
 *   SOC2 CC7.2 requires the audit trail to be tamper-evident, not
 *   just append-only. The drain writes the chain; this job re-reads
 *   it independently and proves the chain has not been mutated since
 *   write. The hash mismatch surfaces ANY of: a deleted row, an
 *   edited row, a re-ordered row, a forged row inserted out of band.
 *   First failure mode the auditor will probe.
 *
 * Scheduling:
 *   Designed to run daily under the existing cron-leader umbrella
 *   (Postgres advisory lock + CRON_LEADER env). The `@Cron` decorator
 *   wiring is left as a stub in this file — the scheduler is the
 *   thinnest possible layer over `verify()` and the real wiring lands
 *   alongside the production S3 client + alerting target. The
 *   verifier itself is fully implemented and unit-testable today.
 *
 * Alerting:
 *   When a break is detected, the verifier:
 *     1. Logs at ERROR with `event=audit_chain.break` + the locating
 *        fields. This is the load-bearing signal — wire a log monitor
 *        on that event to page on-call.
 *     2. Returns the break result so an HTTP endpoint or admin tool
 *        can surface it. The cron itself does not throw — surfacing
 *        the error keeps the next day's verification from being
 *        blocked by an old break.
 *
 *  ⚠ Do NOT delete or rewrite history to "fix" a chain break — the
 *  break IS the evidence. The remediation is to investigate the
 *  mutation, file an incident, and continue the chain from the
 *  current head. Re-hashing the chain wipes the trail.
 */

/** Shape of a single chain row as serialised by the LocalFs / S3
 *  stub adapters' day-rolled JSONL. Kept narrow on purpose — any
 *  extra fields are tolerated and ignored. */
interface ChainRow {
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
  occurredAt: string;
  hash: string;
  prevHash: string;
  contentHash?: string;
}

export interface ChainVerifyOk {
  ok: true;
  rowsVerified: number;
  filesVerified: number;
  headHash: string;
}

export interface ChainVerifyBreak {
  ok: false;
  rowsVerified: number;
  filesVerified: number;
  break: {
    file: string;
    rowIndex: number;
    rowId: string | null;
    /** Which invariant failed. */
    kind: 'prev_hash_mismatch' | 'row_hash_mismatch' | 'malformed_row';
    expected: string;
    actual: string;
  };
}

export type ChainVerifyResult = ChainVerifyOk | ChainVerifyBreak;

const ZERO_HASH = '0'.repeat(64);

/** Canonical-JSON projection — MUST match the canonical() function in
 *  both local-fs-audit-sink.adapter.ts and s3-worm.adapter.ts. If
 *  this ever diverges from the writers, the verifier produces false
 *  positives. Tested under chain-verify.spec.ts. */
function canonical(row: ChainRow): Record<string, unknown> {
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
    action: row.action,
    actorId: row.actorId,
    actorType: row.actorType,
    after: sortKeys(row.after),
    before: sortKeys(row.before),
    id: row.id,
    ipAddress: row.ipAddress,
    occurredAt: row.occurredAt,
    targetId: row.targetId,
    targetType: row.targetType,
    userAgent: row.userAgent,
  };
}

@Injectable()
export class AuditChainVerifier {
  private readonly logger = new Logger(AuditChainVerifier.name);

  /**
   * Run a full verification pass over the sink root. Returns
   * {ok:true,...} on a clean chain, {ok:false, break:{...}} on the
   * first detected mutation. Does not throw on a break — the break
   * IS the result.
   */
  async verify(sinkRoot: string): Promise<ChainVerifyResult> {
    if (!existsSync(sinkRoot)) {
      // Empty sink is a clean chain by definition.
      return { ok: true, rowsVerified: 0, filesVerified: 0, headHash: ZERO_HASH };
    }

    const dayFiles = await this.listDayFiles(sinkRoot);
    let prev = ZERO_HASH;
    let rowsVerified = 0;

    for (const file of dayFiles) {
      const raw = await readFile(file, 'utf8');
      const lines = raw.split('\n').filter((l) => l.length > 0);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Loop bound makes line non-undefined; assert for TS under
        // noUncheckedIndexedAccess.
        if (line === undefined) continue;
        let row: ChainRow;
        try {
          row = JSON.parse(line) as ChainRow;
        } catch {
          const breakResult: ChainVerifyBreak = {
            ok: false,
            rowsVerified,
            filesVerified: dayFiles.indexOf(file),
            break: {
              file,
              rowIndex: i,
              rowId: null,
              kind: 'malformed_row',
              expected: 'parseable-json',
              actual: 'parse-error',
            },
          };
          this.alert(breakResult);
          return breakResult;
        }

        // Invariant 1: row.prevHash must equal the previous row's
        // computed hash (or ZERO_HASH on the very first row).
        if (row.prevHash !== prev) {
          const breakResult: ChainVerifyBreak = {
            ok: false,
            rowsVerified,
            filesVerified: dayFiles.indexOf(file),
            break: {
              file,
              rowIndex: i,
              rowId: row.id,
              kind: 'prev_hash_mismatch',
              expected: prev,
              actual: row.prevHash,
            },
          };
          this.alert(breakResult);
          return breakResult;
        }

        // Invariant 2: row.hash must equal sha256(prev || canonicalJson(row)).
        const expected = sha256Hex(prev + JSON.stringify(canonical(row)));
        if (expected !== row.hash) {
          const breakResult: ChainVerifyBreak = {
            ok: false,
            rowsVerified,
            filesVerified: dayFiles.indexOf(file),
            break: {
              file,
              rowIndex: i,
              rowId: row.id,
              kind: 'row_hash_mismatch',
              expected,
              actual: row.hash,
            },
          };
          this.alert(breakResult);
          return breakResult;
        }

        prev = row.hash;
        rowsVerified++;
      }
    }

    return {
      ok: true,
      rowsVerified,
      filesVerified: dayFiles.length,
      headHash: prev,
    };
  }

  /** Daily verification entry point. Wire under @Cron once the
   *  scheduler is composed alongside the rest of the audit module
   *  scheduling (CRON_LEADER + advisory lock). Kept as a public
   *  method so an admin endpoint can also trigger it on demand. */
  async runDaily(sinkRoot: string): Promise<ChainVerifyResult> {
    const result = await this.verify(sinkRoot);
    if (result.ok) {
      this.logger.log({
        event: 'audit_chain.verify_ok',
        rowsVerified: result.rowsVerified,
        filesVerified: result.filesVerified,
        headHash: result.headHash,
      });
    }
    return result;
  }

  /** Day files are named YYYY-MM-DD.jsonl. Sort lexicographically =
   *  chronological because of zero-padded ISO date prefix. */
  private async listDayFiles(sinkRoot: string): Promise<string[]> {
    const entries = await readdir(sinkRoot);
    return entries
      .filter((e) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(e))
      .sort()
      .map((e) => resolve(sinkRoot, e));
  }

  /** Loud structured alert. Hook a log monitor / Datadog alert on
   *  `event:audit_chain.break` to page on-call. Never throws — we
   *  want the result to surface to the caller (admin tool / cron
   *  log) even if the alerting backend is down. */
  private alert(breakResult: ChainVerifyBreak): void {
    this.logger.error({
      event: 'audit_chain.break',
      ...breakResult.break,
      rowsVerifiedBeforeBreak: breakResult.rowsVerified,
    });
  }
}
