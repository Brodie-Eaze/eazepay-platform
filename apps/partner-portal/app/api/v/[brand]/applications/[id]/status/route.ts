/**
 * Live application status — partner-scoped.
 *
 *   GET  /api/v/<brand>/applications/<id>/status
 *
 * Returns a small, PII-masked snapshot describing where the consumer
 * is in the apply flow. The shape is fixed across all states so the
 * UI can render against one type and let it animate as values change.
 *
 * Resolution order:
 *   1. If the application id exists in Postgres (real apply-flow
 *      submission persisted via POST /api/v/<brand>/applications +
 *      lender webhook updates from /api/v1/webhooks/lenders/<id>),
 *      we build the response from DB facts:
 *        - applications.status            → live stage
 *        - application_events             → timeline
 *        - offers                         → offers array
 *
 *   2. If it doesn't exist in the DB (seeded demo data in
 *      `lib/master-data.applications`), we fall back to the original
 *      synthetic ladder so the demo continues to advance over time.
 *
 * If the application id was minted via a consumer invite (the partner
 * portal `consumer-invites-store`), we pull the masked consumer name
 * straight off the invite record. Otherwise we use the DB row (real)
 * or the master-data row (synth fallback).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  applications as masterApplications,
  partners as masterPartners,
  type ApplicationRow,
} from '../../../../../../../lib/master-data';
import { findInviteByApplicationId } from '../../../../../../../lib/consumer-invites-store';
import { marketplaceLenders } from '../../../../../../../lib/marketplace-data';
import {
  allowedPartnerIdsForBrand,
  getSessionContext,
  requireSession,
  type SessionContext,
} from '../../../../../../../lib/session';
import { hasDb, withTenantContext } from '../../../../../../../lib/db';
import {
  applicationEvents as applicationEventsTable,
  applications as applicationsTable,
  offers as offersTable,
  type Application,
  type ApplicationEvent,
  type Offer,
} from '../../../../../../../lib/db/schema';
import { decryptApplicationRow } from '../../../../../../../lib/db/applications-pii';

const BrandEnum = z.enum(['medpay', 'tradepay', 'coachpay']);

/* ─── Status ladder ──────────────────────────────────────────────────
 * Ordered list of stages the consumer walks through. Index in the
 * array = progress % via simple linear interpolation. */
const STATUS_LADDER = [
  'invite_sent',
  'form_started',
  'consent_captured',
  'soft_pull_initiated',
  'soft_pull_returned',
  'orchestration_running',
  'offers_available',
  'offer_accepted',
  'contract_signed',
  'funded',
] as const;
type LiveStatus = (typeof STATUS_LADDER)[number];

const STATUS_HUMAN: Record<LiveStatus, string> = {
  invite_sent: 'Invite sent',
  form_started: 'Form started',
  consent_captured: 'Consent captured',
  soft_pull_initiated: 'Soft pull initiated',
  soft_pull_returned: 'Soft pull returned',
  orchestration_running: 'Orchestration running',
  offers_available: 'Offers available',
  offer_accepted: 'Offer accepted',
  contract_signed: 'Contract signed',
  funded: 'Funded',
};

/* ─── Helpers ──────────────────────────────────────────────────────── */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function maskLastName(last: string | undefined | null): string {
  if (!last) return '';
  const first = last.charAt(0).toUpperCase();
  return first ? `${first}.` : '';
}

function progressPctFor(stage: LiveStatus): number {
  const idx = STATUS_LADDER.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_LADDER.length) * 100);
}

interface OfferOut {
  lenderId: string;
  lenderName: string;
  decision: 'approved' | 'declined' | 'pending';
  apr?: number;
  termMonths?: number;
  amount?: number;
}

interface TimelineEntry {
  ts: string;
  event: string;
  detail: string;
}

/* ─── DB-backed path ───────────────────────────────────────────────── */

/**
 * Derive the UI stage from real DB facts. The 5-state DB enum
 * (submitted, in_review, approved, funded, declined) is expanded into
 * the 10-stage UI ladder by inspecting the event stream + offers table.
 *
 *   funded                              → 'funded'
 *   declined                            → 'offers_available' (terminal decline state)
 *   approved + at least one offer accepted → 'offer_accepted' / 'contract_signed' (if events)
 *   approved + offers exist             → 'offers_available'
 *   in_review with lender_quoted events → 'orchestration_running'
 *   in_review                           → 'soft_pull_returned'
 *   submitted                           → 'consent_captured'
 */
