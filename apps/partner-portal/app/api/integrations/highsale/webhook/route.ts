import { NextResponse, type NextRequest } from 'next/server';
import { verifyHighsaleSignature } from '@/lib/highsale/client';
import { getDb, hasDb, schema } from '@/lib/db';
import { extractProviderEventId } from '@/lib/workers/webhook-processor';
import { safeLog } from '@/lib/safe-log';

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
 * Signature verification is HMAC-SHA256 with constant-time compare,
 * fail-closed (SEC-002): a missing secret in production aborts module
 * load, and a missing/stale/forged signature is rejected with a 401
 * carrying a machine-readable `code`. The rejection reason is logged
 * to safeLog for audit.
 *
 * Inbox pattern (Task #43): verified events are durably persisted in
 * `webhook_inbox` keyed by (provider, event_id) BEFORE we ack 200. The
 * actual handler dispatch runs async in `lib/workers/webhook-processor.ts`
 * so a crash mid-handler can't silently drop an event — upstream sees
 * 200 because the row is on disk; the worker keeps retrying until the
 * handler succeeds.
 */

export const runtime = 'nodejs';

const PROVIDER = 'highsale' as const;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('highsale-signature') ?? '';

  const verification = verifyHighsaleSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    safeLog.warn({
      event: 'highsale.webhook.rejected',
      reason: verification.reason,
      hasSignatureHeader: signatureHeader.length > 0,
      bodyBytes: rawBody.length,
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'invalid_signature',
        reason: verification.reason,
      },
      { status: 401 },
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
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

  const eventType = typeof event.type === 'string' ? event.type : null;
  if (!eventType) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'missing_event_type',
      },
      { status: 400 },
    );
  }

  const eventId = extractProviderEventId(event);
  if (!eventId) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'missing_event_id',
        detail: 'HighSale event payload is missing both `id` and `event_id`.',
      },
      { status: 400 },
    );
  }

  if (!hasDb()) {
    safeLog.error({
      event: 'webhook.inbox.db_unavailable',
      provider: PROVIDER,
      eventType,
      eventId,
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        code: 'db_unavailable',
      },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    const inserted = await db
      .insert(schema.webhookInbox)
      .values({
        provider: PROVIDER,
        eventId,
        eventType,
        rawBody,
        signatureHeader,
      })
      .onConflictDoNothing({
        target: [schema.webhookInbox.provider, schema.webhookInbox.eventId],
      })
      .returning({ id: schema.webhookInbox.id });

    if (inserted.length === 0) {
      safeLog.info({
        event: 'webhook.inbox.duplicate',
        provider: PROVIDER,
        eventType,
        eventId,
      });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    safeLog.info({
      event: 'webhook.inbox.queued',
      provider: PROVIDER,
      eventType,
      eventId,
      inboxId: inserted[0]!.id,
    });
    return NextResponse.json({ ok: true, queued: true });
  } catch (err) {
    safeLog.error({
      event: 'webhook.inbox.write_failed',
      provider: PROVIDER,
      eventType,
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Service Unavailable',
        status: 503,
        code: 'inbox_write_failed',
      },
      { status: 503 },
    );
  }
}
