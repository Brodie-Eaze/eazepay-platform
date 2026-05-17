import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  offerFor,
  problem,
  requireSignatureCheck,
  SAMPLE_LENDERS,
  verifySignature,
  withMeta,
} from '../../../../../../lib/api-v1/shared';

/**
 * Lender quote — `POST /api/v1/lenders/[lenderId]/quote`.
 *
 * Reference implementation of the inbound `quote` endpoint a lender
 * stands up on their side. EazePay POSTs a normalised applicant +
 * bureau snapshot here; the lender's adapter responds with an offer,
 * decline, counter, or ineligible inside the SLA.
 *
 * In demo mode we play the lender's role too — POST the canonical
 * application body, get back the offer we'd return. The signature is
 * verified when headers are present.
 */

const ApplicantSchema = z.object({
  state: z.string().length(2).optional(),
  fico_band: z.string().optional(),
  income_monthly_cents: z.number().int().nonnegative().optional(),
  dti_pct: z.number().nonnegative().optional(),
  cashflow_score: z.number().min(0).max(1).optional(),
  mla_covered: z.boolean().optional().default(false),
  scra_active: z.boolean().optional().default(false),
});

const BodySchema = z.object({
  application_id: z.string().min(1),
  policy_version: z.string().min(1),
  snapshot_hash: z.string().min(1),
  applicant: ApplicantSchema,
  request: z.object({
    amount_cents: z.number().int().min(50_000).max(15_000_000),
    term_months: z.number().int().min(6).max(144),
    category: z.string().optional(),
  }),
  permissible_purpose: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: { lenderId: string } }) {
  const lender = SAMPLE_LENDERS.find((l) => l.id === ctx.params.lenderId);
  if (!lender) {
    return problem({
      title: 'Not Found',
      status: 404,
      code: 'lender_not_found',
      detail: `No lender product registered with id "${ctx.params.lenderId}".`,
      instance: `/api/v1/lenders/${ctx.params.lenderId}/quote`,
    });
  }

  const bodyText = await req.text();
  const sigCheck = await verifySignature({
    timestamp: req.headers.get('x-eazepay-timestamp'),
    nonce: req.headers.get('x-eazepay-nonce'),
    signature: req.headers.get('x-eazepay-signature'),
    body: bodyText,
  });
  // SEC-003: in prod (or REQUIRE_HMAC=true) a 'skipped' result — i.e.
  // no signature headers at all — is rejected the same as 'invalid' /
  // 'missing'. Without this gate, an unauthenticated caller can hit
  // this endpoint and receive a real offer payload.
  const sigReject = requireSignatureCheck(sigCheck, `/api/v1/lenders/${ctx.params.lenderId}/quote`);
  if (sigReject) {
    return problem(sigReject);
  }

  let raw: unknown = null;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    /* ignore */
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return problem({
      title: 'Unprocessable Entity',
      status: 422,
      code: 'invalid_quote_payload',
      detail: 'See `errors` for field-level issues.',
      instance: `/api/v1/lenders/${ctx.params.lenderId}/quote`,
    });
  }

  const amount = parsed.data.request.amount_cents;
  if (amount < lender.min_amount_cents || amount > lender.max_amount_cents) {
    return NextResponse.json(
      withMeta(
        {
          decision: 'ineligible',
          reason_codes: ['amount_outside_envelope'],
          policy_version: parsed.data.policy_version,
        },
        {
          endpoint: `POST /api/v1/lenders/${ctx.params.lenderId}/quote`,
          signature_status: sigCheck.status,
        },
      ),
      { status: 200 },
    );
  }

  return NextResponse.json(
    withMeta(
      {
        decision: 'approved',
        offer: offerFor(lender, amount, parsed.data.request.term_months),
        reason_codes: ['approved_within_policy'],
        policy_version: parsed.data.policy_version,
        valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      {
        endpoint: `POST /api/v1/lenders/${ctx.params.lenderId}/quote`,
        signature_status: sigCheck.status,
        signature_reason: sigCheck.reason,
      },
    ),
  );
}
