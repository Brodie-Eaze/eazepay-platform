#!/usr/bin/env tsx
/**
 * PRIV-002 backfill — encrypt historical plaintext consumer PII.
 *
 * Run AFTER migration 0020 (which adds the `_enc` + `_bidx` columns and
 * drops NOT NULL on the plaintext columns) and BEFORE the deferred 0021
 * (which drops the plaintext columns).
 *
 *     pnpm db:backfill:priv002            # encrypt all un-encrypted rows
 *     pnpm db:backfill:priv002 --verify   # verify _enc decrypts == plaintext
 *
 * The migration fix (0020 + the route changes) stops NEW rows from being
 * written in plaintext. This script fixes EXISTING rows. Skipping it
 * would leave every pre-fix application's PII in the clear — exactly the
 * finding an auditor re-tests.
 *
 * PROPERTIES
 * ----------
 * • Idempotent: only rows where `consumer_first_enc IS NULL` are touched.
 *   A second run is a no-op once every row is encrypted.
 * • Restartable: processed in keyset-paginated batches ordered by id; a
 *   crash mid-run resumes from the next un-encrypted row.
 * • AAD-correct: each ciphertext is sealed via `sealApplicationPii(id, …)`
 *   so the AAD binds to the SAME row id the runtime read path uses —
 *   otherwise every backfilled row would fail to decrypt on read.
 * • Audited: writes one `audit_log` row (actor='system:backfill-priv002')
 *   recording how many rows were encrypted, so the remediation itself is
 *   on the audit trail an examiner can cite.
 *
 * ENV REQUIRED (same keys the runtime uses):
 *   DATABASE_URL (or MIGRATION_DATABASE_URL), KEY_MANAGER, LOCAL_KEK_HEX,
 *   EDGE_PII_BLIND_INDEX_KEY.
 */

import { Pool } from 'pg';
import { decryptApplicationRow, sealApplicationPii } from '../lib/db/applications-pii';

const BATCH = 500;

interface PlaintextRow {
  id: string;
  consumer_first: string | null;
  consumer_last: string | null;
  consumer_email: string | null;
  consumer_phone: string | null;
  consumer_first_enc: string | null;
}

function resolveUrl(): string {
  const url =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    console.error('[backfill-priv002] DATABASE_URL not set. Aborting.');
    process.exit(1);
  }
  return url;
}

function makePool(url: string): Pool {
  return new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    max: 2,
  });
}

/** Encrypt every row whose `_enc` columns are still NULL. */
async function runBackfill(pool: Pool): Promise<number> {
  let encrypted = 0;
  // Keyset pagination on id. Each pass grabs the next BATCH of rows that
  // still need encryption; because we filter on `consumer_first_enc IS
  // NULL`, completed rows fall out of the result set and the loop
  // terminates naturally. Restartable: re-running resumes here.
  for (;;) {
    const { rows } = await pool.query<PlaintextRow>(
      `SELECT id, consumer_first, consumer_last, consumer_email, consumer_phone, consumer_first_enc
         FROM applications
        WHERE consumer_first_enc IS NULL
        ORDER BY id ASC
        LIMIT $1`,
      [BATCH],
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      // A row could legitimately have NULL plaintext only if 0021 already
      // ran (columns dropped) — but then this SELECT would error. With
      // 0020 applied and 0021 pending, plaintext is present. Guard anyway.
      if (
        row.consumer_first == null ||
        row.consumer_last == null ||
        row.consumer_email == null ||
        row.consumer_phone == null
      ) {
        console.warn(
          `[backfill-priv002] row ${row.id} has NULL plaintext + NULL ciphertext — skipping (manual review)`,
        );
        continue;
      }
      const sealed = await sealApplicationPii(row.id, {
        consumerFirst: row.consumer_first,
        consumerLast: row.consumer_last,
        consumerEmail: row.consumer_email,
        consumerPhone: row.consumer_phone,
      });
      // Only update rows still un-encrypted (defends against a concurrent
      // runtime write having sealed it between SELECT and UPDATE).
      await pool.query(
        `UPDATE applications
            SET consumer_first_enc = $2,
                consumer_last_enc  = $3,
                consumer_email_enc = $4,
                consumer_phone_enc = $5,
                consumer_email_bidx = $6
          WHERE id = $1 AND consumer_first_enc IS NULL`,
        [
          row.id,
          sealed.consumerFirstEnc,
          sealed.consumerLastEnc,
          sealed.consumerEmailEnc,
          sealed.consumerPhoneEnc,
          sealed.consumerEmailBidx,
        ],
      );
      encrypted += 1;
    }
    console.log(`[backfill-priv002] encrypted ${encrypted} rows so far…`);
  }
  return encrypted;
}

