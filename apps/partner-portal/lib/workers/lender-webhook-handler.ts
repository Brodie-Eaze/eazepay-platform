/**
 * Lender webhook dispatch — extracted from the inline route handler
 * in `app/api/v1/webhooks/lenders/[lender]/route.ts`.
 *
 * Why the route no longer does this inline: the route used to verify
 * the HMAC, Zod-parse the payload, persist state, AND fire side-effects
 * (realtime push + consumer outcome notifications) in a single request.
 * Two compounding bugs fell out of that shape:
 *
 *   1. A DB hiccup during persistence was caught + swallowed, so the
 *      route still returned 200. The lender never retried — and the
 *      `applications.status` update for a `loan.funded` event was
 *      silently lost. The funded loan stayed `approved` forever.
 *
 *   2. No `webhook_inbox` dedupe row. Lenders DO retry — they treat
 *      every 2xx that came after their own crash as "maybe delivered".
 *      A replay of `loan.funded` re-fired `notifyApplicationOutcome` →
 *      duplicate consumer email + SMS for the same funding event.
 *
 * Fix split:
 *
 *   • Route now matches MiCamp + HighSale: verify → INSERT INTO
 *     webhook_inbox ON CONFLICT DO NOTHING → enqueue → 200. DB
 *     unavailable returns 503 (lender retries); persistence failure
 *     returns 500 (lender retries).
 *   • This module owns persistence + side-effects. Called by the
 *     BullMQ worker via the inbox-row dispatch in `webhook-processor.ts`.
 *     Throws on failure so BullMQ retries with backoff and the row's
 *     `failure_reason` is recorded for ops.
 *
 * Idempotency contract: the `webhook_inbox` unique index on
 * (provider, event_id) gates duplicate deliveries BEFORE this handler
 * runs. The second delivery hits the unique index, returns
 * `duplicate:true` without enqueuing, and this handler runs exactly
 * once per upstream event. Consumer email + SMS no longer double-fire.
 */

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db';
import { SAMPLE_LENDERS, type SampleLender } from '../api-v1/shared';
import {
  publishApplicationEvent,
  type ApplicationLifecycleEvent,
} from '../realtime';
import {
  notifyApplicationOutcome,
  type OutcomeEventType,
} from '../notify-application-outcome';
import { safeLog } from '../safe-log';

/* ---------- Zod contract (mirrors the route's original schemas) ----- */

const EventBaseSchema = z.object({
  event_type: z.string().min(1),
  application_id: z.string().uuid().optional(),
  loan_id: z.string().optional(),
  offer_id: z.string().optional(),
});

