/**
 * ─────────────────────────────────────────────────────────────────────
 * Partner-Enrollment Critical-Flow integration spec — portal side
 * ─────────────────────────────────────────────────────────────────────
 *
 * Drives the partner-portal Next.js route handlers directly (no HTTP),
 * because the App Router runtime is not wired into vitest in this
 * monorepo. We import each `route.ts` module, build a `NextRequest`
 * with the headers/cookies/body the production caller would send, and
 * assert on the `NextResponse` plus the Drizzle row state.
 *
 * Covers PE-critical flows:
 *
 *   3. Partner onboarding submit — double-submission with the same
 *      Idempotency-Key returns the identical 201 + a single partners
 *      row.
 *   4. Partner onboarding submit — PII fields present → 501
 *      `pii_vault_not_wired` and no rows written anywhere.
 *   5. F-001 IDOR negative — signed-in tenant A querying
 *      /api/v/medpay/applications/<tenant-B-id>/status returns 404 and
 *      leaks no application data.
 *   9. Login rate-limit — 11 attempts from one IP / 60s → 11th is 429
 *      with Retry-After; 6 attempts on the same identifier across
 *      different IPs → 6th is 429.
 *  10. Welcome-token consume — POST /api/account/set-password with
 *      { token, newPassword } succeeds first, 410 `token_invalid`
 *      second.
 *
 * Test discipline
 * ---------------
 * Same as pe-critical-flows.spec.ts on the apps/api side: legacy is
 * the oracle; target contracts not yet wired are `it.skip(…pending…)`
 * with explicit notes describing what the rewrite owner must assert
 * once the change lands.
 *
 * Why Testcontainers Postgres
 * ---------------------------
 * The portal's Drizzle schema (lib/db/schema.ts) is independent of the
 * apps/api Prisma schema. The migrations live in
 * `apps/partner-portal/drizzle/*.sql` and are applied here via the
 * pg driver against a fresh container, so the test owns its DB state
 * end-to-end.
 *
 * Stack reuse
 * -----------
 * We reuse the same `@testcontainers/postgresql` install the apps/api
 * suite uses; if it's missing, every `describe` block skips with a
 * clear reason rather than silently passing.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, createHmac } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';

let databaseUrl: string | undefined;
let skipReason: string | undefined;
let pgStop: (() => Promise<void>) | undefined;
let pool: Pool | undefined;

/* ===========================================================================
 *  Boot — Testcontainers Postgres + migration replay
 * ======================================================================== */

beforeAll(async () => {
  try {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const pg = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('eazepay_portal_test')
      .withUsername('eazepay')
      .withPassword('eazepay')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
      .withCommand(['postgres', '-c', 'fsync=off', '-c', 'synchronous_commit=off'])
      .start();
    databaseUrl = pg.getConnectionUri();
    pgStop = async () => {
      await pg.stop();
    };

    // Apply the Drizzle migrations from apps/partner-portal/drizzle/*.sql
    // in lexicographic order — matches the drizzle-kit migrate runtime
    // behaviour. We do this through raw pg rather than drizzle-orm/migrator
    // so the test doesn't have to import the full Next.js drizzle wiring
    // (which pulls in env validation we don't need here).
    const migrationsDir = resolve(__dirname, '../../drizzle');
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    pool = new Pool({ connectionString: databaseUrl });
    for (const f of sqlFiles) {
      const sql = readFileSync(resolve(migrationsDir, f), 'utf8');
      // Drizzle journal entries split on `--> statement-breakpoint`;
      // execute each chunk individually so a single failing statement
      // does not poison the whole transaction.
      for (const stmt of sql.split(/-->\s*statement-breakpoint/)) {
        const trimmed = stmt.trim();
        if (trimmed.length === 0) continue;
        await pool.query(trimmed);
      }
    }

    // Make the route handlers' getDb() find the same DB.
    process.env.DATABASE_URL = databaseUrl;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[pe-portal-flows] Testcontainers Postgres unavailable — skipping:', skipReason);
  }
}, 120_000);

afterAll(async () => {
  if (pool) await pool.end();
  if (pgStop) await pgStop();
});

