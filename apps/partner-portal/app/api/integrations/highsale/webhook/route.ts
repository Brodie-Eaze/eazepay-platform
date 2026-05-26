import { NextResponse, type NextRequest } from 'next/server';
import { verifyHighsaleSignature, type HighsaleWebhookEvent } from '@/lib/highsale/client';

/**
 * POST /api/integrations/highsale/webhook
 *
 * Inbound webhook receiver for HighSale + Milly lifecycle events:
 *
 *   • pull.completed            → write decisions row + trigger marketplace fan-out
 *   • pull.failed                → mark application 'declined' with FCRA-safe reason
 *   • subaccount.suspended       → flag partner as throttled (accounts team alert)
 *   • milly.invoice.issued       → write to billing system; surface in partner dashboard
 *   • milly.invoice.paid         → mark invoice settled
 *   • milly.invoice.failed       → trigger probation extension + Slack alert
 *
 * Signature verification is HMAC-SHA256 with constant-time compare.
 * Without HIGHSALE_WEBHOOK_SECRET configured the route accepts every
 * event (dev mode) — production deployments must set the secret.
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('highsale-signature') ?? '';

  if (!verifyHighsaleSignature(rawBody, signatureHeader)) {
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

  let event: HighsaleWebhookEvent;
  try {
    event = JSON.parse(rawBody) as HighsaleWebhookEvent;
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

  switch (event.type) {
    case 'pull.completed':
      // TODO(orchestrator): INSERT INTO decisions ...; fan out to lender marketplace
      break;
    case 'pull.failed':
      // TODO(orchestrator): UPDATE applications SET status='declined', mark FCRA reason
      break;
    case 'subaccount.suspended':
      // TODO(orchestrator): UPDATE partners SET status='throttled'; INSERT INTO audit_log
      break;
    case 'milly.invoice.issued':
      // TODO(billing): wire to invoicing.ts to persist + render in partner dashboard
      break;
    case 'milly.invoice.paid':
      // TODO(billing): mark invoice settled
      break;
    case 'milly.invoice.failed':
      // TODO(ops): extend probation, Slack alert
      break;
  }

  return NextResponse.json({ ok: true, received: event.type });
}
