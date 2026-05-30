import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  idFor,
  lenderWebhookSecret,
  problem,
  requireSignatureCheck,
  SAMPLE_LENDERS,
  verifySignature,
  withMeta,
} from '../../../../../../lib/api-v1/shared';
/* SEC-RLS-2 — every DB write on this route runs through
 * `withRawTenantContext(PUBLIC_CONSUMER_CONTEXT, …)`. The lender POST
 * is unauthenticated by user-session; HMAC signature verification IS
 * the auth. The route only touches `webhook_inbox`, which is platform-
 * global today (not RLS-protected); the consumer-tier GUC is harmless
 * on that insert, but if a future migration adds RLS to the inbox we
 * fail-CLOSED here rather than silently leak across providers. Tenant
 * writes into RLS-protected tables happen later, in the worker, under
 * `SYSTEM_WEBHOOK_CONTEXT`. Matches the MiCamp + HighSale sibling
 * routes byte-for-byte. */
import {
  hasDb,
  PUBLIC_CONSUMER_CONTEXT,
  schema,
  withRawTenantContext,
} from '../../../../../../lib/db';
import { hasQueue } from '../../../../../../lib/queue';
import { extractProviderEventId } from '../../../../../../lib/workers/webhook-processor';
import { safeLog } from '../../../../../../lib/safe-log';

/**
 * Inbound lender webhook — `POST /api/v1/webhooks/lenders/[lender]`.
 *
 * Lenders POST status changes here (`application.quoted`,
 * `application.decisioned`, `offer.bound`, `loan.funded`, `loan.repaid`,
 * `loan.defaulted`, `hardship.opened`). This route is the durable
 * intake — verify the HMAC, deduplicate at the inbox layer, ack 200
 * fast, and let the BullMQ webhook worker drain the row asynchronously
 * via `handleLenderInboxRow()` in `lib/workers/lender-webhook-handler.ts`.
 *
 * Why the inbox dedupe matters (P0 — pre-fix the route handled this
 * inline with NO `webhook_inbox` row at all):
 *
 *   1. A DB error during persistence was caught, swallowed, and we
 *      returned 200. The lender never retried — and the
 *      `applications.status` flip for `loan.funded` was silently lost.
 *      The funded loan stayed `approved` forever.
 *
 *   2. No `(provider, event_id)` dedupe. Lenders DO retry — they treat
 *      "ack came after our crash" as "maybe delivered" and replay. The
 *      replay re-fired `notifyApplicationOutcome` → duplicate consumer
 *      email + SMS for the same funding event.
 *
 * Fixed contract:
 *
 *   • Signature missing/invalid → 401 (unchanged path via shared
 *     `requireSignatureCheck`).
 *   • Body not JSON              → 400.
 *   • Missing event_id           → 400 (no point retrying — sender bug).
 *   • DB not configured          → 503 (lender retries). Pre-fix: 200.
 *   • Duplicate (provider,event_id) → 200 {duplicate:true, inbox_id}
 *     and we skip the enqueue. The original row is what fires the
 *     side-effects exactly once.
 *   • New row inserted          → enqueue to BullMQ webhook-inbox
 *     (jobId = inboxId for idempotency), 200 {duplicate:false}.
 *   • Insert exception           → 500 (lender retries). Pre-fix: 200.
 *
 * The route NO LONGER touches `applications` / `offers` /
 * `application_events` directly — that work belongs to the worker.
 * Same shape as the MiCamp + HighSale inbox routes; convergence
 * matters because the next lender we onboard reuses this exact code.
 */

