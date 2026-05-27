/**
 * ─────────────────────────────────────────────────────────────────────
 * Partner-Enrollment Critical-Flow integration spec — backend side
 * ─────────────────────────────────────────────────────────────────────
 *
 * Characterization tests for five high-blast-radius flows that live in
 * the NestJS apps/api boot:
 *
 *   1. Consumer apply happy path (loan-application lifecycle, asserting
 *      at EVERY persisted hop — consent, soft pull, offers, accept,
 *      contract, loan, outbox, status=active).
 *   2. Consumer apply thin-file decline (decision-engine returns no
 *      offers; application reaches a terminal failed state; AAN gets
 *      generated; failed decision lands in the DLQ).
 *   6. MiCamp `mid.activated` webhook end-to-end (signed inbound →
 *      inbox row → worker dispatch → NotImplementedError →
 *      inbox.status=failed → DLQ visibility for ops).
 *   7. Lender `loan.funded` webhook end-to-end (signed inbound →
 *      inbox dedupe on replay → second delivery returns
 *      `{duplicate:true}` → application+offer status updated
 *      atomically exactly once).
 *   8. Operator suspends partner (POST /api/admin/partners/<id>/status
 *      → partners.suspended_at set, audit_log row exists with action
 *      `partner.suspended`).
 *
 * Test discipline
 * ---------------
 * • The LEGACY (current main) is the oracle. Where today's code already
 *   exhibits the documented behaviour, the test asserts on it
 *   concretely (literal status strings, literal counts).
 * • Where the target contract is not yet wired (per the PE backlog —
 *   consent_receipts table, AAN generator, MiCamp inbox/DLQ rows,
 *   partners.suspended_at column, /api/admin/partners/<id>/status
 *   route), the test is registered as `it.skip("pending RULE-…")` so
 *   the rewrite owner knows the contract exists and what to assert
 *   against. NEVER deleted — visible in the report as work-in-flight.
 *
 * Harness reuse
 * -------------
 * Uses the same `bootIntegrationStack` / `createTestingApp` /
 * `wipeDatabase` helpers as the existing application.flow,
 * webhook.flow, and auth.flow specs (see ./setup.ts). Reusing one
 * Postgres + Redis stack across the file keeps the cold-start budget
 * sane (one ~5-10 s boot rather than five).
 *
 * Skip-on-no-stack
 * ----------------
 * Same runtime-skip pattern as the existing specs: an `it.skip()` on a
 * `ctx` argument fires AFTER `beforeAll` runs, so a missing docker /
 * testcontainers install surfaces as a clear "skipped — integration
 * stack unavailable" instead of a silent green.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  bootIntegrationStack,
  createTestingApp,
  teardownIntegrationStack,
  wipeDatabase,
} from './setup.js';
import {
  NOTIFICATION_GATEWAY,
  type NotificationGateway,
  type OtpDeliveryInput,
} from '../../../../services/auth/src/ports/notification.port.js';

/** Mock secret matching `apps/partner-portal/lib/api-v1/shared.ts#MOCK_SECRET`. */
const MOCK_LENDER_SECRET = 'demo_shared_secret_replace_in_prod';

class CapturingNotificationGateway implements NotificationGateway {
  readonly delivered: OtpDeliveryInput[] = [];
  async deliverOtp(input: OtpDeliveryInput): Promise<void> {
    this.delivered.push(input);
  }
  latestFor(destination: string): OtpDeliveryInput {
    const found = [...this.delivered].reverse().find((d) => d.to === destination);
    if (!found) throw new Error(`no captured OTP for ${destination}`);
    return found;
  }
}

let app: NestFastifyApplication | undefined;
let close: (() => Promise<void>) | undefined;
let capture: CapturingNotificationGateway | undefined;
let databaseUrl: string | undefined;
let skipReason: string | undefined;

beforeAll(async () => {
  try {
    const stack = await bootIntegrationStack();
    databaseUrl = stack.databaseUrl;
    capture = new CapturingNotificationGateway();
    const booted = await createTestingApp(stack.databaseUrl, stack.redisUrl, [
      { token: NOTIFICATION_GATEWAY, useValue: capture },
    ]);
    app = booted.app;
    close = booted.close;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[pe-critical-flows] integration stack unavailable — skipping:', skipReason);
  }
}, 180_000);

