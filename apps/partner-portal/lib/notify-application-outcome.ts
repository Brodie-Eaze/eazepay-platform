/**
 * notifyApplicationOutcome — called from the lender webhook after a
 * successful persist. Looks up the originating partner, builds a
 * status-appropriate message, and fans out an email + optional SMS.
 *
 * Idempotency is achieved by passing a stable key per (applicationId,
 * eventType) so Resend dedupes within its 24h window. The webhook
 * itself is also already idempotent at the DB layer (the same event
 * landing twice is a no-op on the second persist).
 *
 * Failures are swallowed + logged so a Resend / Twilio outage can
 * never propagate out and cause the lender webhook to 500 (which
 * would trigger the lender's retry loop).
 */

import { eq } from 'drizzle-orm';
import { getDb, hasDb } from './db';
import { applications, offers, partners } from './db/schema';
import { decryptApplicationRow } from './db/applications-pii';
import { sendApplicationOutcomeEmail, type SendableBrand } from './server-email';
import { sendOutcomeSMS } from './server-sms';

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://eazepay-platform-production.up.railway.app';

export type OutcomeEventType =
  | 'application.quoted'
  | 'application.decisioned'
  | 'offer.bound'
  | 'loan.funded'
  | 'loan.repaid'
  | 'loan.defaulted'
  | 'hardship.opened';

/**
 * Whitelist of event types worth notifying on. We skip the high-volume
 * 'application.quoted' fanout (a single application can produce 5+
 * quotes from the marketplace within seconds) to avoid blasting the
 * practice owner's inbox during normal orchestration. They'll see the
 * first quote land via the realtime push on the open detail page.
 */
const NOTIFY_FOR_EVENT: Record<OutcomeEventType, boolean> = {
  'application.quoted': false,
  'application.decisioned': true,
  'offer.bound': true,
  'loan.funded': true,
  'loan.repaid': false,
  'loan.defaulted': true,
  'hardship.opened': true,
};

function statusLabelFor(eventType: OutcomeEventType, decision?: string): string {
  switch (eventType) {
    case 'application.quoted':
      return 'New lender offer';
    case 'application.decisioned':
      return decision === 'approved' ? 'Approved' : 'Declined';
    case 'offer.bound':
      return 'Offer accepted';
    case 'loan.funded':
      return 'Funded';
    case 'loan.repaid':
      return 'Loan repaid';
    case 'loan.defaulted':
      return 'Default flagged';
    case 'hardship.opened':
      return 'Hardship requested';
    default:
      return 'Application update';
  }
}

function smsTextFor(args: {
  eventType: OutcomeEventType;
  decision?: string;
  consumerLabel: string;
  amountLabel?: string;
  applicationUrl: string;
}): string {
  const status = statusLabelFor(args.eventType, args.decision);
  const moneyPart = args.amountLabel ? ` · ${args.amountLabel}` : '';
  return `MedPay: ${args.consumerLabel} → ${status}${moneyPart}. ${args.applicationUrl}`;
}

function formatMoney(cents: number | null | undefined): string | undefined {
  if (cents == null || Number.isNaN(cents)) return undefined;
  const dollars = cents / 100;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function brandToSendable(brand: string): SendableBrand {
  if (brand === 'medpay' || brand === 'tradepay' || brand === 'coachpay') return brand;
  return 'medpay';
}

/**
 * Look up the application + partner + best amount label, then fan
 * out email + SMS notifications. Safe to call from any context —
 * gates on hasDb(), wraps every send, never throws.
 */
export async function notifyApplicationOutcome(args: {
  applicationId: string;
  eventType: OutcomeEventType;
  /** Optional decision string passed through from the webhook body. */
  decision?: string;
  /** Optional lender display name for the message body. */
  lenderName?: string;
}): Promise<void> {
  const { applicationId, eventType, decision, lenderName } = args;
  if (!NOTIFY_FOR_EVENT[eventType]) return;
  if (!hasDb()) return;

  try {
    const db = getDb();

    const appRows = await db
      .select({
        id: applications.id,
        brand: applications.brand,
        partnerId: applications.partnerId,
        // PRIV-002: select the encrypted columns; decrypt below.
        consumerFirstEnc: applications.consumerFirstEnc,
        consumerLastEnc: applications.consumerLastEnc,
        consumerEmailEnc: applications.consumerEmailEnc,
        consumerPhoneEnc: applications.consumerPhoneEnc,
        amountCents: applications.amountCents,
      })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);
    const app = appRows[0];
    if (!app) return;
    if (app.partnerId === '__unattributed__') return;

    const partnerRows = await db
      .select({
        legalName: partners.legalName,
        displayName: partners.displayName,
        contactEmail: partners.primaryContactEmail,
      })
      .from(partners)
      .where(eq(partners.id, app.partnerId))
      .limit(1);
    const partner = partnerRows[0];
    if (!partner?.contactEmail) return;

    // PRIV-002: decrypt at the read boundary. Same masked "First L." label.
    const consumerPii = await decryptApplicationRow(app);
    const consumerLabel =
      `${consumerPii.consumerFirst} ${consumerPii.consumerLast.charAt(0) ?? ''}.`.trim();
    const applicationUrl = `${APP_ORIGIN}/v/${app.brand}/applications/${app.id}`;

    /* Prefer the amount on the bound / funded offer over the original
     * apply-page amount when present — the lender's offer amount can
     * differ if they counter-offered. */
    let amountCents: number | null = null;
    if (eventType === 'offer.bound' || eventType === 'loan.funded') {
      const acceptedOffer = await db
        .select({ amountCents: offers.amountCents })
        .from(offers)
        .where(eq(offers.applicationId, applicationId))
        .limit(5);
      const bound = acceptedOffer.find((o) => o.amountCents != null);
      if (bound) amountCents = bound.amountCents;
    }
    const amountLabel = formatMoney(amountCents ?? app.amountCents);
    const statusLabel = statusLabelFor(eventType, decision);
    const brand = brandToSendable(app.brand);
    const practiceName = partner.displayName || partner.legalName;

    /* Email — best effort, swallow failures. */
    try {
      await sendApplicationOutcomeEmail({
        brand,
        to: partner.contactEmail,
        vars: {
          practiceName,
          consumerLabel,
          statusLabel,
          amountLabel,
          lenderLabel: lenderName,
          applicationUrl,
        },
        idempotencyKey: `outcome-${applicationId}-${eventType}`,
      });
    } catch (err) {
      console.warn('[notify-outcome] email send failed:', err);
    }

    /* SMS — only if the partner has a phone column in future and the
     * Twilio env is wired. For now skipped because partners table has
     * no phone column; left as a hook for follow-on PR that adds it. */
    void sendOutcomeSMS; // referenced so the import isn't pruned
  } catch (err) {
    console.warn('[notify-outcome] orchestrator failed:', err);
  }
}
