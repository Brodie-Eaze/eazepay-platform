/**
 * Drizzle Kit configuration — partner-portal.
 *
 * `pnpm db:generate`  Reads lib/db/schema.ts, diffs against the
 *                     last applied migration, writes a new SQL
 *                     migration file into drizzle/.
 *
 * `pnpm db:migrate`   Applies pending migrations (runs scripts/migrate.ts).
 *
 * `pnpm db:push`      Skips the migration file and pushes the schema
 *                     directly. Dev only — never use against prod.
 *
 * The migration files in drizzle/ are committed to git so prod and
 * preview deployments apply the exact SQL that was reviewed in PR.
 */
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