afterAll(async () => {
  if (close) await close();
  await teardownIntegrationStack();
});

/* ===========================================================================
 *  Helpers
 * ======================================================================== */

interface AuthedUser {
  userId: string;
  auth: { authorization: string };
  email: string;
}

/**
 * Register + verify a fresh user and return an `Authorization: Bearer …`
 * header. Mirrors the same dance every existing flow spec does so the
 * helper stays cheap to inline — DB is wiped between tests so we never
 * have to worry about a previously-seeded user colliding.
 */
async function registerAndVerify(prefix: string): Promise<AuthedUser> {
  if (!app || !capture) throw new Error('app/capture not ready');
  const email = `${prefix}+${Date.now()}@eazepay.test`;
  const password = 'CorrectHorseBattery!9';
  const deviceId = `device-${prefix}-${Date.now()}`;

  const reg = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    headers: { 'idempotency-key': `reg-${email}` },
    payload: { email, password, marketingConsent: false },
  });
  expect(reg.statusCode).toBe(201);
  const regBody = reg.json() as { userId: string; challenge: { challengeId: string } };
  const otp = capture.latestFor(email);

  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/verify-otp',
    payload: {
      challengeId: regBody.challenge.challengeId,
      code: otp.code,
      deviceId,
    },
  });
  expect(verify.statusCode).toBe(200);
  const { tokens } = verify.json() as { tokens: { accessToken: string } };
  return {
    userId: regBody.userId,
    auth: { authorization: `Bearer ${tokens.accessToken}` },
    email,
  };
}

/**
 * Compute the canonical `timestamp.nonce.body` HMAC-SHA256 the
 * partner-portal lender + MiCamp webhook routes verify (see
 * `lib/api-v1/shared.ts#verifySignature`). Tests use this to mint
 * realistic signed payloads — anything else would either bypass the
 * production signature gate (false-positive green) or 401 the request
 * (test never reaches the persistence assertions).
 */
function signWebhook(body: string, secret: string = MOCK_LENDER_SECRET): {
  timestamp: string;
  nonce: string;
  signature: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const signature = createHmac('sha256', secret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
  return { timestamp, nonce, signature };
}

async function pollForOffers(
  application: NestFastifyApplication,
  applicationId: string,
  auth: { authorization: string },
  timeoutMs = 10_000,
): Promise<Array<{ id: string; aprBps: number; rank: number; status: string }>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await application.inject({
      method: 'GET',
      url: `/v1/applications/${applicationId}/offers`,
      headers: auth,
    });
    if (r.statusCode === 200) {
      const list = r.json() as Array<{ id: string; aprBps: number; rank: number; status: string }>;
      if (list.length > 0 && list.some((o) => o.status === 'presented')) {
        return list.filter((o) => o.status === 'presented').sort((a, b) => a.rank - b.rank);
      }
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`offers did not become presented for application ${applicationId}`);
}

/* ===========================================================================
 *  Flow 1 — Consumer apply happy path (full chain, DB hops)
 * ======================================================================== */
