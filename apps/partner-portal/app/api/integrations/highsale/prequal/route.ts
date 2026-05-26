import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { runPrequal, type PrequalRequest } from '@/lib/highsale/client';
import { assertResourceOwnershipStub, requirePartnerSession } from '@/lib/server-guards';
import { verifyFCRAConsent } from '@/lib/consumer-consent';
import { hasDb, getDb, schema } from '@/lib/db';
import { safeLog } from '@/lib/safe-log';

/**
 * POST /api/integrations/highsale/prequal
 *
 * Run a soft-pull pre-qualification through the partner's HighSale
 * sub-account. Called by the consumer apply flow after the customer
 * submits the intake form. The response feeds the decision engine:
 *
 *   intake form → [this route] → HighSale snapshot
 *                                       ↓
 *                              decision engine (filter + propensity)
 *                                       ↓
 *                              offers landing page
 *
 * Idempotency: `requestId` is the client-minted dedupe key. Replay
 * of the same requestId returns the same pullId without consuming
 * a second wholesale pull.
 *
 * SEC-006 / Task #45 — FCRA permissible purpose gate.
 * --------------------------------------------------
 * FCRA §604(a)(2) [15 U.S.C. § 1681b] requires a documented consumer
 * authorization for every soft credit pull. The CFPB has issued
 * 7-figure penalties for soft pulls run without a defensible
 * authorization on file. Pre-SEC-006 this route accepted SSN-last-4,
 * DOB, full address, and annual income and immediately called
 * `runPrequal()` — zero verification that consent was ever captured.
 *
 * Hardening:
 *   1. Body must carry `consentReceiptId` + `applicationId` (Zod-required).
 *   2. `verifyFCRAConsent` looks up the receipt by id, confirms it
 *      matches the applicationId, is fresh (<= 30 days), and pinned to
 *      the CURRENT disclosure version.
 *   3. On any verifier failure: 412 Problem Details, NO HighSale call.
 *   4. On success: forward the receipt id to HighSale as
 *      `clientReference`, write an audit_log row with action
 *      `credit_pull.soft` as the permissible-purpose evidence trail.
 *
 * SEC-001 (Builder B) — partner session is enforced upstream of the
 * consent check. We deliberately order the checks 401 → 400 (Zod) →
 * 412 (FCRA) so a malformed body cannot probe the FCRA store.
 */

const BodySchema = z.object({
  subAccountId: z.string().min(1),
  /** Application this pull belongs to. Cross-referenced against the
   *  consent receipt to block replay of a captured consent across apps. */
  applicationId: z.string().min(1),
  /** SEC-006 — opaque receipt id minted by POST /api/applications/consent. */
  consentReceiptId: z.string().min(1),
  consumer: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
    ssnLast4: z.string().regex(/^\d{4}$/),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().length(2),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/),
    }),
    annualIncomeCents: z.number().int().nonnegative(),
    employmentType: z.enum(['w2', 'self_employed', '1099', 'retired', 'unemployed', 'other']),
  }),
  requestedAmountCents: z.number().int().positive(),
  requestId: z.string().min(8),
});

type PrequalBody = z.infer<typeof BodySchema>;

/**
 * Audit log writer — FCRA permissible-purpose evidence trail.
 *
 * Every soft pull gets exactly one row with the consent receipt id +
 * disclosure version + pull id + tier. This is the artifact a CFPB
 * examiner asks for during a 1681b audit. Failure to write the row
 * is NOT fatal to the consumer flow (the pull still happened, the
 * consent still exists) — we log loudly so the audit gap is visible
 * in the BFF logs while the consumer sees their offers.
 *
 * TODO(builder-a): once Builder A's typed audit-log writer lands,
 * swap the raw drizzle insert for that helper so the actor/action
 * vocabulary is centralised.
 */
