/**
 * Integration test: SOC 2 / isolation-assessment fixes (ISO-05, ISO-02,
 * EX-005). Live-DB counterpart to the hermetic `tenant-rls.spec.ts`.
 *
 * Asserts at the real Postgres layer the contracts enforced by:
 *   - drizzle/0020_rls_coverage_completion.sql
 *   - drizzle/0021_consent_receipts_immutability.sql
 *
 * Coverage:
 *   ISO-05  RLS now scopes provisioning_runs / customer_migrations /
 *           consent_receipts by tenant (a partner session can't read
 *           another partner's rows; operator sees all; no-context
 *           fails closed).
 *   ISO-02  audit_log admits the FCRA soft-pull row (target_type=
 *           'application') under a partner session when the application
 *           belongs to that partner, and REJECTS a forged row pointed
 *           at another tenant's application.
 *   EX-005  consent_receipts is append-only to the app role (UPDATE /
 *           DELETE / TRUNCATE blocked) while the privileged migration
 *           role can still crypto-shred (RTBF). The no-GUC FCRA verifier
 *           read path keeps working (would otherwise 412 every pull).
 *
 * Skipped unless `TEST_DATABASE_URL` is set + reachable, mirroring
 * `append-only.spec.ts`. CI wires this against a throwaway Postgres
 * with 0001..0021 applied via the migration role, then runs these
 * tests as the service role (DATABASE_APP_ROLE / TEST_APP_ROLE =
 * eazepay_service_role). The migration-role checks use a SECOND pool
 * connected as TEST_MIGRATION_ROLE (defaults to eazepay_migration_role).
 *
 * Every statement runs through `.execute()` raw SQL inside an explicit
 * transaction so the RLS GUCs are SET LOCAL and can't leak across
 * cases — and so no ORM-side filtering masks a Postgres-level decision.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const TEST_URL = process.env.TEST_DATABASE_URL;
const APP_ROLE = process.env.TEST_APP_ROLE ?? 'eazepay_service_role';
const MIGRATION_ROLE = process.env.TEST_MIGRATION_ROLE ?? 'eazepay_migration_role';
const enabled = Boolean(TEST_URL);

// Stable fixture ids — suffixed per-run so re-runs against a dirty DB
// don't collide on the append-only tables. `RUN` is a 6-char base36
// token for the text ids; `HEX` is a 12-char hex token for the uuid
// node segment (applications.id is a real uuid column).
const RUN = Math.random().toString(36).slice(2, 8);
const HEX = Math.floor(Math.random() * 0xffffffffffff)
  .toString(16)
  .padStart(12, '0')
  .slice(0, 12);
const ACME = `p_acme_${RUN}`;
const OTHER = `p_other_${RUN}`;
const APP_ACME = `11111111-1111-1111-1111-${HEX}`;
const APP_OTHER = `22222222-2222-2222-2222-${HEX}`;
const RCPT_ACME = `rcpt_acme_${RUN}`;

function poolFor(role: string): Pool {
  const pool = new Pool({
    connectionString: TEST_URL!,
    ssl: TEST_URL!.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
    // max: 1 so GUC state can't leak across connections between cases —
    // each statement runs on the single pooled connection and every
    // helper below explicitly binds (or resets) the GUCs in its own txn.
    max: 1,
  });
  pool.on('connect', (client) => {
    client.query(`SET ROLE "${role}"`).catch(() => {
      /* surfaced by the failing assertions below */
    });
  });
  return pool;
}

/** Run `fn` inside a txn with the RLS GUCs bound via SET LOCAL. */
async function withCtx<T>(
  db: NodePgDatabase<typeof schema>,
  partnerId: string | null,
  role: string,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_partner_id', ${partnerId ?? ''}, true)`);
    await tx.execute(sql`SELECT set_config('app.role', ${role}, true)`);
    return fn(tx);
  });
}

/**
 * Run `fn` inside a txn with BOTH GUCs explicitly RESET — deterministic
 * simulation of the no-context server-side path (the FCRA verifier
 * `getReceiptById` + the consumer-capture `storeReceipt`, neither of
 * which is wrapped in withTenantContext). RESET LOCAL clears any value a
 * prior pooled txn left behind so `current_setting('app.role', true)`
 * is genuinely NULL — exactly what those code paths see in production.
 */
