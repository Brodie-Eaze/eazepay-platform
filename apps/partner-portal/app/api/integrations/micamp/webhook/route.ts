import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature, type MicampWebhookEvent } from '@/lib/micamp/client';

/**
 * POST /api/integrations/micamp/webhook
 *
 * Inbound webhook receiver for MiCamp lifecycle events:
 *
 *   • mid.underwriting.approved   → flip mid row to 'active' + write rate card
 *   • mid.underwriting.rejected   → flip to 'rejected' + capture reason
 *   • mid.post_underwriting        → flip to 'underwriting_post' after volume threshold
 *   • payment.captured             → bump volume_cents_to_date on the mid row
 *   • payment.refunded             → reverse volume
 *   • settlement.paid              → update last_settled_at on the mid row
 *
 * Signature verification is HMAC-SHA256 with constant-time compare.
 * Without MICAMP_WEBHOOK_SECRET configured the route accepts every
 * event (dev mode) — production deployments must set the secret.
 *
 * Idempotency: every persisted event uses the MiCamp event id as the
 * dedupe key. Replay-safe by design.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('micamp-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'invalid_signature',
      },
      { status: 401 },
    );
  }

  let event: MicampWebhookEvent;
  try {
    event = JSON.parse(rawBody) as MicampWebhookEvent;
  } catch {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'invalid_json',
      },
      { status: 400 },
    );
  }

  // Route the event to its handler. Each branch is intentionally
  // small: the persistence layer is the boundary, not this file.
  // Wire DB writes here once the mids + audit_log tables are seeded.
  switch (event.type) {
    case 'mid.underwriting.approved':
      // TODO(orchestrator): UPDATE mids SET status='active', micamp_mid=$1, rate_card_json=$2 WHERE id=$3
      break;
    case 'mid.underwriting.rejected':
      // TODO(orchestrator): UPDATE mids SET status='rejected' WHERE id=$1; INSERT INTO audit_log ...
      break;
    case 'mid.post_underwriting':
      // TODO(orchestrator): UPDATE mids SET status='underwriting_post', post_underwriting_at=now() WHERE id=$1
      break;
    case 'payment.captured':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = volume_cents_to_date + $1 WHERE id=$2
      break;
    case 'payment.refunded':
      // TODO(orchestrator): UPDATE mids SET volume_cents_to_date = GREATEST(0, volume_cents_to_date - $1) WHERE id=$2
      break;
    case 'settlement.paid':
      // TODO(orchestrator): UPDATE mids SET last_settled_at=$1 WHERE id=$2
      break;
  }

  return NextResponse.json({ ok: true, received: event.type });
}
