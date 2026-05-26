import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhookSignature } from '@/lib/micamp/client';
import { getDb, hasDb, schema } from '@/lib/db';
import { extractProviderEventId } from '@/lib/workers/webhook-processor';
import { safeLog } from '@/lib/safe-log';
import { incrementMetric } from '@/lib/observability/metrics';
import { hasQueue } from '@/lib/queue';

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
 * Signature verification is HMAC-SHA256 with constant-time compare,
 * fail-closed (SEC-002): a missing secret in production aborts module
 * load, and a missing/stale/forged signature is rejected with a 401
 * carrying a machine-readable `code`. The rejection reason is logged to
 * safeLog for audit.
 *
 * Inbox pattern (Task #43): verified events are durably persisted in
 * `webhook_inbox` keyed by (provider, event_id) BEFORE we ack 200. The
 * actual handler dispatch runs async in `lib/workers/webhook-processor.ts`
 * so a crash mid-handler can't silently drop an event — upstream sees
 * 200 because the row is on disk; the worker keeps retrying until the
 * handler succeeds.
 *
 * Failure semantics:
 *   • bad signature           → 401 (no retry storm)
 *   • malformed JSON / no id   → 400 (no retry — sender bug)
 *   • DB write failed          → 503 (upstream retries)
 *   • duplicate event id       → 200 with `{ duplicate: true }`
 *   • DB write succeeded       → 200 with `{ queued: true }`
 */

export const runtime = 'nodejs';

const PROVIDER = 'micamp' as const;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('micamp-signature') ?? '';

  const verification = verifyWebhookSignature(rawBody, signatureHeader);
  if (!verification.valid) {
    incrementMetric('webhook.rejected');
    safeLog.warn({
      event: 'micamp.webhook.rejected',
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
    // No upstream id => upstream bug. Refuse rather than coin an id
    // ourselves; a coined id defeats dedupe on the upstream's retry.
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'missing_event_id',
        detail: 'MiCamp event payload is missing both `id` and `event_id`.',
      },
      { status: 400 },
    );
  }

  if (!hasDb()) {
    // Without a DB we cannot dedupe — refuse with 503 so upstream
    // retries until the DB is wired. Never silently ack.
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
      // Replay — already in the inbox. Do NOT enqueue again; the
      // worker handled (or will handle) the original row.
      incrementMetric('webhook.duplicate');
      safeLog.info({
        event: 'webhook.inbox.duplicate',
        provider: PROVIDER,
        eventType,
        eventId,
      });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const inboxId = inserted[0]!.id;

    // Enqueue the row for the BullMQ webhooks worker (Task #50).
    // When REDIS_URL is unset (local dev / Redis-less env), the admin
    // tick endpoint at /api/admin/webhook-processor/tick is the manual
    // escape hatch — the inbox row is still durably persisted, so the
    // ack is honest even if the dispatch is deferred.
    if (hasQueue()) {
      try {
        const { enqueueWebhookInbox } = await import('@/lib/queue/webhooks');
        await enqueueWebhookInbox(inboxId);
      } catch (err) {
        // Enqueue failure is logged but does NOT cause a 5xx: the
        // inbox row is on disk and the admin tick endpoint can drain
        // it manually. Upstream still gets the 200 they're waiting
        // for so we don't trigger a retry storm.
        safeLog.error({
          event: 'webhook.inbox.enqueue_failed',
          provider: PROVIDER,
          inboxId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    incrementMetric('webhook.queued');
    safeLog.info({
      event: 'webhook.inbox.queued',
      provider: PROVIDER,
      eventType,
      eventId,
      inboxId,
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
