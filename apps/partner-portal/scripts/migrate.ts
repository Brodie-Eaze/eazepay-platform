#!/usr/bin/env tsx
/**
 * Apply pending migrations. Reads `DATABASE_URL` from env and runs
 * every SQL file under `./drizzle` that hasn't been recorded in the
 * `__drizzle_migrations` table yet.
 *
 * Usage
 *   pnpm db:migrate                     (uses $DATABASE_URL)
 *   DATABASE_URL=... pnpm db:migrate
 *
 * Safety
 *   • Runs in a single transaction per file
 *   • Records applied filename + checksum in `__drizzle_migrations`
 *   • Refuses to run if a previously-applied migration's checksum
 *     no longer matches the file on disk (someone edited an applied
 *     migration). The right fix is always a new follow-up migration.
 *   • Idempotent: every statement in 0001_init.sql is guarded
 *     IF NOT EXISTS / DO $$ ... EXCEPTION so a half-applied run can
 *     be safely retried.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', 'drizzle');
const LEDGER_TABLE = '__drizzle_migrations';

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL not set. Aborting.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    max: 2,
  });

  try {
    // Ledger table — stores which migrations have been applied.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "${LEDGER_TABLE}" (
        id          serial PRIMARY KEY,
        filename    text NOT NULL UNIQUE,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      );
    `);

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    if (files.length === 0) {
      console.log('[migrate] No migration files found in', MIGRATIONS_DIR);
      return;
    }

    const { rows: applied } = await pool.query<{
      filename: string;
      checksum: string;
    }>(`SELECT filename, checksum FROM "${LEDGER_TABLE}";`);
    const appliedMap = new Map(applied.map((r) => [r.filename, r.checksum]));

    for (const filename of files) {
      const sqlPath = join(MIGRATIONS_DIR, filename);
      const sql = await readFile(sqlPath, 'utf-8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prevChecksum = appliedMap.get(filename);

      if (prevChecksum && prevChecksum !== checksum) {
        console.error(
          `[migrate] Refusing to run: ${filename} was applied with a different checksum.\n` +
            `         Edits to applied migrations are not allowed — add a new follow-up migration instead.\n` +
            `         Recorded: ${prevChecksum}\n` +
            `         On disk:  ${checksum}`,
        );
        process.exit(2);
      }
      if (prevChecksum) {
        console.log(`[migrate] ✓ ${filename} (already applied)`);
        continue;
      }

      console.log(`[migrate] → applying ${filename}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO "${LEDGER_TABLE}" (filename, checksum) VALUES ($1, $2);`, [
          filename,
          checksum,
        ]);
        await client.query('COMMIT');
        console.log(`[migrate] ✓ ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    console.log('[migrate] done.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
