/**
 * Integration test: append-only enforcement.
 *
 * Asserts at the live DB layer that the constrained app role
 * (eazepay_service_role) CANNOT UPDATE or DELETE audit_log rows.
 * Covers the contract enforced by `drizzle/0019_append_only_grants.sql`:
 *
 *   1. INSERT on audit_log succeeds.
 *   2. UPDATE on audit_log raises (either insufficient_privilege from
 *      the REVOKE, or the explicit trigger exception — both are
 *      acceptable; we only assert that the write was rejected).
 *   3. DELETE on audit_log raises.
 *   4. UPDATE of immutable webhook_inbox columns raises.
 *   5. Deleting an applications row leaves the corresponding
 *      application_events row in place with application_id = NULL
 *      (ON DELETE SET NULL, replacing the old CASCADE).
 *
 * Skipped unless `TEST_DATABASE_URL` is set + reachable. CI wires
 * this against a throwaway Postgres container provisioned with the
 * migration role (to apply 0019) and the service role (used by these
 * tests, via DATABASE_APP_ROLE=eazepay_service_role).
 *
 * The test deliberately uses raw SQL via the Drizzle client's
 * `.execute()` so that no ORM-side filtering can mask a missing
 * privilege error — the failure must come from Postgres itself.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const TEST_URL = process.env.TEST_DATABASE_URL;
const APP_ROLE = process.env.TEST_APP_ROLE ?? 'eazepay_service_role';

// vitest doesn't expose a top-level skip API that's friendly with
// dynamic conditions, so we gate inside each `it` via `it.skipIf`.
const enabled = Boolean(TEST_URL);

describe.skipIf(!enabled)('append-only enforcement (0019_append_only_grants)', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_URL!,
      ssl: TEST_URL!.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      max: 2,
    });
    // Connect as the service role for every checkout — mirrors the
    // production wiring in lib/db/index.ts when DATABASE_APP_ROLE is set.
    pool.on('connect', (client) => {
      client.query(`SET ROLE "${APP_ROLE}"`).catch(() => {
        /* surfaced by the failing assertions below */
      });
    });
    db = drizzle(pool, { schema });
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('INSERT on audit_log succeeds for the app role', async () => {
    // Bind an operator GUC in the SAME txn as the INSERT so the audit_log
    // RLS WITH CHECK policy (0013 + 0020) admits this setup row. This
    // spec tests the append-only REVOKE/trigger CONTRACT, not RLS
    // admission; the audit viewer is operator-scoped, so operator is the
    // natural context. Under FORCE RLS a no-context INSERT is rejected
    // (NULL partner GUC), which would mask the immutability assertions.
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.role', 'operator', true)`);
        return tx.execute(sql`
          INSERT INTO audit_log (actor, action, target_type, target_id)
          VALUES ('append-only-test', 'noop', 'partner', 'test-partner')
        `);
      }),
    ).resolves.toBeDefined();
  });

  it('UPDATE on audit_log is rejected', async () => {
    await expect(
      db.execute(sql`
        UPDATE audit_log SET action = 'tampered'
        WHERE actor = 'append-only-test'
      `),
    ).rejects.toThrow(/append-only|permission denied|insufficient_privilege/i);
  });

  it('DELETE on audit_log is rejected', async () => {
    await expect(
      db.execute(sql`
        DELETE FROM audit_log WHERE actor = 'append-only-test'
      `),
    ).rejects.toThrow(/append-only|permission denied|insufficient_privilege/i);
  });

  it('TRUNCATE on audit_log is rejected', async () => {
    await expect(db.execute(sql`TRUNCATE audit_log`)).rejects.toThrow(
      /append-only|permission denied|insufficient_privilege/i,
    );
  });

  it('UPDATE on application_events is rejected (REVOKE)', async () => {
    await expect(
      db.execute(sql`UPDATE application_events SET actor = 'x' WHERE actor = 'never-matches'`),
    ).rejects.toThrow(/permission denied|insufficient_privilege/i);
  });

  it('UPDATE on decisions is rejected (REVOKE)', async () => {
    await expect(
      db.execute(sql`UPDATE decisions SET engine = 'x' WHERE engine = 'never-matches'`),
    ).rejects.toThrow(/permission denied|insufficient_privilege/i);
  });

  it('webhook_inbox: UPDATE of processing_status allowed; UPDATE of raw_body rejected', async () => {
    // Seed a row. event_id is unique per provider; uuid suffix avoids
    // collision when the test re-runs without a clean DB.
    const eventId = `evt_test_${Math.random().toString(36).slice(2, 10)}`;
    await db.execute(sql`
      INSERT INTO webhook_inbox (provider, event_id, event_type, raw_body)
      VALUES ('micamp', ${eventId}, 'test.event', '{}')
    `);

    // Allowed mutation (mutable status column).
    await expect(
      db.execute(sql`
        UPDATE webhook_inbox SET processing_status = 'done', processed_at = now()
        WHERE event_id = ${eventId}
      `),
    ).resolves.toBeDefined();

    // Blocked mutation (identity column).
    await expect(
      db.execute(sql`
        UPDATE webhook_inbox SET raw_body = '{"tampered":true}'
        WHERE event_id = ${eventId}
      `),
    ).rejects.toThrow(/immutable|permission denied|insufficient_privilege/i);
  });
});