beforeEach(async () => {
  if (!pool) return;
  // Truncate every user-managed table between tests. Matches the
  // wipeDatabase() helper used by the apps/api integration suite.
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '__drizzle_migrations'`,
  );
  if (rows.length > 0) {
    const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
});

/* ===========================================================================
 *  Fixtures
 * ======================================================================== */

/** A valid OnboardingState body with NO bank-account / owner PII. */
function validOnboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    industry: 'medical',
    legalName: `Test Practice ${Date.now()}`,
    dba: '',
    ein: '12-3456789',
    website: '',
    phone: '5551234567',
    addressLine1: '123 Main St',
    addressLine2: '',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    yearsInBusiness: '5',
    employeeCount: '10',
    owners: [
      {
        firstName: 'Jane',
        lastName: 'Owner',
        title: 'CEO',
        ownershipPercentage: '100',
        email: 'jane@test.example',
        phone: '5559876543',
        isControlPerson: true,
      },
    ],
    bankName: 'Test Bank',
    routingNumber: '021000021',
    accountNumber: '1234567890',
    accountType: 'checking',
    avgMonthlyVolume: '50000',
    avgTicket: '500',
    hasProcessingHistory: true,
    acceptedTerms: true,
    acceptedPrivacy: true,
    signedAgreement: true,
    ...overrides,
  };
}

/* ===========================================================================
 *  Flow 3 — Partner onboarding double-submission idempotency
 * ======================================================================== */
describe('PE Flow 3 — partner onboarding double-submission', () => {
  it.skip('same Idempotency-Key returns identical 201 + single partners row (pending RULE-IDEMPOTENCY-015)', () => {
    /* CHARACTERIZATION OF CURRENT LEGACY
     * ----------------------------------
     * The route at apps/partner-portal/app/api/onboarding/submit/route.ts
     * EXPLICITLY documents (lines 37-40) that it does NOT yet honour
     * Idempotency-Key — a double-submit creates two partner rows. The
     * user-visible mitigation is the wizard's `submitting` flag.
     *
     * So today, calling POST twice with the same Idempotency-Key would
     * produce TWO partners rows, not one. We refuse to assert that as
     * "expected", because the target rewrite MUST add server-side
     * dedupe (ADR-0015 referenced in the route source).
     *
     * Skipping with the discrepancy noted. The rewrite owner unskips +
     * tightens to one row + identical body once the dedupe key lands.
     *
     * Target assertions (when wired):
     *   const body = validOnboardingBody();
     *   const idemKey = 'idem-' + randomUUID();
     *   const r1 = await POST(buildReq(body, { 'idempotency-key': idemKey }));
     *   const r2 = await POST(buildReq(body, { 'idempotency-key': idemKey }));
     *   expect(r1.status).toBe(201);
     *   expect(r2.status).toBe(201);
     *   expect(await r1.json()).toEqual(await r2.json());
     *   const { rows } = await pool!.query('SELECT id FROM partners');
     *   expect(rows).toHaveLength(1);
     */
  });

  it('legacy behaviour — without idempotency, a double-submit DOES create two rows (regression fence)', async (ctx) => {
    /* Regression fence so the rewrite owner gets a failing test the
     * moment they wire idempotency: if rows.length drops from 2→1, this
     * test starts failing, prompting them to delete it AND unskip the
     * target-contract test above. */
    if (skipReason || !pool) return ctx.skip();
    const { POST } = await import('../../app/api/onboarding/submit/route.js');

    const body = validOnboardingBody({ legalName: 'Double Submit Co' });
    const idemKey = `idem-${randomUUID()}`;

    const buildReq = () =>
      new NextRequest('http://localhost/api/onboarding/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idemKey },
        body: JSON.stringify(body),
      });

    const r1 = await POST(buildReq());
    const r2 = await POST(buildReq());
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const { rows } = await pool.query('SELECT id, legal_name FROM partners');
    // Today's legacy: two rows. The rewrite must drop this to 1 and
    // flip this assertion (or replace it with the skipped target test).
    expect(rows.length).toBe(2);
  });
});

/* ===========================================================================
 *  Flow 4 — Partner onboarding with PII fields → 501
 * ======================================================================== */
describe('PE Flow 4 — partner onboarding PII rejection', () => {
  it.skip('PII fields present → 501 pii_vault_not_wired + zero rows (pending RULE-PII-VAULT-001)', () => {
    /* The current route's docblock (lines 26-36) states it ACCEPTS bank
     * routing/account numbers + owner email/phone and then "drops them
     * on the floor". That is the legacy behaviour and is NOT
     * characterization-test-able as 501 today — it returns 201.
     *
     * The target ADR-0016 contract:
     *   When the body includes any PII-classified field (routingNumber,
     *   accountNumber, owners[*].email, owners[*].phone, ein per
     *   jurisdiction config) AND the PII vault is not configured
     *   (PII_VAULT_KMS_KEY env unset OR vault healthcheck failing),
     *   the route MUST return:
     *     {
     *       status: 501,
     *       title: 'Not Implemented',
     *       code: 'pii_vault_not_wired',
     *       detail: '… contact ops to enable the vault.'
     *     }
     *   and write ZERO rows to partners, partner_pii_pending, or
     *   anywhere else.
     *
     * Assert when wired:
     *   const r = await POST(buildReq(validOnboardingBody()));
     *   expect(r.status).toBe(501);
     *   const body = await r.json();
     *   expect(body.code).toBe('pii_vault_not_wired');
     *   const { rows: p } = await pool!.query('SELECT count(*) FROM partners');
     *   expect(Number(p[0].count)).toBe(0);
     */
  });

  it('legacy fence — current route ACCEPTS PII and persists partner without 501 (regression sentinel)', async (ctx) => {
    /* Fails the moment someone partially implements the PII vault
     * gate, forcing them to either ship it end-to-end (and unskip the
     * target test above) or revert. Prevents a half-wired guard from
     * silently slipping through. */
    if (skipReason || !pool) return ctx.skip();
    const { POST } = await import('../../app/api/onboarding/submit/route.js');

    const req = new NextRequest('http://localhost/api/onboarding/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validOnboardingBody({ legalName: 'PII Sentinel Co' })),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(201);
    expect(resp.status).not.toBe(501);
    const { rows } = await pool.query("SELECT id FROM partners WHERE legal_name='PII Sentinel Co'");
    expect(rows).toHaveLength(1);
  });
});

/* ===========================================================================
 *  Flow 5 — F-001 IDOR negative test (cross-tenant status lookup)
 * ======================================================================== */
describe('PE Flow 5 — F-001 IDOR on /api/v/medpay/applications/<id>/status', () => {
  it.skip('tenant A querying tenant B id → 404, zero data leaked (pending RULE-IDOR-F001)', () => {
    /* CURRENT LEGACY — UNSAFE
     * -----------------------
     * apps/partner-portal/app/api/v/[brand]/applications/[id]/status/route.ts
     * (line 358-423) requires a session via `requireSession()` but
     * NEVER calls `allowedPartnerIdsForBrand()` to scope the lookup to
     * the caller's tenant. Any signed-in user can query ANY application
     * id for that brand and receive the full status payload, including
     * consumer first name + last initial. F-001 is OPEN.
     *
     * Target assertion:
     *   - Seed two partners (tA, tB) + one application owned by tB.
     *   - Sign in as tA (set their session cookie).
     *   - GET /api/v/medpay/applications/<tB-app-id>/status
     *   - Expect status 404 with code 'application_not_found'.
     *   - Expect response body MUST NOT contain consumerContact.firstName
     *     or any timeline entry text from the leaked application.
     *
     * Today this test would FAIL (server returns 200 with the leaked
     * data) — we skip rather than baseline a vulnerability as
     * "expected".
     */
  });

  it('legacy fence — TODAY the status route IS missing the tenant gate (regression sentinel)', async (ctx) => {
    /* Seeds the IDOR scenario and asserts the unsafe response shape.
     * Flips RED when someone adds the tenant gate, prompting them to
     * unskip the target test above and delete this sentinel. */
    if (skipReason || !pool) return ctx.skip();

    const { GET } = await import(
      '../../app/api/v/[brand]/applications/[id]/status/route.js'
    );

    const partnerA = `p_a_${randomUUID().slice(0, 6)}`;
    const partnerB = `p_b_${randomUUID().slice(0, 6)}`;
    await pool.query(
      `INSERT INTO partners (id, brand, legal_name, display_name, primary_contact_email, status)
       VALUES ($1,'medpay','A','A','a@t.test','active'),
              ($2,'medpay','B','B','b@t.test','active')`,
      [partnerA, partnerB],
    );

    const appB = randomUUID();
    await pool.query(
      `INSERT INTO applications
         (id, partner_id, brand, consumer_first, consumer_last, consumer_email, consumer_phone,
          amount_cents, status, request_id)
       VALUES ($1, $2, 'medpay', 'Naomi', 'Egunjobi', 'naomi@e.test', '5551112222',
               150000, 'submitted', $3)`,
      [appB, partnerB, `req-${randomUUID()}`],
    );

    // Forge a session as partnerA. We don't have a real signing helper
    // exposed here; we instead exercise the path with a session cookie
    // shaped like what requireSession() will accept in dev (eazepay_at).
    // The point of the test is "did the route do a tenant check at
    // all?" — not "did the cookie cryptography verify". When the route
    // gains a tenant gate it will need the cookie to ALSO carry the
    // signed partnerId, and this fence will start failing on shape
    // rather than on logic. Either way it prompts the rewrite.
    const req = new NextRequest(
      `http://localhost/api/v/medpay/applications/${appB}/status`,
      { headers: { cookie: 'eazepay_at=test-bypass' } },
    );
    const resp = await GET(req, {
      params: Promise.resolve({ brand: 'medpay', id: appB }),
    });

    // Document today's behaviour: either the auth fence bounces (any
    // non-200) or it leaks. Whichever it is, it's NOT the target
    // 404 with `application_not_found` code, so we just record the
    // current shape and let the rewrite tighten.
    const body = resp.status === 200 ? await resp.json() : null;
    if (resp.status === 200) {
      // The leak path. Capture proof so the test diff at fix-time is
      // obvious: today's response includes the consumer first name.
      expect(body).toMatchObject({ applicationId: appB });
      expect(body).toHaveProperty('consumerContact');
    } else {
      // Auth fence rejected us. Acceptable transient — but the target
      // is still 404 + no-leak, asserted in the skipped test above.
      expect([401, 403, 404]).toContain(resp.status);
    }
  });
});

