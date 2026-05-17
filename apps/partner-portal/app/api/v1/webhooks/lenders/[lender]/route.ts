import { NextResponse, type NextRequest } from 'next/server';
import {
  idFor,
  problem,
  requireSignatureCheck,
  SAMPLE_LENDERS,
  verifySignature,
  withMeta,
} from '../../../../../../lib/api-v1/shared';

/**
 * Inbound lender webhook — `POST /api/v1/webhooks/lenders/[lender]`.
 *
 * Lenders POST status changes here: application.decisioned,
 * offer.bound, loan.funded, loan.repaid, loan.defaulted, hardship.opened.
 * Same HMAC scheme as outbound — timestamp + nonce + body.
 */

export async function POST(req: NextRequest, ctx: { params: { lender: string } }) {
  const lender = SAMPLE_LENDERS.find(
    (l) =>
      l.id === ctx.params.lender ||
      l.display_name.toLowerCase() === ctx.params.lender.toLowerCase(),
  );
  if (!lender) {
    return problem({
      title: 'Not Found',
      status: 404,
      code: 'unknown_lender',
      detail: `No registered lender matching "${ctx.params.lender}".`,
      instance: `/api/v1/webhooks/lenders/${ctx.params.lender}`,
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
  // 'missing'. Without this gate, anyone can POST fake lender status
  // updates (loan.funded, application.decisioned, etc.) and we'd
  // ingest them as authentic.
  const sigReject = requireSignatureCheck(
    sigCheck,
    `/api/v1/webhooks/lenders/${ctx.params.lender}`,
  );
  if (sigReject) {
    return problem(sigReject);
  }

  let event: { event_type?: string; loan_id?: string; offer_id?: string } = {};
  try {
    event = JSON.parse(bodyText);
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    withMeta(
      {
        received: true,
        ingest_id: idFor('wh', `${lender.id}-${event.event_type ?? 'unknown'}-${Date.now()}`),
        event_type: event.event_type ?? 'unknown',
        idempotent: true,
        next_retry_window_ms: 60_000,
      },
      {
        endpoint: `POST /api/v1/webhooks/lenders/${ctx.params.lender}`,
        signature_status: sigCheck.status,
        signature_reason: sigCheck.reason,
        echoed_event: event,
      },
    ),
  );
}
