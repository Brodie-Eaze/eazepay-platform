import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { problem, withMeta } from '../../../../lib/api-v1/shared';
import { enforce as enforceEdgeRateLimit } from '../../../../lib/edge-rate-limit.js';
import { extractBearerToken, verifyPartnerApiKey } from '../../../../lib/partner-api-key';

/**
 * Create application — `POST /api/v1/applications`.
 *
 * Idempotency-Key required. Returns the canonical application id +
 * status, and the snapshot_hash that lenders will see at quote time.
 *
 * Request body matches the normalized applicant context the
 * orchestration engine builds before fan-out to lenders.
 *
 * SEC-202 hardening (this file):
 *   (a) Authorization: Bearer <partner_api_key> required. The verifier
 *       is fail-closed until real keys are issued (see
 *       lib/partner-api-key.ts) — pre-fix the route was anonymous, so
 *       anyone on the internet could enqueue synthetic applications.
 *   (b) Per-IP edge rate limit (60/min) on top of the per-route auth.
 *       The pre-fix surface had no cap — a single attacker could flood
 *       the BFF and (in dev-fallback mode) the downstream queue.
 *   (c) `echoed_request` was REMOVED from the response envelope. Pre-
 *       fix the response echoed the full applicant block (PII: name,
 *       email, phone, monthly income). That was a textbook info-leak
 *       in any error / log / proxy surface that captured response
 *       bodies. We now return only `request_id_acknowledged: true`.
 *   (d) `application_id` is `crypto.randomUUID()` (non-deterministic),
 *       not `idFor(idemKey)`. Pre-fix an attacker controlling
 *       `Idempotency-Key` could choose the resulting application_id,
 *       enabling collision attacks against the orchestration store
 *       and lender-fanout idempotency.
 */

const RATE_LIMIT_PER_MIN = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const BodySchema = z.object({
  brand: z.enum(['tradepay', 'medpay', 'coachpay', 'direct']),
  channel: z
    .object({
      type: z.enum(['merchant', 'direct', 'partner_link']).default('direct'),
      merchant_ref: z.string().optional(),
      partner_ref: z.string().optional(),
    })
    .default({ type: 'direct' }),
  applicant: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    state: z.string().length(2).optional(),
    fico_band: z.string().optional(),
    income_monthly_cents: z.number().int().nonnegative().optional(),
    mla_covered: z.boolean().optional().default(false),
    scra_active: z.boolean().optional().default(false),
  }),
  request: z.object({
    amount_cents: z.number().int().min(50_000).max(15_000_000),
    term_months: z.number().int().min(6).max(144).optional().default(48),
    purpose: z.string().min(1),
    purpose_detail: z.string().optional(),
  }),
});

/**
 * Originating IP for rate-limit bucketing. Bucket-prefixed so this
 * counter is independent of other routes that share the same in-process
 * `edge-rate-limit` store.
 */
function rateLimitKey(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `v1-applications:${ip}`;
}

export async function POST(req: NextRequest) {
  // SEC-202 (a): auth check FIRST — before we read the body. Reading
  // the body for an unauthenticated caller would (1) let an attacker
  // flood the parser, (2) pull PII into request logs even on reject.
  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (!bearer) {
    return problem({
      title: 'Unauthorized',
      status: 401,
      code: 'unauthorized',
      detail: 'Send an Authorization: Bearer <partner_api_key> header.',
      instance: '/api/v1/applications',
    });
  }
  const principal = await verifyPartnerApiKey(bearer);
  if (!principal) {
    return problem({
      title: 'Unauthorized',
      status: 401,
      code: 'unauthorized',
      detail: 'The provided partner API key was not recognised.',
      instance: '/api/v1/applications',
    });
  }

  // SEC-202 (b): edge rate-limit. Auth passes — still enforce a
  // per-IP cap so a leaked key cannot be used to flood the surface.
  const rl = enforceEdgeRateLimit(rateLimitKey(req), RATE_LIMIT_PER_MIN, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'rate_limited',
        instance: '/api/v1/applications',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(rl.retryAfterMs / 1000).toString(),
        },
      },
    );
  }

  const idemKey = req.headers.get('idempotency-key');
  if (!idemKey) {
    return problem({
      title: 'Bad Request',
      status: 400,
      code: 'missing_idempotency_key',
      detail: 'Send an Idempotency-Key header so retries are safe.',
      instance: '/api/v1/applications',
    });
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem({
      title: 'Unprocessable Entity',
      status: 422,
      code: 'invalid_payload',
      detail: 'See `errors` for field-level issues.',
      instance: '/api/v1/applications',
    });
  }

  // SEC-202 (d): server-generated UUID. Never derive the resource id
  // from caller-controlled input.
  const applicationId = `app_${randomUUID()}`;
  // Snapshot hash is a server-side digest placeholder; once the
  // orchestrator wiring lands here it will compute over the normalised
  // applicant context. The placeholder is also server-generated so
  // there's no caller-influence vector.
  const snapshotHash = `sha256:${randomUUID().replace(/-/g, '').slice(0, 12)}…`;

  return NextResponse.json(
    withMeta(
      {
        application_id: applicationId,
        status: 'draft',
        brand: parsed.data.brand,
        snapshot_hash: snapshotHash,
        policy_version: 'orch_v_2026_05_a',
        created_at: new Date().toISOString(),
        next_step: {
          url: `/api/v1/applications/${applicationId}/submit`,
          method: 'POST',
          body: { consent: { tila: true, fcra_soft: true, esign: true } },
        },
      },
      {
        endpoint: 'POST /api/v1/applications',
        idempotency_key: idemKey,
        // SEC-202 (c): do NOT echo the parsed request body — it contains
        // applicant PII. Acknowledge receipt only.
        request_id_acknowledged: true,
        partner_id: principal.partnerId,
      },
    ),
    { status: 201 },
  );
}