/** Verify mode: confirm every `_enc` column decrypts back to the
 *  plaintext column. Read-only. Exits non-zero on any mismatch so it can
 *  gate the 0021 drop in CI/ops. */
async function runVerify(pool: Pool): Promise<number> {
  let checked = 0;
  let mismatches = 0;
  for (;;) {
    const { rows } = await pool.query<
      PlaintextRow & {
        consumer_last_enc: string | null;
        consumer_email_enc: string | null;
        consumer_phone_enc: string | null;
      }
    >(
      `SELECT id, consumer_first, consumer_last, consumer_email, consumer_phone,
              consumer_first_enc, consumer_last_enc, consumer_email_enc, consumer_phone_enc
         FROM applications
        WHERE consumer_first_enc IS NOT NULL
        ORDER BY id ASC
        OFFSET $1 LIMIT $2`,
      [checked, BATCH],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const pii = await decryptApplicationRow({
        id: row.id,
        consumerFirstEnc: row.consumer_first_enc,
        consumerLastEnc: row.consumer_last_enc,
        consumerEmailEnc: row.consumer_email_enc,
        consumerPhoneEnc: row.consumer_phone_enc,
      });
      // Email was lowercased on seal; compare against the same normalization.
      const expectEmail = (row.consumer_email ?? '').trim().toLowerCase();
      if (
        pii.consumerFirst !== row.consumer_first ||
        pii.consumerLast !== row.consumer_last ||
        pii.consumerEmail !== expectEmail ||
        pii.consumerPhone !== row.consumer_phone
      ) {
        mismatches += 1;
        console.error(`[backfill-priv002] VERIFY MISMATCH on row ${row.id}`);
      }
    }
    checked += rows.length;
  }
  console.log(`[backfill-priv002] verified ${checked} rows, ${mismatches} mismatch(es).`);
  return mismatches;
}

/** Count rows still holding un-encrypted plaintext (the auditor metric). */
async function countRemaining(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM applications WHERE consumer_first_enc IS NULL`,
  );
  return Number(rows[0]?.n ?? '0');
}

/** Write the remediation onto the audit trail. Best-effort: the table
 *  exists once 0001 ran; if the constrained role lacks INSERT we log and
 *  continue rather than fail the backfill. */
async function writeAudit(pool: Pool, encrypted: number, remaining: number): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
       VALUES ('system:backfill-priv002', 'pii.encrypt.backfill', 'applications', NULL, $1)`,
      [
        JSON.stringify({
          control: 'PRIV-002',
          encrypted,
          remaining_plaintext_unencrypted: remaining,
        }),
      ],
    );
  } catch (err) {
    console.warn('[backfill-priv002] could not write audit_log row:', (err as Error).message);
  }
}

async function main() {
  const verify = process.argv.includes('--verify');
  const pool = makePool(resolveUrl());
  try {
    if (verify) {
      const mismatches = await runVerify(pool);
      const remaining = await countRemaining(pool);
      console.log(`[backfill-priv002] remaining un-encrypted rows: ${remaining}`);
      process.exit(mismatches === 0 && remaining === 0 ? 0 : 3);
    }
    const encrypted = await runBackfill(pool);
    const remaining = await countRemaining(pool);
    await writeAudit(pool, encrypted, remaining);
    console.log(
      `[backfill-priv002] done. encrypted=${encrypted} remaining_plaintext_unencrypted=${remaining}`,
    );
    if (remaining > 0) {
      console.warn(
        '[backfill-priv002] some rows still un-encrypted (likely NULL plaintext) — review before applying 0021.',
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[backfill-priv002] failed:', err);
  process.exit(1);
});
