import { NextResponse } from 'next/server';
import {
  SAMPLE_APPLICATION,
  SAMPLE_LENDERS,
  SAMPLE_OFFER,
  withMeta,
} from '../../../../lib/api-v1/shared';

/**
 * Sample bundle — `GET /api/v1/sample`.
 *
 * Returns canonical sample payloads for every shape in the lender
 * contract. A lender's QA team can drop this directly into their
 * adapter test suite.
 */
export async function GET() {
  return NextResponse.json(
    withMeta(
      {
        application: SAMPLE_APPLICATION,
        offer: SAMPLE_OFFER,
        lenders: SAMPLE_LENDERS,
        webhook_events: [
          {
            event_type: 'application.decisioned',
            event_version: 1,
            data: {
              application_id: 'app_4nqLkR2vTjW',
              decision: 'approved',
              lender_product_id: 'lp_buzzpay_prime',
            },
          },
          {
            event_type: 'offer.bound',
            event_version: 1,
            data: { offer_id: 'off_8gQpZc7Tw9N', loan_id: 'loan_2KvN8aR' },
          },
          {
            event_type: 'loan.funded',
            event_version: 1,
            data: {
              loan_id: 'loan_2KvN8aR',
              rail: 'rtp',
              disbursed_at: '2026-05-14T18:42:01Z',
              amount_cents: 18_500_00,
            },
          },
        ],
      },
      { endpoint: 'GET /api/v1/sample' },
    ),
  );
}
