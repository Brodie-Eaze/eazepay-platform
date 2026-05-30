/**
 * Fitness function (ISO-05 follow-up): every tenant-bearing table in
 * schema.ts MUST have an RLS tenant_isolation policy declared in a
 * migration. Fails CI the moment someone adds a new table with a
 * partner_id / target_partner_id column but forgets the RLS backstop —
 * the exact gap that left provisioning_runs / customer_migrations /
 * consent_receipts unprotected.
 *
 * Hermetic — reads source files only, no DB. Runs in normal CI.
 *
 * If you are adding a genuinely operator-only / global table that has a
 * tenant-looking column but legitimately should NOT be tenant-scoped,
 * add it to KNOWN_EXEMPT below WITH a one-line justification and call it
 * out in the PR + docs/compliance/ISO-05.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const HERE = __dirname; // apps/partner-portal/lib/db
const SCHEMA_PATH = join(HERE, 'schema.ts');
const MIGRATIONS_DIR = join(HERE, '..', '..', 'drizzle');

// Columns that mark a row as belonging to a single tenant.
const TENANT_COLUMNS = ["'partner_id'", "'target_partner_id'"];

// Tables that carry a tenant-looking column but are intentionally NOT
// RLS-scoped. Keep this list SHORT and justified.
const KNOWN_EXEMPT: Record<string, string> = {
  // (none today — every tenant-bearing table is RLS-scoped. Add here
  // only with a written justification.)
};

/** Parse `pgTable('name', {...})` blocks out of schema.ts and return,
 *  per table, whether any field declares a tenant column. */
function tenantBearingTables(schemaSrc: string): string[] {
  const out: string[] = [];
  // Match: export const x = pgTable('table_name', { ...body... },
  // We slice each table's body by locating the next `= pgTable(` boundary.
  const tableRe = /pgTable\(\s*'([a-z_]+)'/g;
  const starts: Array<{ name: string; idx: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(schemaSrc))) {
    starts.push({ name: m[1]!, idx: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const body = schemaSrc.slice(starts[i]!.idx, starts[i + 1]?.idx ?? schemaSrc.length);
    const hasTenantCol = TENANT_COLUMNS.some((col) => body.includes(`text(${col})`));
    if (hasTenantCol) out.push(starts[i]!.name);
  }
  return out;
}

/** All tables that have a `CREATE POLICY tenant_isolation ON "<table>"`
 *  in any migration .sql file. */
function tablesWithRlsPolicy(): Set<string> {
  const covered = new Set<string>();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const policyRe = /CREATE POLICY\s+tenant_isolation\s+ON\s+"([a-z_]+)"/gi;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8');
    let m: RegExpExecArray | null;
    while ((m = policyRe.exec(sql))) covered.add(m[1]!.toLowerCase());
  }
  return covered;
}

describe('RLS coverage fitness function (ISO-05)', () => {
  const schemaSrc = readFileSync(SCHEMA_PATH, 'utf-8');
  const tenantTables = tenantBearingTables(schemaSrc);
  const covered = tablesWithRlsPolicy();

  it('detects the known tenant-bearing tables (guards the parser itself)', () => {
    // Sanity: the parser must find the tables we know carry partner_id.
    for (const t of [
      'applications',
      'mids',
      'provisioning_runs',
      'customer_migrations',
      'consent_receipts',
    ]) {
      expect(tenantTables).toContain(t);
    }
  });

  it('every tenant-bearing table has an RLS tenant_isolation policy', () => {
    const missing = tenantTables.filter((t) => !covered.has(t) && !(t in KNOWN_EXEMPT));
    expect(
      missing,
      `Tenant-bearing tables missing an RLS tenant_isolation policy: ${missing.join(', ')}.\n` +
        `Add ENABLE/FORCE ROW LEVEL SECURITY + a tenant_isolation policy in a migration ` +
        `(mirror drizzle/0013 / 0020), or add the table to KNOWN_EXEMPT with a justification.`,
    ).toEqual([]);
  });
});