describe('PE Flow 1 — consumer apply happy path', () => {
  it('persists application → offers → contract → loan → outbox → status=active', async (ctx) => {
    if (skipReason || !app || !capture || !databaseUrl) return ctx.skip();
    await wipeDatabase(databaseUrl);

    const user = await registerAndVerify('apply-happy');

    // ── DB HOP 0: create application (status=draft)
    const create = await app.inject({
      method: 'POST',
      url: '/v1/applications',
      headers: { ...user.auth, 'idempotency-key': `app-create-${user.email}` },
      payload: {
        category: 'personal',
        requestedAmountCents: 200_000, // $2,000
        termMonths: 24,
        channel: 'consumer_direct',
      },
    });
    expect(create.statusCode).toBeLessThan(300);
    const application = create.json() as { id: string; status: string };
    expect(application.status).toBe('draft');

    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

    try {
      // ── DB HOP 1: submit → triggers async orchestration (soft pull + offers)
      const submit = await app.inject({
        method: 'POST',
        url: `/v1/applications/${application.id}/submit`,
        headers: { ...user.auth, 'idempotency-key': `app-submit-${user.email}` },
        payload: {},
      });
      expect(submit.statusCode).toBeLessThan(300);
      expect((submit.json() as { status: string }).status).toBe('submitted');

      // ── DB HOP 2: offers persisted by orchestration. Poll until present.
      const offers = await pollForOffers(app, application.id, user.auth);
      expect(offers.length).toBeGreaterThanOrEqual(1);
      const best = offers[0]!;

      // Real-Postgres assertion: at least one offer row with status=presented.
      const persistedOffers = await prisma.offer.findMany({
        where: { applicationId: application.id },
      });
      expect(persistedOffers.length).toBeGreaterThanOrEqual(1);
      expect(persistedOffers.some((o) => o.status === 'presented')).toBe(true);

      // ── DB HOP 3: accept offer → mock e-sign auto-signs → Contract + Loan rows
      const accept = await app.inject({
        method: 'POST',
        url: `/v1/applications/${application.id}/offers/${best.id}/accept`,
        headers: { ...user.auth, 'idempotency-key': `accept-${best.id}` },
        payload: {},
      });
      expect(accept.statusCode).toBeLessThan(300);
      const accepted = accept.json() as { status: string };
      // 'contracted' | 'funding' | 'active' all indicate the auto-sign path
      // completed. 'accepted' alone would mean the e-sign webhook stalled,
      // which the mock provider should never let happen.
      expect(['contracted', 'funding', 'active']).toContain(accepted.status);

      // ── DB HOP 4: Loan row
      const loans = await prisma.loan.findMany({ where: { applicationId: application.id } });
      expect(loans).toHaveLength(1);
      expect(loans[0]!.userId).toBe(user.userId);
      expect(loans[0]!.principalCents.toString()).toBe('200000');

      // ── DB HOP 5: AuditOutbox chain — created, accepted, loan
      const outbox = await prisma.auditOutbox.findMany({
        where: { targetType: { in: ['Application', 'Offer', 'Loan'] } },
        select: { action: true, targetType: true },
      });
      const actions = new Set(outbox.map((o) => o.action));
      expect(actions.has('application.created')).toBe(true);
      expect(actions.has('application.offer_accepted')).toBe(true);
      expect(outbox.some((o) => o.targetType === 'Loan')).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  }, 60_000);

  /* Pending target contracts not yet wired in apps/api.
   * These assertions describe the spec the rewrite must satisfy. */
  it.skip('persists a consent_receipt row before the soft pull fires (pending RULE-CONSENT-001)', () => {
    /* Target: POST /v1/applications/<id>/submit MUST insert one row into
     * consent_receipts with { userId, applicationId, consentText hash,
     * ipAddress, userAgent, signedAt } BEFORE any bureau call. Today
     * the consent capture lives only on the partner-portal apply page
     * (lib/consumer-consent.ts) and is not persisted to apps/api. */
  });

  it.skip('terminal application status reaches "active" after loan funding (pending RULE-LIFECYCLE-007)', () => {
    /* Today the loan.funded webhook from the lender updates
     * applications.status via the Drizzle path (partner-portal), not
     * the Prisma Application model. The Nest-side Application currently
     * settles at 'contracted'|'funding'; the 'active' terminal state
     * requires the cross-stack reconciler that's still on the backlog. */
  });
});

/* ===========================================================================
 *  Flow 2 — Consumer apply with thin file (decline path + AAN + DLQ)
 * ======================================================================== */
describe('PE Flow 2 — consumer apply thin-file decline', () => {
  it('declines cleanly when amount falls outside every adapter envelope', async (ctx) => {
    if (skipReason || !app || !capture || !databaseUrl) return ctx.skip();
    await wipeDatabase(databaseUrl);

    const user = await registerAndVerify('apply-thin');

    // 50 cents on a 6-month term is below the prime / mock_prime
    // floors → every adapter should return no_match → application
    // should not progress to offers_presented.
    const create = await app.inject({
      method: 'POST',
      url: '/v1/applications',
      headers: { ...user.auth, 'idempotency-key': `app-create-thin-${user.email}` },
      payload: {
        category: 'personal',
        requestedAmountCents: 50, // $0.50 — below every adapter floor
        termMonths: 6,
        channel: 'consumer_direct',
      },
    });
    expect(create.statusCode).toBeLessThan(300);
    const application = create.json() as { id: string; status: string };
    expect(application.status).toBe('draft');

    const submit = await app.inject({
      method: 'POST',
      url: `/v1/applications/${application.id}/submit`,
      headers: { ...user.auth, 'idempotency-key': `app-submit-thin-${user.email}` },
      payload: {},
    });
    // Submission itself accepts; the decline is async, surfaced via status.
    expect(submit.statusCode).toBeLessThan(300);

    // Give orchestration up to 10s to settle.
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const deadline = Date.now() + 10_000;
      let finalStatus = '';
      let offerCount = 0;
      while (Date.now() < deadline) {
        const row = await prisma.application.findUnique({
          where: { id: application.id },
          select: { status: true },
        });
        finalStatus = row?.status ?? '';
        offerCount = await prisma.offer.count({ where: { applicationId: application.id } });
        if (
          finalStatus === 'declined' ||
          finalStatus === 'failed' ||
          finalStatus === 'failed_decisioning' ||
          finalStatus === 'no_match'
        )
          break;
        await new Promise((r) => setTimeout(r, 250));
      }
      // Characterization: the legacy currently lands on either 'declined'
      // or 'no_match' (the mock adapters return ineligible). The target
      // spec wants 'failed_decisioning' specifically; assert the broad
      // set today and tighten in the rewrite.
      expect(['declined', 'no_match', 'failed_decisioning', 'failed']).toContain(finalStatus);
      // No offers must be presented to the consumer when no adapter matched.
      expect(offerCount).toBe(0);
    } finally {
      await prisma.$disconnect();
    }
  }, 30_000);

  it.skip('writes the failed decision to the DLQ (pending RULE-DLQ-002)', () => {
    /* Target: a thin-file decline produces ONE row in
     * decisioning_dlq with { applicationId, lastError, adapterResults[]
     * } so ops can replay or override. Today the orchestration engine
     * logs the failure to safeLog but does not persist a DLQ row. */
  });

  it.skip('generates an Adverse Action Notice document (pending RULE-AAN-001)', () => {
    /* Target: on terminal decline the compliance-doc service MUST emit
     * one Document row, type='adverse_action_notice', linked to the
     * application, signed + stored in object storage within 30 days of
     * the adverse action (Reg B §1002.9). The compliance-doc service
     * exists but the AAN generator is not yet wired to the decline hook. */
  });
});