async function withNoCtx<T>(
  db: NodePgDatabase<typeof schema>,
  fn: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`RESET app.current_partner_id`);
    await tx.execute(sql`RESET app.role`);
    return fn(tx);
  });
}

async function count(rows: { rows: unknown[] }): Promise<number> {
  const r = rows.rows[0] as { n?: string | number } | undefined;
  return Number(r?.n ?? 0);
}

describe.skipIf(!enabled)('RLS coverage completion (0020) + consent immutability (0021)', () => {
  let appPool: Pool;
  let migPool: Pool;
  let appDb: NodePgDatabase<typeof schema>;
  let migDb: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    appPool = poolFor(APP_ROLE);
    migPool = poolFor(MIGRATION_ROLE);
    appDb = drizzle(appPool, { schema });
    migDb = drizzle(migPool, { schema });

    // Seed as the migration role (BYPASSRLS) so fixtures land regardless
    // of the policies under test.
    await migDb.execute(sql`
      INSERT INTO partners (id, brand, legal_name) VALUES
        (${ACME}, 'medpay', 'Acme'), (${OTHER}, 'medpay', 'Other')
      ON CONFLICT (id) DO NOTHING`);
    await migDb.execute(sql`
      INSERT INTO applications (id, brand, partner_id, consumer_first, consumer_last, consumer_email, consumer_phone, amount_cents)
      VALUES (${APP_ACME}, 'medpay', ${ACME}, 'A', 'B', 'a@b.com', '5551234', 100000),
             (${APP_OTHER}, 'medpay', ${OTHER}, 'C', 'D', 'c@d.com', '5559876', 100000)
      ON CONFLICT (id) DO NOTHING`);
    await migDb.execute(sql`
      INSERT INTO provisioning_runs (id, partner_id, brand, status)
      VALUES (gen_random_uuid(), ${ACME}, 'medpay', 'done'),
             (gen_random_uuid(), ${OTHER}, 'medpay', 'done')`);
    await migDb.execute(sql`
      INSERT INTO customer_migrations (id, source_customer_id, target_partner_id, status)
      VALUES (gen_random_uuid(), ${'c_' + ACME}, ${ACME}, 'done'),
             (gen_random_uuid(), ${'c_' + OTHER}, ${OTHER}, 'done')`);
    await migDb.execute(sql`
      INSERT INTO consent_receipts (id, application_id, partner_id, brand, disclosure_version, captured_ip, signature_hash, raw_text)
      VALUES (${RCPT_ACME}, ${APP_ACME}, ${ACME}, 'medpay', 'v3', '1.2.3.4', 'h', 'consumer authorized')`);
  });

  afterAll(async () => {
    if (appPool) await appPool.end();
    if (migPool) await migPool.end();
  });

  // -------- ISO-05 --------

  it('ISO-05: provisioning_runs scoped — partner sees only its own row', async () => {
    const acme = await withCtx(appDb, ACME, 'partner', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM provisioning_runs WHERE partner_id = ${ACME}`),
    );
    // The partner session is blocked from even seeing the other partner's
    // row, so a global count returns ONLY its own.
    const all = await withCtx(appDb, ACME, 'partner', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM provisioning_runs`),
    );
    expect(await count(acme)).toBe(1);
    expect(await count(all)).toBe(1); // pre-fix this was 2 (leak)
  });

  it('ISO-05: customer_migrations scoped by target_partner_id', async () => {
    const all = await withCtx(appDb, ACME, 'partner', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM customer_migrations`),
    );
    expect(await count(all)).toBe(1); // pre-fix: 2
  });

  it('ISO-05: operator sees all provisioning_runs', async () => {
    const all = await withCtx(appDb, null, 'operator', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM provisioning_runs`),
    );
    expect(await count(all)).toBeGreaterThanOrEqual(2);
  });

  it('ISO-05: no-context session fails closed (zero rows)', async () => {
    const none = await withCtx(appDb, null, 'none', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM provisioning_runs`),
    );
    expect(await count(none)).toBe(0);
  });

  it('ISO-05: consent_receipts — a partner cannot read another tenant receipt', async () => {
    const other = await withCtx(appDb, OTHER, 'partner', (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM consent_receipts WHERE id = ${RCPT_ACME}`),
    );
    expect(await count(other)).toBe(0);
  });

  it('ISO-05 / ISO-01 guard: the FCRA verifier no-GUC read path still works', async () => {
    // verifyFCRAConsent runs getReceiptById with NO withTenantContext.
    // A strict policy would return 0 here and 412 every soft pull.
    const found = await withNoCtx(appDb, (tx) =>
      tx.execute(sql`SELECT count(*) AS n FROM consent_receipts WHERE id = ${RCPT_ACME}`),
    );
    expect(await count(found)).toBe(1);
  });

  // -------- ISO-02 --------

  it('ISO-02: FCRA soft-pull audit row for the OWN application is admitted', async () => {
    await expect(
      withCtx(appDb, ACME, 'partner', (tx) =>
        tx.execute(sql`
          INSERT INTO audit_log (actor, action, target_type, target_id)
          VALUES ('consumer:prequal', 'credit_pull.soft', 'application', ${APP_ACME})`),
      ),
    ).resolves.toBeDefined();
  });

  it('ISO-02: a partner CANNOT forge an audit row against another tenant application', async () => {
    await expect(
      withCtx(appDb, ACME, 'partner', (tx) =>
        tx.execute(sql`
          INSERT INTO audit_log (actor, action, target_type, target_id)
          VALUES ('consumer:prequal', 'credit_pull.soft', 'application', ${APP_OTHER})`),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('ISO-02: operator can still write any target_type', async () => {
    await expect(
      withCtx(appDb, null, 'operator', (tx) =>
        tx.execute(sql`
          INSERT INTO audit_log (actor, action, target_type, target_id)
          VALUES ('demo:master', 'mid.paused', 'mid', ${'mid_' + RUN})`),
      ),
    ).resolves.toBeDefined();
  });

  // -------- EX-005 --------

  it('EX-005: app role can INSERT a consent receipt (append-only allows writes)', async () => {
    // The consumer-capture writer runs with no tenant context.
    await expect(
      withNoCtx(appDb, (tx) =>
        tx.execute(sql`
          INSERT INTO consent_receipts (id, application_id, partner_id, brand, disclosure_version, captured_ip, signature_hash, raw_text)
          VALUES (${'rcpt_im_' + RUN}, ${APP_ACME}, ${ACME}, 'medpay', 'v3', '1.1.1.1', 'h', 'text')`),
      ),
    ).resolves.toBeDefined();
  });

  it('EX-005: app role UPDATE on consent_receipts is blocked', async () => {
    await expect(
      withNoCtx(appDb, (tx) =>
        tx.execute(
          sql`UPDATE consent_receipts SET raw_text = 'TAMPER' WHERE id = ${'rcpt_im_' + RUN}`,
        ),
      ),
    ).rejects.toThrow(/append-only|permission denied|insufficient_privilege/i);
  });

  it('EX-005: app role DELETE on consent_receipts is blocked', async () => {
    await expect(
      withNoCtx(appDb, (tx) =>
        tx.execute(sql`DELETE FROM consent_receipts WHERE id = ${'rcpt_im_' + RUN}`),
      ),
    ).rejects.toThrow(/append-only|permission denied|insufficient_privilege/i);
  });

  it('EX-005: app role TRUNCATE on consent_receipts is blocked', async () => {
    await expect(
      withNoCtx(appDb, (tx) => tx.execute(sql`TRUNCATE consent_receipts`)),
    ).rejects.toThrow(/append-only|permission denied|insufficient_privilege/i);
  });

  it('EX-005 RTBF: the privileged migration role CAN crypto-shred PII columns', async () => {
    await expect(
      migDb.execute(sql`
        UPDATE consent_receipts SET raw_text = '[REDACTED]', captured_ip = '[REDACTED]'
        WHERE id = ${'rcpt_im_' + RUN}`),
    ).resolves.toBeDefined();
    const row = await migDb.execute(
      sql`SELECT raw_text FROM consent_receipts WHERE id = ${'rcpt_im_' + RUN}`,
    );
    expect((row.rows[0] as { raw_text: string }).raw_text).toBe('[REDACTED]');
  });
});
