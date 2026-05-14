import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { idFor, problem, withMeta } from '../../../../lib/api-v1/shared';

/**
 * Create application — `POST /api/v1/applications`.
 *
 * Idempotency-Key required. Returns the canonical application id +
 * status, and the snapshot_hash that lenders will see at quote time.
 *
 * Request body matches the normalized applicant context the
 * orchestration engine builds before fan-out to lenders.
 */

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

export async function POST(req: NextRequest) {
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

  const applicationId = idFor('app', idemKey);
  const snapshotHash = `sha256:${idFor('snap', idemKey).slice(4)}…`;

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
        echoed_request: parsed.data,
      },
    ),
    { status: 201 },
  );
}