const OfferSchema = z.object({
  amount_cents: z.number().int().nonnegative().optional(),
  apr_bps: z.number().int().nonnegative().optional(),
  term_months: z.number().int().nonnegative().optional(),
  monthly_payment_cents: z.number().int().nonnegative().optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

const QuotedSchema = EventBaseSchema.extend({
  event_type: z.literal('application.quoted'),
  application_id: z.string().uuid(),
  decision: z.enum(['approved', 'counter', 'declined', 'ineligible']),
  offer: OfferSchema.optional(),
  declined_reason: z.string().optional(),
});

const DecisionedSchema = EventBaseSchema.extend({
  event_type: z.literal('application.decisioned'),
  application_id: z.string().uuid(),
  decision: z.enum(['approved', 'declined']),
  offer: OfferSchema.optional(),
  declined_reason: z.string().optional(),
});

const BoundSchema = EventBaseSchema.extend({
  event_type: z.literal('offer.bound'),
  application_id: z.string().uuid(),
});

const FundedSchema = EventBaseSchema.extend({
  event_type: z.literal('loan.funded'),
  application_id: z.string().uuid(),
});

const NoteOnlySchema = EventBaseSchema.extend({
  event_type: z.enum(['loan.repaid', 'loan.defaulted', 'hardship.opened']),
  application_id: z.string().uuid(),
});

/* ---------- entry points ---------- */

/**
 * Look up a lender by slug — accepts either the registered id
 * (`lp_buzzpay_prime`) or the display name (`BuzzPay`, case-insensitive).
 * The provider string stored on the inbox row is always the canonical
 * lender id, so the worker round-trip is symmetric.
 */
export function resolveLender(slug: string): SampleLender | null {
  return (
    SAMPLE_LENDERS.find(
      (l) => l.id === slug || l.display_name.toLowerCase() === slug.toLowerCase(),
    ) ?? null
  );
}

/** True if the inbox `provider` column matches a registered lender id.
 *  Used by the central webhook-processor dispatch to route lender rows
 *  here without hard-coding every lender id. */
export function isLenderProvider(provider: string): boolean {
  return SAMPLE_LENDERS.some((l) => l.id === provider);
}

/**
 * Worker entry point — called by `processInboxRow` once the inbox row
 * has been claimed. Throws on any handler failure so BullMQ applies
 * its retry/backoff policy.
 */
export async function handleLenderInboxRow(args: {
  provider: string;
  rawBody: string;
}): Promise<void> {
  const lender = resolveLender(args.provider);
  if (!lender) {
    // Provider should always be a known lender id (route validates
    // before insert) — so this is an integrity failure. Throw so the
    // row lands in the DLQ for ops triage.
    throw new Error(`unknown_lender:${args.provider}`);
  }
  let event: { event_type?: string };
  try {
    event = JSON.parse(args.rawBody) as { event_type?: string };
  } catch (err) {
    throw new Error(
      `invalid_json:${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = await persistLenderEvent({
    lender,
    bodyText: args.rawBody,
    event,
  });
  // Persistence-level invalid outcomes throw so the worker records
  // failure_reason — these are NOT silently dropped any more.
  if (result.status === 'invalid_event') {
    throw new Error(`invalid_event:${JSON.stringify(result.errors)}`);
  }
  if (result.status === 'application_not_found') {
    throw new Error(`application_not_found:${result.applicationId}`);
  }
  if (result.status === 'unknown_event') {
    throw new Error(`unknown_event:${result.event_type}`);
  }
  if (result.status === 'error') {
    throw new Error(`persist_error:${result.message}`);
  }

  // Side-effects: realtime fanout + consumer email/SMS. Inside the
  // worker (not the route), so the lender's 200 is decoupled from a
  // flaky downstream notifier. The inbox dedupe is what guarantees
  // we only get here once per upstream event.
  if (result.applicationId) {
    const rtEvent = realtimeEventForType(event.event_type);
    if (rtEvent) {
      void publishApplicationEvent(result.applicationId, rtEvent, {
        eventType: event.event_type,
        lenderId: lender.id,
        applied: result.applied,
      });
    }
    const eventTypeStr = event.event_type as OutcomeEventType | undefined;
    if (eventTypeStr) {
      const evt = event as { decision?: string };
      void notifyApplicationOutcome({
        applicationId: result.applicationId,
        eventType: eventTypeStr,
        decision: evt.decision,
        lenderName: lender.display_name,
      });
    }
  }

  safeLog.info({
    event: 'webhook.lender.handled',
    lenderId: lender.id,
    eventType: event.event_type,
    applied: result.applied,
  });
}

/* ---------- persistence ---------- */

export type PersistResult =
  | { status: 'ok'; applied: string[]; applicationId?: string }
  | { status: 'unknown_event'; event_type: string }
  | { status: 'invalid_event'; errors: unknown }
  | { status: 'application_not_found'; applicationId: string }
  | { status: 'error'; message: string };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function persistLenderEvent(args: {
  lender: SampleLender;
  bodyText: string;
  event: { event_type?: string };
}): Promise<PersistResult> {
  const { lender, bodyText, event } = args;
  const eventType = event.event_type;
  if (!eventType) return { status: 'unknown_event', event_type: 'missing' };

  const db = getDb();

  switch (eventType) {
    case 'application.quoted': {
      const parsed = QuotedSchema.safeParse(event);
      if (!parsed.success) return { status: 'invalid_event', errors: parsed.error.flatten() };
      const e = parsed.data;
      return db.transaction(async (tx) => {
        const app = await ensureAppExists(tx, e.application_id);
        if (!app) return { status: 'application_not_found', applicationId: e.application_id };
        await upsertOffer(tx, {
          applicationId: e.application_id,
          lender,
          decision: e.decision,
          offer: e.offer,
          declinedReason: e.declined_reason,
          rawPayload: bodyText,
        });
        await tx.insert(schema.applicationEvents).values({
          applicationId: e.application_id,
          type: 'lender_quoted',
          fromStatus: app.status,
          toStatus: app.status,
          payload: bodyText,
          actor: 'system',
        });
        return {
          status: 'ok',
          applied: ['offers_upsert', 'lender_quoted'],
          applicationId: e.application_id,
        };
      });
    }

    case 'application.decisioned': {
      const parsed = DecisionedSchema.safeParse(event);
      if (!parsed.success) return { status: 'invalid_event', errors: parsed.error.flatten() };
      const e = parsed.data;
      const nextStatus = e.decision === 'approved' ? 'approved' : 'declined';
      return db.transaction(async (tx) => {
        const app = await ensureAppExists(tx, e.application_id);
        if (!app) return { status: 'application_not_found', applicationId: e.application_id };
        await upsertOffer(tx, {
          applicationId: e.application_id,
          lender,
          decision: e.decision,
          offer: e.offer,
          declinedReason: e.declined_reason,
          rawPayload: bodyText,
        });
        await tx
          .update(schema.applications)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(schema.applications.id, e.application_id));
        await tx.insert(schema.applicationEvents).values({
          applicationId: e.application_id,
          type: 'status_changed',
          fromStatus: app.status,
          toStatus: nextStatus,
          payload: bodyText,
          actor: 'system',
        });
        return {
          status: 'ok',
          applied: ['offers_upsert', 'status_changed', `status:${nextStatus}`],
          applicationId: e.application_id,
        };
      });
    }

    case 'offer.bound': {
      const parsed = BoundSchema.safeParse(event);
      if (!parsed.success) return { status: 'invalid_event', errors: parsed.error.flatten() };
      const e = parsed.data;
      return db.transaction(async (tx) => {
        const app = await ensureAppExists(tx, e.application_id);
        if (!app) return { status: 'application_not_found', applicationId: e.application_id };
        await tx
          .update(schema.offers)
          .set({ acceptedAt: new Date(), updatedAt: new Date() })
          .where(
            sql`${schema.offers.applicationId} = ${e.application_id} AND ${schema.offers.lenderId} = ${lender.id}`,
          );
        await tx
          .update(schema.applications)
          .set({ selectedLender: lender.id, updatedAt: new Date() })
          .where(eq(schema.applications.id, e.application_id));
        await tx.insert(schema.applicationEvents).values({
          applicationId: e.application_id,
          type: 'offer_accepted',
          fromStatus: app.status,
          toStatus: app.status,
          payload: bodyText,
          actor: 'system',
        });
        return {
          status: 'ok',
          applied: ['offer_accepted_at', `selected_lender:${lender.id}`],
          applicationId: e.application_id,
        };
      });
    }

    case 'loan.funded': {
      const parsed = FundedSchema.safeParse(event);
      if (!parsed.success) return { status: 'invalid_event', errors: parsed.error.flatten() };
      const e = parsed.data;
      return db.transaction(async (tx) => {
        const app = await ensureAppExists(tx, e.application_id);
        if (!app) return { status: 'application_not_found', applicationId: e.application_id };
        await tx
          .update(schema.applications)
          .set({ status: 'funded', updatedAt: new Date() })
          .where(eq(schema.applications.id, e.application_id));
        await tx.insert(schema.applicationEvents).values({
          applicationId: e.application_id,
          type: 'lender_funded',
          fromStatus: app.status,
          toStatus: 'funded',
          payload: bodyText,
          actor: 'system',
        });
        return {
          status: 'ok',
          applied: ['status:funded', 'lender_funded'],
          applicationId: e.application_id,
        };
      });
    }

    case 'loan.repaid':
    case 'loan.defaulted':
    case 'hardship.opened': {
      const parsed = NoteOnlySchema.safeParse(event);
      if (!parsed.success) return { status: 'invalid_event', errors: parsed.error.flatten() };
      const e = parsed.data;
      return db.transaction(async (tx) => {
        const app = await ensureAppExists(tx, e.application_id);
        if (!app) return { status: 'application_not_found', applicationId: e.application_id };
        await tx.insert(schema.applicationEvents).values({
          applicationId: e.application_id,
          type: 'note_added',
          fromStatus: app.status,
          toStatus: app.status,
          payload: bodyText,
          actor: 'system',
        });
        return {
          status: 'ok',
          applied: [`note_added:${eventType}`],
          applicationId: e.application_id,
        };
      });
    }

    default:
      return { status: 'unknown_event', event_type: eventType };
  }
}

function realtimeEventForType(eventType: string | undefined): ApplicationLifecycleEvent | null {
  switch (eventType) {
    case 'application.quoted':
      return 'offer-received';
    case 'application.decisioned':
      return 'status-changed';
    case 'offer.bound':
      return 'offer-accepted';
    case 'loan.funded':
      return 'funded';
    case 'loan.repaid':
    case 'loan.defaulted':
    case 'hardship.opened':
      return 'status-changed';
    default:
      return null;
  }
}

async function ensureAppExists(tx: Tx, applicationId: string) {
  const rows = await tx
    .select({ id: schema.applications.id, status: schema.applications.status })
    .from(schema.applications)
    .where(eq(schema.applications.id, applicationId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertOffer(
  tx: Tx,
  args: {
    applicationId: string;
    lender: SampleLender;
    decision: schema.OfferDecision;
    offer?: {
      amount_cents?: number;
      apr_bps?: number;
      term_months?: number;
      monthly_payment_cents?: number;
      expires_at?: string;
    };
    declinedReason?: string;
    rawPayload: string;
  },
) {
  const { applicationId, lender, decision, offer, declinedReason, rawPayload } = args;
  await tx
    .insert(schema.offers)
    .values({
      applicationId,
      lenderId: lender.id,
      lenderName: lender.display_name,
      decision,
      amountCents: offer?.amount_cents ?? null,
      aprBps: offer?.apr_bps ?? null,
      termMonths: offer?.term_months ?? null,
      monthlyPaymentCents: offer?.monthly_payment_cents ?? null,
      expiresAt: offer?.expires_at ? new Date(offer.expires_at) : null,
      declinedReason: declinedReason ?? null,
      rawPayload,
    })
    .onConflictDoUpdate({
      target: [schema.offers.lenderId, schema.offers.applicationId],
      set: {
        decision,
        amountCents: offer?.amount_cents ?? null,
        aprBps: offer?.apr_bps ?? null,
        termMonths: offer?.term_months ?? null,
        monthlyPaymentCents: offer?.monthly_payment_cents ?? null,
        expiresAt: offer?.expires_at ? new Date(offer.expires_at) : null,
        declinedReason: declinedReason ?? null,
        rawPayload,
        updatedAt: new Date(),
      },
    });
}