export const runtime = 'nodejs';

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

  // Raw bytes BEFORE JSON parse — required for the HMAC verify, and
  // stored verbatim on the inbox row so the worker can replay on a
  // bugfix without re-asking the lender.
  const bodyText = await req.text();

  const sigCheck = await verifySignature({
    timestamp: req.headers.get('x-eazepay-timestamp'),
    nonce: req.headers.get('x-eazepay-nonce'),
    signature: req.headers.get('x-eazepay-signature'),
    body: bodyText,
    // SEC-EZ-001 — per-lender secret from env (LENDER_<SLUG>_WEBHOOK_SECRET
    // or LENDER_WEBHOOK_SECRET). Empty in prod when unset → fail-closed.
    secret: lenderWebhookSecret(lender.id),
  });
  // SEC-003: in prod (or REQUIRE_HMAC=true) a 'skipped' result is
  // rejected the same as 'invalid' — anyone could POST fake lender
  // status updates otherwise.
  const sigReject = requireSignatureCheck(
    sigCheck,
    `/api/v1/webhooks/lenders/${ctx.params.lender}`,
  );
  if (sigReject) {
    return problem(sigReject);
  }

  // Parse to extract event_type + event_id (idempotency key) only.
  // Schema-level validation happens in the worker — invalid shapes
  // become a `failed` inbox row with a structured reason rather than
  // a 4xx that the lender retries forever.
  let event: Record<string, unknown> = {};
  try {
    event = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return problem({
      title: 'Bad Request',
      status: 400,
      code: 'invalid_json',
      detail: 'Lender webhook body was not valid JSON.',
      instance: `/api/v1/webhooks/lenders/${ctx.params.lender}`,
    });
  }

  const eventType = typeof event.event_type === 'string' ? event.event_type : 'unknown';
  // Lenders use either `event_id` or `id`. extractProviderEventId
  // tries both. We do NOT mint a synthetic id on miss — that would
  // defeat dedupe (every retry would coin a fresh id and re-enter).
  const eventId = extractProviderEventId(event);
  if (!eventId) {
    return problem({
      title: 'Bad Request',
      status: 400,
      code: 'missing_event_id',
      detail: 'Lender event payload is missing both `event_id` and `id`.',
      instance: `/api/v1/webhooks/lenders/${ctx.params.lender}`,
    });
  }

  // No DB → no inbox dedupe → cannot honestly ack. 503 so the lender
  // retries until Postgres is back. Pre-fix: we returned 200 anyway
  // and silently dropped the event.
  if (!hasDb()) {
    safeLog.error({
      event: 'webhook.inbox.db_unavailable',
      provider: lender.id,
      eventType,
      eventId,
    });
    return problem({
      title: 'Service Unavailable',
      status: 503,
      code: 'db_unavailable',
      detail: 'Webhook inbox is offline; lender should retry.',
      instance: `/api/v1/webhooks/lenders/${ctx.params.lender}`,
    });
  }

  try {
    const inserted = await withRawTenantContext(PUBLIC_CONSUMER_CONTEXT, (tx) =>
      tx
        .insert(schema.webhookInbox)
        .values({
          provider: lender.id,
          eventId,
          eventType,
          rawBody: bodyText,
          signatureHeader: req.headers.get('x-eazepay-signature'),
        })
        .onConflictDoNothing({
          target: [schema.webhookInbox.provider, schema.webhookInbox.eventId],
        })
        .returning({ id: schema.webhookInbox.id }),
    );

    if (inserted.length === 0) {
      // Replay — lender re-sending after a missed ack. Already in
      // the inbox, already enqueued (or done). No-op + 200.
      // This is the path that prevents the duplicate consumer
      // email + SMS for repeat `loan.funded` deliveries.
      const dup = await withRawTenantContext(PUBLIC_CONSUMER_CONTEXT, (tx) =>
        tx
          .select({ id: schema.webhookInbox.id })
          .from(schema.webhookInbox)
          .where(
            and(
              eq(schema.webhookInbox.provider, lender.id),
              eq(schema.webhookInbox.eventId, eventId),
            ),
          )
          .limit(1),
      );
      const inboxId = dup[0]?.id ?? null;
      safeLog.info({
        event: 'webhook.inbox.duplicate',
        provider: lender.id,
        eventType,
        eventId,
        inboxId,
      });
      return NextResponse.json(
        withMeta(
          {
            received: true,
            ingest_id: idFor('wh', `${lender.id}-${eventType}-${eventId}`),
            event_type: eventType,
            idempotent: true,
            duplicate: true,
            inbox_id: inboxId,
          },
          {
            endpoint: `POST /api/v1/webhooks/lenders/${ctx.params.lender}`,
            signature_status: sigCheck.status,
          },
        ),
      );
    }

    const inboxId = inserted[0]!.id;

    // Enqueue the row for the BullMQ webhook-inbox worker. When
    // REDIS_URL is unset (local dev / Redis-less env), the admin
    // tick endpoint at `/api/admin/webhook-processor/tick` is the
    // manual escape hatch — the inbox row is durably persisted, so
    // the ack is honest even if the dispatch is deferred.
    if (hasQueue()) {
      try {
        const { enqueueWebhookInbox } = await import('../../../../../../lib/queue/webhooks');
        await enqueueWebhookInbox(inboxId);
      } catch (err) {
        // Enqueue failure is logged but does NOT cause a 5xx: the
        // inbox row is on disk and the admin tick endpoint can drain
        // it manually. The lender still gets the 200 they're waiting
        // for so we don't trigger a retry storm against an already-
        // persisted event.
        safeLog.error({
          event: 'webhook.inbox.enqueue_failed',
          provider: lender.id,
          inboxId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    safeLog.info({
      event: 'webhook.inbox.queued',
      provider: lender.id,
      eventType,
      eventId,
      inboxId,
    });

    return NextResponse.json(
      withMeta(
        {
          received: true,
          ingest_id: idFor('wh', `${lender.id}-${eventType}-${eventId}`),
          event_type: eventType,
          idempotent: true,
          duplicate: false,
          inbox_id: inboxId,
          next_retry_window_ms: 60_000,
        },
        {
          endpoint: `POST /api/v1/webhooks/lenders/${ctx.params.lender}`,
          signature_status: sigCheck.status,
        },
      ),
    );
  } catch (err) {
    // Inbox INSERT failed for a reason other than the unique conflict.
    // 500 (NOT 200) so the lender retries with backoff. Pre-fix this
    // was swallowed into a meta field nobody read, and the lender
    // happily moved on as if delivered.
    safeLog.error({
      event: 'webhook.inbox.write_failed',
      provider: lender.id,
      eventType,
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return problem({
      title: 'Internal Server Error',
      status: 500,
      code: 'inbox_write_failed',
      detail: 'Persisting the lender webhook to the inbox failed.',
      instance: `/api/v1/webhooks/lenders/${ctx.params.lender}`,
    });
  }
}