function deriveLiveStageFromDb(
  app: Application,
  events: ApplicationEvent[],
  offers: Offer[],
): LiveStatus {
  if (app.status === 'funded') return 'funded';
  if (app.status === 'declined') return 'offers_available';

  const hasAcceptedOffer = offers.some((o) => o.acceptedAt !== null);
  const hasApprovedOffer = offers.some((o) => o.decision === 'approved');
  const hasAnyOffer = offers.length > 0;
  const hasLenderQuotedEvent = events.some((e) => e.type === 'lender_quoted');

  if (app.status === 'approved') {
    if (hasAcceptedOffer) return 'offer_accepted';
    if (hasApprovedOffer) return 'offers_available';
    return 'offers_available'; // approved but no offer row — treat as offers ready
  }

  if (hasAcceptedOffer) return 'offer_accepted';
  if (hasApprovedOffer) return 'offers_available';
  if (hasAnyOffer) return 'orchestration_running';
  if (hasLenderQuotedEvent) return 'orchestration_running';

  if (app.status === 'in_review') return 'soft_pull_returned';
  // 'submitted' is the bottom of the ladder for a real apply submission.
  // We treat it as 'consent_captured' because the apply page captures
  // consent before it POSTs the row.
  return 'consent_captured';
}

function timelineFromDb(app: Application, events: ApplicationEvent[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  // Always anchor with the create event.
  out.push({
    ts: app.createdAt.toISOString(),
    event: 'form_started',
    detail: 'Consumer opened the apply page and began the form',
  });
  out.push({
    ts: app.createdAt.toISOString(),
    event: 'consent_captured',
    detail: 'TILA and credit-pull consent acknowledged',
  });
  for (const e of events) {
    out.push({
      ts: e.createdAt.toISOString(),
      event: uiEventForType(e.type),
      detail: detailForEvent(e),
    });
  }
  return out;
}

function uiEventForType(t: ApplicationEvent['type']): string {
  switch (t) {
    case 'created':
      return 'form_started';
    case 'status_changed':
      return 'orchestration_running';
    case 'lender_quoted':
      return 'orchestration_running';
    case 'offer_accepted':
      return 'offer_accepted';
    case 'lender_funded':
      return 'funded';
    case 'note_added':
      return 'orchestration_running';
    default:
      return 'orchestration_running';
  }
}

function detailForEvent(e: ApplicationEvent): string {
  switch (e.type) {
    case 'created':
      return 'Application submitted by consumer';
    case 'status_changed':
      return `Status moved ${e.fromStatus ?? '?'} → ${e.toStatus ?? '?'}`;
    case 'lender_quoted':
      return 'Lender returned a quote';
    case 'offer_accepted':
      return 'Consumer accepted an offer';
    case 'lender_funded':
      return 'Funds disbursed to the partner';
    case 'note_added':
      return 'Lifecycle event recorded';
    default:
      return 'Application updated';
  }
}

function mapOfferRow(o: Offer): OfferOut {
  /* Decision normalisation:
   *   DB 'approved' | 'counter'    → UI 'approved' (counter still shows the offer)
   *   DB 'declined' | 'ineligible' → UI 'declined'
   *   anything else                → UI 'pending' (e.g. mid-flight quote)
   */
  let decision: OfferOut['decision'];
  if (o.decision === 'approved' || o.decision === 'counter') decision = 'approved';
  else if (o.decision === 'declined' || o.decision === 'ineligible') decision = 'declined';
  else decision = 'pending';

  const out: OfferOut = {
    lenderId: o.lenderId,
    lenderName: o.lenderName ?? o.lenderId,
    decision,
  };
  if (o.aprBps != null) out.apr = o.aprBps / 100;
  if (o.termMonths != null) out.termMonths = o.termMonths;
  if (o.amountCents != null) out.amount = o.amountCents;
  return out;
}

/* ─── Synthetic fallback (legacy demo path) ────────────────────────── */

function pickLenders(seed: string, count: number): string[] {
  const all = marketplaceLenders.map((l) => l.displayName);
  if (all.length === 0) {
    return Array.from({ length: count }).map((_, i) => `Lender ${i + 1}`);
  }
  const h = hash(seed);
  const ordered: string[] = [];
  for (let i = 0; i < Math.min(count, all.length); i++) {
    const idx = (h + i * 7919) % all.length;
    const name = all[idx];
    if (name && !ordered.includes(name)) ordered.push(name);
  }
  let cursor = 0;
  while (ordered.length < count && cursor < all.length) {
    const candidate = all[cursor++];
    if (candidate && !ordered.includes(candidate)) ordered.push(candidate);
  }
  return ordered;
}

function deriveStageSynth(applicationId: string, row?: ApplicationRow): LiveStatus {
  if (row?.status === 'funded') return 'funded';
  if (row?.status === 'declined') return 'offers_available';

  const seed = hash(applicationId);
  const intervalMs = 15_000;
  const offset = seed % STATUS_LADDER.length;
  const ticks = Math.floor(Date.now() / intervalMs);
  const idx = Math.min((ticks + offset) % (STATUS_LADDER.length + 4), STATUS_LADDER.length - 1);
  return STATUS_LADDER[idx] ?? 'invite_sent';
}

function buildOffersSynth(
  applicationId: string,
  stage: LiveStatus,
  row?: ApplicationRow,
): OfferOut[] {
  const stageIdx = STATUS_LADDER.indexOf(stage);
  if (stageIdx < STATUS_LADDER.indexOf('orchestration_running')) return [];

  const names = pickLenders(applicationId, 4);
  const seed = hash(applicationId + '|offers');
  return names.map((name, i): OfferOut => {
    const lenderId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let decision: OfferOut['decision'];
    if (stage === 'orchestration_running') {
      decision = i < 2 ? 'approved' : 'pending';
    } else {
      decision = i === names.length - 1 ? 'declined' : 'approved';
    }
    if (row?.status === 'declined') decision = 'declined';

    const aprBp = 700 + ((seed + i * 137) % 1900);
    const termOptions = [24, 36, 48, 60, 72];
    const term = termOptions[(seed + i) % termOptions.length] ?? 48;
    const amount = (row?.amountCents ?? 1_500_000) - ((seed + i * 311) % 200_000);

    if (decision === 'pending') return { lenderId, lenderName: name, decision };
    if (decision === 'declined') return { lenderId, lenderName: name, decision };
    return { lenderId, lenderName: name, decision, apr: aprBp / 100, termMonths: term, amount };
  });
}

function buildTimelineSynth(applicationId: string, stage: LiveStatus): TimelineEntry[] {
  const stageIdx = STATUS_LADDER.indexOf(stage);
  const out: TimelineEntry[] = [];
  const baseSeed = hash(applicationId + '|timeline');
  for (let i = 0; i <= stageIdx; i++) {
    const stageKey = STATUS_LADDER[i];
    if (!stageKey) continue;
    const jitter = (baseSeed + i * 53) % 6_000;
    const offsetMs = (stageIdx - i) * 15_000 + jitter;
    const ts = new Date(Date.now() - offsetMs).toISOString();
    out.push({ ts, event: stageKey, detail: detailForSynthStage(stageKey, applicationId, i) });
  }
  return out;
}

function detailForSynthStage(stage: LiveStatus, applicationId: string, i: number): string {
  const seed = hash(applicationId + stage);
  const dt = `event-${(seed % 9999).toString().padStart(4, '0')}-${i}`;
  switch (stage) {
    case 'invite_sent':
      return 'Salesperson generated and shared the financing link';
    case 'form_started':
      return 'Consumer opened the apply page and began the form';
    case 'consent_captured':
      return 'TILA and credit-pull consent acknowledged';
    case 'soft_pull_initiated':
      return 'Soft credit pull dispatched to the bureau';
    case 'soft_pull_returned':
      return 'Bureau returned pre-qual artefact';
    case 'orchestration_running':
      return 'Routing the application to eligible lenders in parallel';
    case 'offers_available':
      return 'One or more lender offers ready for the consumer to review';
    case 'offer_accepted':
      return 'Consumer accepted an offer';
    case 'contract_signed':
      return `Customer e-signed the loan agreement (${dt})`;
    case 'funded':
      return 'Funds disbursed to the partner via RTP';
    default:
      return 'Status updated';
  }
}

/* ─── Handler ──────────────────────────────────────────────────────── */

type BrandSlug = 'medpay' | 'tradepay' | 'coachpay';

const BRAND_TO_SYNTH_PRODUCT: Record<BrandSlug, ApplicationRow['product']> = {
  medpay: 'med-pay',
  tradepay: 'trade-pay',
  coachpay: 'coach-pay',
};

const BRAND_TO_PARTNER_PRODUCT: Record<BrandSlug, 'MedPay' | 'TradePay' | 'CoachPay'> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

/**
 * F-001: bridge the synth-row `partner` display name to the canonical
 * `partner_id` so we can apply the same partner-scope filter as the DB
 * path. Returns null when the partner is not in the brand's roster —
 * collapses to 404 at the caller (no existence leak).
 */
function partnerIdForSynthRow(row: ApplicationRow, brand: BrandSlug): string | null {
  const wantedProduct = BRAND_TO_PARTNER_PRODUCT[brand];
  const match = masterPartners.find(
    (p) =>
      p.legalName === row.partner && (p.product === wantedProduct || p.product === 'Multi-brand'),
  );
  return match?.id ?? null;
}

/* F-001: single 404 shape used for every cross-tenant / not-found case.
 * Differentiating "not found" from "exists but not yours" leaks the id
 * space to an enumerating attacker — same 404, same body. */
function notFound(): NextResponse {
  return NextResponse.json(
    {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'application_not_found',
    },
    { status: 404 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brand: string; id: string }> },
) {
  const fail = await requireSession(req);
  if (fail) return fail;

  const { brand: brandSlug, id } = await params;
  const brandParsed = BrandEnum.safeParse(brandSlug);
  if (!brandParsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'unknown_brand',
        detail: `Unknown brand "${brandSlug}".`,
      },
      { status: 400 },
    );
  }
  const brand: BrandSlug = brandParsed.data;

  /* F-001: derive partner scope from the verified session — NEVER from
   * the URL or request body. Previously this route only checked that
   * "some" session existed (`requireSession`) and then queried the DB
   * by id alone; a signed-in MedPay merchant could read any TradePay
   * application by guessing the uuid. We now constrain every lookup to
   * `(brand match AND partnerId IN allowed)` and return 404 (not 403)
   * on miss so the wire response is identical to "doesn't exist". */
  const session = await getSessionContext(req);
  const allowed = allowedPartnerIdsForBrand(session, brand);
  if (allowed.length === 0) return notFound();

  /* ── Try the DB-backed real path first ── */
  if (hasDb()) {
    try {
      /* Defence-in-depth: the app-layer (brand + allowed partner_ids)
       * filter inside buildResponseFromDb is the primary IDOR check
       * (F-001). The RLS policy on applications/offers/application_events
       * (migration 0013) is the backstop — even if a future refactor
       * forgets the inArray, the session-bound GUC means the SELECT
       * still returns zero rows for a guessed cross-tenant id. */
      const built = await buildResponseFromDb(id, brand, allowed, session);
      if (built) return NextResponse.json(built);
    } catch (err) {
      /* Swallow + fall through to synth so the UI keeps animating even
       * if the DB is briefly unavailable. The error surfaces in server
       * logs but the user-facing endpoint stays green. */
      console.error('[applications/status] DB read failed, falling back to synth:', err);
    }
  }

  /* ── Synthetic fallback (demo applications) ──
   * F-001: gate the synth path with the same brand + partner scope as
   * the DB path. Without this, the synth fallback continued to leak the
   * status of any demo application id regardless of caller visibility. */
  const row = masterApplications.find((a) => a.id === id);
  if (!row) return notFound();
  if (row.product !== BRAND_TO_SYNTH_PRODUCT[brand]) return notFound();
  const rowPartnerId = partnerIdForSynthRow(row, brand);
  if (!rowPartnerId || !allowed.includes(rowPartnerId)) return notFound();

  const invite = await findInviteByApplicationId(id);

  let consumerFirstName = invite?.consumerFirstName ?? '';
  let consumerLastInitial = maskLastName(invite?.consumerLastName);
  if (!consumerFirstName && row.customer) {
    const parts = row.customer.split(/\s+/);
    consumerFirstName = parts[0] ?? '';
    consumerLastInitial = maskLastName(parts[1]);
  }

  const stage = deriveStageSynth(id, row);
  const offers = buildOffersSynth(id, stage, row);
  const timeline = buildTimelineSynth(id, stage);

  /* F-001: `source: 'synthetic'|'db'` was a backend-state oracle that
   * lets a caller learn which storage path served the response. Drop it
   * — the DB and synth answers must be indistinguishable. */
  return NextResponse.json({
    applicationId: id,
    status: stage,
    statusLabel: STATUS_HUMAN[stage],
    progressPct: progressPctFor(stage),
    timeline,
    offers,
    consumerContact: {
      firstName: consumerFirstName,
      lastInitial: consumerLastInitial,
    },
    lastUpdatedAt: new Date().toISOString(),
  });
}

