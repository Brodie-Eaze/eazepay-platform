import { NextResponse, type NextRequest } from 'next/server';
import { idFor, withMeta } from '../../../../../../lib/api-v1/shared';

/**
 * Accept offer — `POST /api/v1/offers/[id]/accept`.
 *
 * The applicant binds the chosen offer. EazePay drives the e-sign +
 * pre-contract TILA disclosure flow, then calls the lender's
 * `bind` endpoint. Once funded the lender posts back via webhook.
 */
export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  return NextResponse.json(
    withMeta(
      {
        offer_id: ctx.params.id,
        status: 'binding',
        loan_id: idFor('loan', ctx.params.id),
        tila_pre_contract_disclosure_url: `/disclosures/tila/${ctx.params.id}.pdf`,
        esign_envelope_id: idFor('esign', ctx.params.id),
        bind_step: {
          server_to_server: {
            url: 'https://api.eazepay.com/v1/partner/offers/{offer_id}/bind',
            method: 'POST',
            timeout_ms: 8000,
          },
        },
        funding_step: {
          expected_rail: 'rtp',
          fallback_rail: 'ach_same_day',
          window: '24-48h',
        },
      },
      { endpoint: `POST /api/v1/offers/${ctx.params.id}/accept` },
    ),
    { status: 202 },
  );
}