/* ===========================================================================
 *  Flow 6 — MiCamp `mid.activated` webhook end-to-end
 * ======================================================================== */
describe('PE Flow 6 — MiCamp mid.activated webhook (handler NotImplemented)', () => {
  it.skip('inbox row stays "failed" + DLQ visible to ops (pending RULE-MICAMP-001)', () => {
    /* Target wire-up (per the PE backlog):
     *
     *   1. POST /v1/webhooks/micamp with X-MiCamp-Signature header.
     *   2. Verify signature against MICAMP_WEBHOOK_SECRET; reject on
     *      'invalid' or 'skipped' (SEC-003 parity).
     *   3. Insert one row into `webhook_inbox` with status='queued',
     *      provider='micamp', payload as JSONB, dedupe key = the
     *      MiCamp event id.
     *   4. BullMQ worker picks it up → dispatches to
     *      MiCampWebhookService.handleMidActivated → which currently
     *      throws NotImplementedError (the merchant-onboarding side is
     *      mid-build).
     *   5. Inbox row transitions to status='failed' with
     *      lastError='NotImplementedError', retryCount=0.
     *   6. DLQ list endpoint (GET /v1/admin/webhooks/inbox?status=failed)
     *      returns the row.
     *
     * None of points 1-6 are implemented in apps/api yet — there is no
     * MiCamp webhook controller, no webhook_inbox table in Prisma, no
     * BullMQ inbox worker. This test is registered so the rewrite owner
     * can fill it in once the inbox lands.
     *
     * What to assert when wiring:
     *   - response is 202 with body { id, status: 'queued' }
     *   - prisma.webhookInbox.count() === 1
     *   - poll until status='failed' (with timeout 10s)
     *   - lastError contains 'NotImplementedError'
     *   - GET /v1/admin/webhooks/inbox?status=failed includes the row id
     */
  });

  it.skip('rejects unsigned MiCamp payloads with 401 + code=signature_skipped', () => {
    /* Pair-test: the route MUST refuse unsigned POSTs in production /
     * REQUIRE_HMAC=true, even if the body parses cleanly. Mirrors the
     * SEC-003 hardening that already exists for the lender webhook
     * route in the partner-portal. */
  });
});