async function buildResponseFromDb(
  applicationId: string,
  brand: BrandSlug,
  allowedPartnerIds: string[],
  session: SessionContext,
) {
  /* F-001 + RLS: all three reads happen inside one tenant-scoped
   * transaction. The explicit (id AND brand AND partner_id IN allowed)
   * filter is the app-layer IDOR check; the RLS policy bound by
   * `withTenantContext` is the durable backstop that fires even if a
   * future refactor drops one of those predicates.
   *
   * Returning `null` from the SELECT-by-id miss correctly handles both
   * "the row doesn't exist" and "the row exists but RLS / app-filter
   * hid it from this session" — both fall through to the synthetic
   * path so the wire response stays identical (no oracle). */
  const { app, events, offerRows } = await withTenantContext(session, async (tx) => {
    const appRows = await tx
      .select()
      .from(applicationsTable)
      .where(
        and(
          eq(applicationsTable.id, applicationId),
          eq(applicationsTable.brand, brand),
          inArray(applicationsTable.partnerId, allowedPartnerIds),
        ),
      )
      .limit(1);
    const appRow = appRows[0];
    if (!appRow) {
      return { app: null, events: [] as ApplicationEvent[], offerRows: [] as Offer[] };
    }
    const eventRows = await tx
      .select()
      .from(applicationEventsTable)
      .where(eq(applicationEventsTable.applicationId, applicationId))
      .orderBy(asc(applicationEventsTable.createdAt));
    const oRows = await tx
      .select()
      .from(offersTable)
      .where(eq(offersTable.applicationId, applicationId))
      .orderBy(asc(offersTable.createdAt));
    return { app: appRow, events: eventRows, offerRows: oRows };
  });
  if (!app) return null;

  const stage = deriveLiveStageFromDb(app, events, offerRows);
  /* Prefer the invite record for consumer name when present (handles
   * the case where a partner pre-fills the invite with a different
   * legal name than the consumer types into the form). */
  const invite = await findInviteByApplicationId(applicationId);
  /* PRIV-002: the DB row's name is now encrypted at rest. Decrypt only
   * when the invite did not supply both names — preserving the original
   * "invite wins, DB row is the fallback" semantics while avoiding a
   * needless decrypt when the invite already covers it. */
  const needsDbName = !invite?.consumerFirstName || !invite?.consumerLastName;
  const dbPii = needsDbName ? await decryptApplicationRow(app) : null;
  const firstName = invite?.consumerFirstName ?? dbPii?.consumerFirst ?? '';
  const lastInitial = invite?.consumerLastName
    ? maskLastName(invite.consumerLastName)
    : maskLastName(dbPii?.consumerLast ?? '');

  return {
    applicationId,
    status: stage,
    statusLabel: STATUS_HUMAN[stage],
    progressPct: progressPctFor(stage),
    timeline: timelineFromDb(app, events),
    offers: offerRows.map(mapOfferRow),
    consumerContact: { firstName, lastInitial },
    lastUpdatedAt: (app.updatedAt ?? new Date()).toISOString(),
  };
}
