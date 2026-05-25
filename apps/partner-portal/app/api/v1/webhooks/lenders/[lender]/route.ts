import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import {
  idFor,
  problem,
  requireSignatureCheck,
  SAMPLE_LENDERS,
  verifySignature,
  withMeta,
} from '../../../../../../lib/api-v1/shared';
import { getDb, hasDb } from '../../../../../../lib/db';
import { applicationEvents, applications, offers } from '../../../../../../lib/db/schema';
import {
  publishApplicationEvent,
  type ApplicationLifecycleEvent,
} from '../../../../../../lib/realtime';
import {
  notifyApplicationOutcome,
  type OutcomeEventType,
} from '../../../../../../lib/notify-application-outcome';

/**
 * Inbound lender webhook — `POST /api/v1/webhooks/lenders/[lender]`.
 *
 * Lenders POST status changes here. We verify the HMAC, parse the
 * event, persist the resulting state changes into Postgres, and
 * return the canonical idempotent receipt the lender expects.
 *
 *   application.quoted     →  upsert into `offers` (decision: approved
 *                              | counter | declined | ineligible) +
 *                              append `lender_quoted` event.
 *
 *   application.decisioned →  update `applications.status` to approved
 *                              or declined + append `status_changed`
 *                              event. Also upserts the offer row so the
 *                              decision is visible in the offers feed.
 *
 *   offer.bound            →  mark the matching `offers` row as
 *                              accepted (sets `accepted_at`), set
 *                              `applications.selected_lender`, append
 *                              `offer_accepted` event.
 *
 *   loan.funded            →  set `applications.status = 'funded'` +
 *                              append `lender_funded` event.
 *
 *   loan.repaid            →  append `note_added` event (status stays
 *                              `funded`; lifecycle reporting reads the
 *                              audit chain).
 *
 *   loan.defaulted         →  append `note_added` event. Future
 *                              expansion can add a `defaulted` enum
 *                              value to applications.status.
 *
 *   hardship.opened        →  append `note_added` event recording the
 *                              hardship request payload.
 *
 * All DB writes for a single webhook happen in one transaction so the
 * status change and the audit row land atomically. If DATABASE_URL
 * isn't configured (local dev without Postgres), we still return the
 * idempotent receipt but skip persistence — the response shape stays
 * stable so any lender sandbox keeps green.
 */

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

  // Persist to Postgres when configured. Wrapped in try/catch so a DB
  // hiccup never poisons the webhook contract (lender expects 2xx so
  // it doesn't retry endlessly). Persistence failures surface in the
  // response meta block for ops visibility.
  let persistence: PersistResult;
  if (hasDb()) {
    try {
      persistence = await persistWebhook({ lender, bodyText, event });
    } catch (err) {
      persistence = {
        status: 'error',
        message: err instanceof Error ? err.message : 'unknown error',
      };
    }
  } else {
    persistence = { status: 'skipped', message: 'DATABASE_URL not configured' };
  }

  // Fan out a realtime push so the practice owner's open application
  // detail page can refetch immediately instead of waiting for the
  // 5s poll. Fire-and-forget; failures here never affect the webhook
  // 2xx contract back to the lender.
  if (persistence.status === 'ok' && persistence.applicationId) {
    const rtEvent = realtimeEventForType(event.event_type);
    if (rtEvent) {
      void publishApplicationEvent(persistence.applicationId, rtEvent, {
        eventType: event.event_type,
        lenderId: lender.id,
        applied: persistence.applied,
      });
    }
    // Email + SMS the practice owner on key transitions. Whitelist is
    // inside notifyApplicationOutcome so the webhook itself doesn't
    // need to filter — quiet for application.quoted (high-volume),
    // noisy for decisioned / bound / funded / defaulted / hardship.
    const eventTypeStr = event.event_type as OutcomeEventType | undefined;
    if (eventTypeStr) {
      const evt = event as { decision?: string };
      void notifyApplicationOutcome({
        applicationId: persistence.applicationId,
        eventType: eventTypeStr,
        decision: evt.decision,
        lenderName: lender.display_name,
      });
    }
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
        persisted: persistence,
      },
    ),
  );
}

/* ---------- persistence ---------- */

type PersistResult =
  | { status: 'ok'; applied: string[]; applicationId?: string }
  | { status: 'skipped'; message: string }
  | { status: 'unknown_event'; event_type: string }
  | { status: 'invalid_event'; errors: unknown }
  | { status: 'application_not_found'; applicationId: string }
  | { status: 'error'; message: string };

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function persistWebhook(args: {
  lender: (typeof SAMPLE_LENDERS)[number];
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
        await tx.insert(applicationEvents).values({
          applicationId: e.application_id,
          type: 'lender_quoted',
          fromStatus: app.status,
          toStatus: app.status, // status doesn't change on a quote
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
        // The decision row also acts as a final offer write — keep the
        // offers feed and the application status in sync.
        await upsertOffer(tx, {
          applicationId: e.application_id,
          lender,
          decision: e.decision,
          offer: e.offer,
          declinedReason: e.declined_reason,
          rawPayload: bodyText,
        });
        await tx
          .update(applications)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(applications.id, e.application_id));
        await tx.insert(applicationEvents).values({
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
          .update(offers)
          .set({ acceptedAt: new Date(), updatedAt: new Date() })
          .where(
            sql`${offers.applicationId} = ${e.application_id} AND ${offers.lenderId} = ${lender.id}`,
          );
        await tx
          .update(applications)
          .set({ selectedLender: lender.id, updatedAt: new Date() })
          .where(eq(applications.id, e.application_id));
        await tx.insert(applicationEvents).values({
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
          .update(applications)
          .set({ status: 'funded', updatedAt: new Date() })
          .where(eq(applications.id, e.application_id));
        await tx.insert(applicationEvents).values({
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
        await tx.insert(applicationEvents).values({
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
    .select({ id: applications.id, status: applications.status })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);
  return rows[0] ?? null;
}

async function upsertOffer(
  tx: Tx,
  args: {
    applicationId: string;
    lender: (typeof SAMPLE_LENDERS)[number];
    decision: string;
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
    .insert(offers)
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
      target: [offers.lenderId, offers.applicationId],
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
