import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { evaluateDecision } from '@/lib/decision-engine';
import type { Brand } from '@/lib/api-v1/shared';
import { assertResourceOwnership, requirePartnerSession } from '@/lib/server-guards';
import { verifyFCRAConsent } from '@/lib/consumer-consent-server';
import { hasDb } from '@/lib/db';
import { safeLog } from '@/lib/safe-log';

/**
 * POST /api/v1/decision-engine
 *
 * Public decision-engine endpoint. Takes an application id + HighSale
 * pre-qual snapshot, returns the propensity-ranked lender list.
 *
 * Persists the decision to the `decisions` table when DATABASE_URL is
 * set — that record is what powers the offer page, audit replay, and
 * Reg B adverse-action reason codes.
 *
 * Engine selection:
 *   • Default: env-driven (Trutopia cloud if configured, else internal)
 *   • Override via `engine` field in body for A/B testing or canary runs
 *
 * SEC-FCRA-02 — FCRA permissible-purpose gate.
 * --------------------------------------------
 * FCRA §604 [15 U.S.C. § 1681b] requires a documented consumer
 * authorization before any use of a consumer report. `evaluateDecision`
 * runs the credit scorer/decisioning engine over the consumer's bureau
 * profile — that IS a §604 use. The prequal route already gates the
 * upstream SOFT PULL behind `verifyFCRAConsent`; this route is the
 * SCORING step on the same application and must carry the same gate, or
 * a caller could trigger credit evaluation against an application with
 * no verified consent receipt on file.
 *
 * The body therefore carries the SAME `consentReceiptId` the prequal
 * route minted, cross-referenced against `applicationId`. The verifier
 * enforces: receipt exists, matches the application, is pinned to the
 * current disclosure version, and is fresh (<= 30 days). On any failure
 * we return 412 Problem Details and run NO scoring / NO bureau call —
 * fail-closed, identical to the prequal route's shape.
 */

const BodySchema = z.object({
  applicationId: z.string().uuid(),
  /** SEC-FCRA-02 — opaque receipt id minted by POST /api/applications/consent
   *  and forwarded from the prequal step. Cross-referenced against
   *  applicationId by `verifyFCRAConsent` to block scoring an application
   *  whose consumer never authorized a credit pull. */
  consentReceiptId: z.string().min(1),
  engine: z.enum(['trutopia', 'internal', 'fallback']).optional(),
  prequal: z.object({
    tier: z.enum(['A', 'B', 'C', 'D']),
    ficoBand: z.number().int().nullable(),
    dti: z.number().nullable(),
    openTradelines: z.number().int().nullable(),
    amountCents: z.number().int().positive(),
    annualIncomeCents: z.number().int().nonnegative(),
    state: z.string().length(2),
    brand: z.enum(['medpay', 'tradepay', 'coachpay', 'direct']),
  }),
});

export async function POST(req: NextRequest) {
  // SEC-001: partner session required. Decision engine results
  // include applicant tier + propensity-ranked lender list — sensitive
  // both for the consumer (PII-adjacent decisioning trail) and the
  // platform (lender ranking is the product). Pre-fix the route was
  // open to anyone.
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
        code: 'invalid_decision_payload',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // SEC-001 follow-up: real applicationId → partner ownership check.
  // 404 on mismatch / not-found so the propensity ranking can't be
  // reached by enumerating UUIDs.
  const ownership = await assertResourceOwnership(guard, parsed.data.applicationId, 'application');
  if (ownership) return ownership;

  // SEC-FCRA-02: the consent verifier reads the durable `consent_receipts`
  // table. When the DB is unavailable we cannot prove permissible purpose,
  // so we fail CLOSED (503) rather than scoring without a verifiable
  // authorization — same posture as the prequal route.
  if (!hasDb()) {
    safeLog.error({
      event: 'decision_engine.db_unavailable',
      applicationId: parsed.data.applicationId,
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        code: 'fcra_consent_unavailable',
        detail: 'Decisioning is temporarily unavailable. Please retry shortly.',
      },
      { status: 503 },
    );
  }

  // SEC-FCRA-02: verify FCRA permissible purpose BEFORE any scoring or
  // bureau-engine call. Mirrors app/api/integrations/highsale/prequal —
  // a verifier throw is a store outage (503); an invalid verdict is a
  // missing/stale/mismatched consent (412). Either way evaluateDecision
  // is NOT reached: nothing is scored, nothing is pulled, nothing is
  // written.
  let verdict;
  try {
    verdict = await verifyFCRAConsent(parsed.data.consentReceiptId, parsed.data.applicationId);
  } catch (err) {
    safeLog.error({
      event: 'decision_engine.consent_verify_threw',
      applicationId: parsed.data.applicationId,
      consentReceiptId: parsed.data.consentReceiptId,
      msg: err instanceof Error ? err.message : 'unknown',
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        code: 'fcra_consent_unavailable',
        detail: 'Decisioning is temporarily unavailable. Please retry shortly.',
      },
      { status: 503 },
    );
  }
  if (!verdict.valid) {
    safeLog.warn({
      event: 'decision_engine.consent_verify_failed',
      applicationId: parsed.data.applicationId,
      consentReceiptId: parsed.data.consentReceiptId,
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

  const result = await evaluateDecision({
    applicationId: parsed.data.applicationId,
    engine: parsed.data.engine,
    prequal: {
      ...parsed.data.prequal,
      brand: parsed.data.prequal.brand as Brand,
    },
  });

  return NextResponse.json(result);
}