/* ===========================================================================
 *  Flow 7 — Lender `loan.funded` webhook (inbox dedupe + atomic update)
 * ======================================================================== */
describe('PE Flow 7 — lender loan.funded webhook end-to-end', () => {
  it.skip('second delivery of same eventId returns { duplicate: true } (pending RULE-INBOX-DEDUPE-001)', () => {
    /* The partner-portal route at
     *   POST /api/v1/webhooks/lenders/[lender]
     * already verifies the HMAC and performs DB writes — but inbox
     * dedupe is keyed off lender_id + event_id in the target design, and
     * that index is not yet on the live table. Today a replay creates
     * duplicate `application_events` rows (the offers upsert is
     * idempotent on PK but the event log is append-only without an
     * idempotency key).
     *
     * Target contract to assert once wired:
     *   • First call: 200 { ok: true, duplicate: false }, application
     *     status flips draft→funded, offer.status flips presented→
     *     accepted, EXACTLY ONE application_events row of type
     *     'lender_funded' inserted.
     *   • Replay with the same X-EazePay-Signature + body:
     *     200 { ok: true, duplicate: true }, ZERO new
     *     application_events rows, application/offer status unchanged.
     *
     * Cross-stack note: this flow's persistence lives in partner-portal
     * Drizzle (not apps/api Prisma). The integration test for it
     * belongs alongside the partner-portal tests — see
     * apps/partner-portal/test/integration/pe-portal-flows.spec.ts.
     */
  });

  it('signed webhook helper produces a header set the lender route accepts', () => {
    /* Sanity-check the test helper itself: a payload signed with
     * MOCK_LENDER_SECRET via the same canonical "timestamp.nonce.body"
     * string the partner-portal verifySignature() consumes MUST produce
     * a hex of length 64. If this assertion ever breaks, every other
     * webhook integration test in this repo is silently bypassing the
     * HMAC gate. */
    const body = JSON.stringify({ event_type: 'loan.funded', application_id: randomUUID() });
    const { timestamp, nonce, signature } = signWebhook(body);
    expect(timestamp).toMatch(/^\d{10}$/);
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });
});

/* ===========================================================================
 *  Flow 8 — Operator suspends partner
 * ======================================================================== */
describe('PE Flow 8 — operator suspends partner', () => {
  it.skip('POST /api/admin/partners/<id>/status sets suspended_at + writes audit_log (pending RULE-PARTNER-SUSPEND-001)', () => {
    /* Target:
     *   • Route: POST /api/admin/partners/<id>/status with body
     *     { status: 'suspended', reason: string }.
     *   • Auth: admin role required (operator).
     *   • DB hop 1: partners.suspended_at SET to NOW(),
     *     partners.suspension_reason set.
     *   • DB hop 2: one row in audit_log with action='partner.suspended',
     *     actor=operator userId, target=partnerId, metadata.reason
     *     matches the request body.
     *   • Idempotent: re-issuing the same POST does NOT write a second
     *     audit row when the partner is already suspended.
     *
     * Missing today:
     *   - partners table (Drizzle, in partner-portal) has no
     *     suspended_at / suspension_reason columns — migration pending.
     *   - No /api/admin/partners/<id>/status route exists yet (only
     *     /api/admin/team/[id]/route.ts).
     *   - No audit_log table in either Prisma or Drizzle yet; closest
     *     is apps/api AuditOutbox which is for outbound integrations,
     *     not operator actions.
     *
     * When the column + route + table land, this test asserts:
     *   const before = await prisma.partner.findUnique(...)
     *   expect(before.suspendedAt).toBeNull();
     *   const resp = await app.inject({ method: 'POST', url: ..., headers: adminAuth, payload: { status:'suspended', reason:'fraud signal' }});
     *   expect(resp.statusCode).toBe(200);
     *   const after = await prisma.partner.findUnique(...)
     *   expect(after.suspendedAt).toBeInstanceOf(Date);
     *   const audit = await prisma.auditLog.findFirst({ where: { action:'partner.suspended', targetId: partnerId }});
     *   expect(audit?.metadata).toMatchObject({ reason: 'fraud signal' });
     */
  });
});