async function writeFcraAuditLog(input: {
  applicationId: string;
  consentReceiptId: string;
  disclosureVersion: string;
  pullId: string;
  bureau: string;
  tier: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  if (!hasDb()) {
    // Local dev / DATABASE_URL not provisioned — keep the audit
    // intent visible in logs even when the DB write is impossible.
    safeLog.info({
      event: 'audit_log.fcra.soft_pull.skipped_no_db',
      applicationId: input.applicationId,
      consentReceiptId: input.consentReceiptId,
      pullId: input.pullId,
      tier: input.tier,
    });
    return;
  }
  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      actor: 'consumer:prequal',
      action: 'credit_pull.soft',
      targetType: 'application',
      targetId: input.applicationId,
      payloadJson: JSON.stringify({
        consentReceiptId: input.consentReceiptId,
        disclosureVersion: input.disclosureVersion,
        bureau: input.bureau,
        tier: input.tier,
        pullId: input.pullId,
      }),
      ipAddress: input.ip || null,
      userAgent: input.userAgent || null,
    });
  } catch (err) {
    safeLog.error({
      event: 'audit_log.fcra.soft_pull.write_failed',
      applicationId: input.applicationId,
      consentReceiptId: input.consentReceiptId,
      pullId: input.pullId,
      msg: err instanceof Error ? err.message : 'unknown',
    });
  }
}

function pickClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  // SEC-001 (Builder B): partner session required. The body carries
  // `subAccountId` which maps to a specific partner's HighSale account;
  // pre-fix the route trusted whatever id the caller sent.
  const guard = await requirePartnerSession(req);
  if (guard instanceof NextResponse) return guard;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_prequal_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const body: PrequalBody = parsed.data;

  // sub-account → partner ownership lookup is stubbed until the
  // `partner_highsale_subaccount` mapping table lands. See the helper
  // doc for the failure mode that survives in the meantime.
  const ownership = assertResourceOwnershipStub(guard, body.subAccountId, 'subaccount');
  if (ownership) return ownership;

  // SEC-006: verify FCRA consent BEFORE any state-changing call. Order
  // matters — Zod (400) and ownership (403) come first because they're
  // constant-cost; the FCRA verifier hits the receipt store and we don't
  // want a malformed body probing it.
  const verdict = verifyFCRAConsent(body.consentReceiptId, body.applicationId);
  if (!verdict.valid) {
    safeLog.warn({
      event: 'highsale.prequal.consent_verify_failed',
      applicationId: body.applicationId,
      consentReceiptId: body.consentReceiptId,
      reason: verdict.reason,
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Precondition Failed',
        status: 412,
        code: 'fcra_consent_missing',
        detail: verdict.reason,
      },
      { status: 412 },
    );
  }

  try {
    // SEC-006: pipe the verified receipt id through to HighSale so
    // their pull row carries our consent-chain pointer. The receipt
    // id is opaque (UUID) so it's safe to leave on their side.
    const upstream: PrequalRequest = {
      subAccountId: body.subAccountId,
      consumer: body.consumer,
      requestedAmountCents: body.requestedAmountCents,
      requestId: body.requestId,
      clientReference: verdict.receiptId,
    };
    const result = await runPrequal(upstream);

    // Audit row is the FCRA "permissible purpose" evidence. Downstream
    // regulators read this table to verify every soft pull had a
    // captured authorization on file.
    await writeFcraAuditLog({
      applicationId: body.applicationId,
      consentReceiptId: verdict.receiptId,
      disclosureVersion: verdict.disclosureVersion,
      pullId: result.pullId,
      bureau: result.bureau,
      tier: result.tier,
      ip: pickClientIp(req),
      userAgent: req.headers.get('user-agent') ?? '',
    });

    safeLog.info({
      event: 'highsale.prequal.completed',
      applicationId: body.applicationId,
      consentReceiptId: verdict.receiptId,
      pullId: result.pullId,
      tier: result.tier,
      bureau: result.bureau,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    safeLog.error({
      event: 'highsale.prequal.failed',
      applicationId: body.applicationId,
      consentReceiptId: verdict.receiptId,
      msg: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Gateway',
        status: 502,
        code: 'highsale_prequal_failed',
        detail: err instanceof Error ? err.message : 'HighSale pre-qual failed',
      },
      { status: 502 },
    );
  }
}
