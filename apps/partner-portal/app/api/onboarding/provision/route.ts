import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listRuns, startProvision, type ProvisionConfig } from '@/lib/orchestrator/provision';
import { requireAdmin } from '@/lib/server-guards';
import {
  IMPLICIT_DEDUPE_TTL_SECONDS,
  deriveImplicitKey,
  hashRequestBody,
  parseIdempotencyKeyHeader,
  replayIfStored,
  storeResponse,
} from '@/lib/idempotency';
import { safeLog } from '@/lib/safe-log';

const IDEMPOTENCY_SCOPE = 'onboarding.provision';
const IMPLICIT_SCOPE = 'onboarding.provision.implicit';

/**
 * POST /api/onboarding/provision
 *
 * Kick off the one-config provisioning workflow for a new partner.
 * Returns immediately (202) with the run id; status polls go to
 * `GET /api/onboarding/provision/[id]`.
 *
 * Steps (executed in sequence in the background):
 *   1. HighSale sub-account
 *   2. Lender marketplace defaults (inherit brand allowlist)
 *   3. MiCamp MID (pre-underwriting)
 *   4. Partner-portal seed (branding + owner invite)
 *
 * Idempotency
 * -----------
 * Every POST requires `Idempotency-Key: <uuid>`. We layer TWO checks:
 *   • Explicit caller-supplied key (24h TTL) — standard Stripe-style
 *     replay protection.
 *   • Implicit `sha256(partnerId|bodyHash)` key (5min TTL) — defeats
 *     the double-click case where the operator's second click mints
 *     a fresh Idempotency-Key client-side. Without this, two near-
 *     simultaneous clicks would each create a HighSale sub-account +
 *     a MiCamp MID against the same partner.
 *
 * GET /api/onboarding/provision  — list recent runs (for the admin
 *                                  provisioning queue page).
 */

const BodySchema = z.object({
  partnerId: z.string().min(1),
  legalName: z.string().min(1),
  dba: z.string().nullable().optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/),
  primaryContactName: z.string().min(1),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().min(7),
  brand: z.enum(['medpay', 'tradepay', 'coachpay', 'ai_funding']),
  bureau: z.enum(['fico8', 'vantage']),
  monthlyPullCap: z.number().int().positive().nullable().optional(),
  billingCadence: z.enum(['weekly', 'biweekly', 'monthly']),
  estimatedAnnualVolumeCents: z.number().int().nonnegative(),
  estimatedTicketCents: z.number().int().nonnegative(),
  mccCode: z.string().length(4),
  funnelUrls: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  // SEC-001: admin-only. Provisioning kicks off real upstream calls
  // (HighSale sub-account, MiCamp MID); anonymous access was the bug.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  // Idempotency-Key required — a double-click on the admin provision
  // button would otherwise mint TWO HighSale sub-accounts + TWO MiCamp
  // MIDs for the same partner. Real money side-effects.
  const idempotencyKey = parseIdempotencyKeyHeader(req);
  if (idempotencyKey instanceof NextResponse) return idempotencyKey;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_provision_config',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Explicit caller-supplied key replay (24h TTL).
  const requestHash = hashRequestBody(raw);
  const replay = await replayIfStored(IDEMPOTENCY_SCOPE, idempotencyKey, requestHash);
  if (replay) return replay;

  // Implicit dedupe — even if the operator generated a brand-new
  // Idempotency-Key on the second click, the same (partnerId, body)
  // pair within a 5-minute window collapses to the prior run. Belt
  // to the Idempotency-Key braces.
  const implicitKey = deriveImplicitKey([parsed.data.partnerId, requestHash]);
  const implicitReplay = await replayIfStored(IMPLICIT_SCOPE, implicitKey, requestHash);
  if (implicitReplay) {
    safeLog.info({
      event: 'onboarding.provision.implicit_dedupe.hit',
      partnerId: parsed.data.partnerId,
    });
    return implicitReplay;
  }

  const config: ProvisionConfig = {
    partnerId: parsed.data.partnerId,
    legalName: parsed.data.legalName,
    dba: parsed.data.dba ?? null,
    ein: parsed.data.ein,
    primaryContactName: parsed.data.primaryContactName,
    primaryContactEmail: parsed.data.primaryContactEmail,
    primaryContactPhone: parsed.data.primaryContactPhone,
    brand: parsed.data.brand,
    bureau: parsed.data.bureau,
    monthlyPullCap: parsed.data.monthlyPullCap ?? null,
    billingCadence: parsed.data.billingCadence,
    estimatedAnnualVolumeCents: parsed.data.estimatedAnnualVolumeCents,
    estimatedTicketCents: parsed.data.estimatedTicketCents,
    mccCode: parsed.data.mccCode,
    funnelUrls: parsed.data.funnelUrls,
  };

  const run = await startProvision(config);

  // Store under BOTH scopes so subsequent retries — whether they reuse
  // the same Idempotency-Key, or mint a fresh one within 5 minutes —
  // hit the existing run instead of provisioning again.
  await storeResponse(IDEMPOTENCY_SCOPE, idempotencyKey, requestHash, 202, run);
  await storeResponse(
    IMPLICIT_SCOPE,
    implicitKey,
    requestHash,
    202,
    run,
    IMPLICIT_DEDUPE_TTL_SECONDS,
  );

  return NextResponse.json(run, { status: 202 });
}

export async function GET(req: NextRequest) {
  // SEC-001: admin-only. The list contains partner contact info +
  // step output, which leaks the active onboarding pipeline.
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json({ runs: await listRuns() });
}
