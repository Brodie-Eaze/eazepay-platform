import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { idFor, problem, withMeta } from '../../../../../../lib/api-v1/shared';
import { enforceCsrf } from '../../../../../../lib/csrf';

/**
 * Submit application — `POST /api/v1/applications/[id]/submit`.
 *
 * Triggers orchestration: soft pull → affordability → knockouts →
 * tiered lender waterfall. Returns the orchestration evaluation id —
 * fetch `/applications/[id]/offers` once status === 'offers_ready'.
 */

const BodySchema = z.object({
  consent: z.object({
    tila: z.literal(true),
    fcra_soft: z.literal(true),
    esign: z.literal(true),
  }),
});

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  // SEC-205: explicit-consent submission must be CSRF-protected. A
  // cross-site forged POST could trigger orchestration (and downstream
  // soft-pull bureau hits) under a victim's account.
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem({
      title: 'Unprocessable Entity',
      status: 422,
      code: 'consent_required',
      detail: 'tila + fcra_soft + esign must all be explicitly true.',
      instance: `/api/v1/applications/${ctx.params.id}/submit`,
    });
  }

  return NextResponse.json(
    withMeta(
      {
        application_id: ctx.params.id,
        status: 'orchestrating',
        evaluation_id: idFor('eval', ctx.params.id),
        estimated_offers_ready_in_ms: 2200,
        consent_event_id: idFor('cons', `${ctx.params.id}-tila-fcra-esign`),
        adverse_action_if_declined: {
          delivery_window_days: 30,
          channel: 'in_app + email',
          taxonomy: 'reg_b_1002_examples_v2026.05',
        },
      },
      { endpoint: `POST /api/v1/applications/${ctx.params.id}/submit` },
    ),
    { status: 202 },
  );
}