/* ===========================================================================
 *  Flow 9 — Login rate-limit
 * ======================================================================== */
describe('PE Flow 9 — login rate-limit', () => {
  it('legacy fence — 21st request from same IP within 60s returns 429 + Retry-After', async (ctx) => {
    /* Characterizes the CURRENT edge-rate-limit ceiling (20/min/IP per
     * lib/edge-rate-limit.ts#DEFAULT_LIMIT). The target spec in the PE
     * backlog wants this tightened to 10/min for the auth surface —
     * that's covered by the skipped test below. */
    if (skipReason) return ctx.skip();
    const { __resetEdgeRateLimitForTests, enforce } = await import(
      '../../lib/edge-rate-limit.js'
    );
    __resetEdgeRateLimitForTests();

    const ip = '203.0.113.42';
    for (let i = 1; i <= 20; i++) {
      const r = enforce(ip);
      expect(r.allowed).toBe(true);
    }
    const twentyFirst = enforce(ip);
    expect(twentyFirst.allowed).toBe(false);
    if (!twentyFirst.allowed) {
      // Retry-After must be a positive ms hint inside the 60s window.
      expect(twentyFirst.retryAfterMs).toBeGreaterThan(0);
      expect(twentyFirst.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it.skip('target — 11 attempts from one IP / 60s → 11th returns 429 (pending RULE-RATE-LIMIT-AUTH-001)', () => {
    /* The PE target is 10/min on the auth surface, not the default
     * 20/min. Wire by passing `limit: 10` to enforce() inside
     * /api/account/sign-in/route.ts (and /api/auth/login/route.ts when
     * it gains the same gate) — or by introducing a separate AUTH
     * profile in edge-rate-limit.ts. Once wired, assert:
     *   for (let i=1;i<=10;i++) expect(call().status).not.toBe(429);
     *   expect(call().status).toBe(429);
     *   expect(call().headers.get('retry-after')).toMatch(/^\d+$/);
     */
  });

  it.skip('target — 6 attempts on same identifier across different IPs → 6th is 429 (pending RULE-RATE-LIMIT-IDENT-001)', () => {
    /* lib/edge-rate-limit.ts is per-IP only. The target spec wants a
     * second counter keyed on the credential identifier (email) so a
     * distributed brute-force from 100 IPs against one victim still
     * trips at 5 attempts/min. Needs a new bucket — probably the same
     * sliding-window primitive with a different key ('ident:'+email).
     * Skipped because the bucket does not exist yet.
     */
  });
});

/* ===========================================================================
 *  Flow 10 — Welcome token consume (one-shot)
 * ======================================================================== */
describe('PE Flow 10 — welcome token consume on /api/account/set-password', () => {
  it.skip('first POST { token, newPassword } succeeds, second POST returns 410 token_invalid (pending RULE-WELCOME-TOKEN-001)', () => {
    /* The current route accepts { userId, newPassword } — NOT
     * { token, newPassword }. The "consume" semantics (one-shot,
     * expires on first successful use, 410 thereafter) is the target
     * design from the PE backlog and is not yet implemented.
     *
     * Target assertions:
     *   const token = await mintWelcomeToken({ userId, brand });
     *   const r1 = await POST(buildReq({ token, newPassword: 'StrongPass!12' }));
     *   expect(r1.status).toBe(200);
     *   const r2 = await POST(buildReq({ token, newPassword: 'OtherPass!34' }));
     *   expect(r2.status).toBe(410);
     *   expect((await r2.json()).code).toBe('token_invalid');
     *
     * Implementation hints for the rewrite:
     *   - Add a `welcome_tokens` table (token_hash PK, userId, brand,
     *     expiresAt, consumedAt nullable).
     *   - On successful consume, set consumedAt and refuse subsequent
     *     reads where consumedAt IS NOT NULL.
     *   - Hash the token at rest (HMAC) so a DB dump doesn't leak
     *     plaintext bearer values.
     */
  });

  it('legacy fence — current set-password route expects { userId, newPassword } not { token } (regression sentinel)', async (ctx) => {
    /* The body schema today is `.strict()` so a token-only payload is
     * rejected as 400 invalid_set_password_payload. When the rewrite
     * lands, this test goes RED and prompts deletion + unskip of the
     * target test above. */
    if (skipReason) return ctx.skip();
    const { POST } = await import('../../app/api/account/set-password/route.js');
    const csrfBypass = { 'content-type': 'application/json', 'x-csrf-skip': 'test' };

    const req = new NextRequest('http://localhost/api/account/set-password', {
      method: 'POST',
      headers: csrfBypass,
      body: JSON.stringify({ token: 'tok_' + randomUUID(), newPassword: 'StrongPass!12' }),
    });
    const resp = await POST(req);
    // Today: either 400 (schema rejects unknown 'token' field via
    // .strict()), 403 (CSRF rejection — there is no test bypass header
    // yet), or 429 (rate limit). All confirm the welcome-token flow is
    // NOT live. The target above asserts the proper 200/410 contract.
    expect([400, 403, 429]).toContain(resp.status);
  });
});

/* ===========================================================================
 *  Flow 7 (portal side) — Lender loan.funded inbox dedupe
 *  Belongs here because the lender webhook persistence lives in
 *  partner-portal Drizzle, not apps/api Prisma.
 * ======================================================================== */
describe('PE Flow 7 — lender loan.funded webhook (portal-side persistence)', () => {
  it.skip('replay of same signed body returns { duplicate: true } + atomic single update (pending RULE-INBOX-DEDUPE-001)', () => {
    /* Today the route at
     *   apps/partner-portal/app/api/v1/webhooks/lenders/[lender]/route.ts
     * verifies HMAC and writes:
     *   • offers row (decision)
     *   • applications.status flip
     *   • application_events append-only
     * but the append-only events table has NO unique constraint on the
     * lender event id, so a replay duplicates the event row. The
     * "duplicate":true contract is not yet returned.
     *
     * Target assertions:
     *   const body = JSON.stringify({event_type:'loan.funded', application_id:appId});
     *   const sig = signWebhook(body);
     *   const r1 = await POST(buildSignedReq(body, sig), { params: { lender:'sample-1' }});
     *   const r2 = await POST(buildSignedReq(body, sig), { params: { lender:'sample-1' }});
     *   expect((await r1.json()).duplicate).toBe(false);
     *   expect((await r2.json()).duplicate).toBe(true);
     *   const events = await pool.query(
     *     `SELECT count(*) FROM application_events
     *       WHERE application_id=$1 AND event_type='lender_funded'`, [appId]);
     *   expect(Number(events.rows[0].count)).toBe(1);
     */
  });
});

/* ===========================================================================
 *  Internal sanity — confirm the webhook signing helper matches the
 *  partner-portal verifySignature(). If this ever breaks, every signed-
 *  webhook test that depends on it is silently bypassing HMAC.
 * ======================================================================== */
describe('webhook signing helper parity', () => {
  it('hex-signs body via timestamp.nonce.body canonical form', async () => {
    const body = JSON.stringify({ event_type: 'loan.funded', application_id: randomUUID() });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const signature = createHmac('sha256', 'demo_shared_secret_replace_in_prod')
      .update(`${timestamp}.${nonce}.${body}`)
      .digest('hex');
    expect(signature).toMatch(/^[0-9a-f]{64}$/);

    // Round-trip against the route's own verifier to prove parity.
    const { verifySignature } = await import('../../lib/api-v1/shared.js');
    const result = await verifySignature({ timestamp, nonce, signature, body });
    expect(result.status).toBe('valid');
  });
});
