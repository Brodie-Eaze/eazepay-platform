/**
 * Live application status — partner-scoped synthetic feed.
 *
 *   GET  /api/v/<brand>/applications/<id>/status
 *
 * Returns a small, PII-masked snapshot describing where the consumer
 * is in the apply flow. The shape is fixed across all states so the
 * UI can render against one type and let it animate as values change.
 *
 * Until a real wire-up to NestJS lands, we synthesise the timeline
 * deterministically from `applicationId` and advance one step every
 * ~15 seconds (based on `Date.now()`). That means refreshing the page
 * AND the 5-second client poll both feel alive without the data
 * jittering randomly between calls.
 *
 * If the application id was minted via a consumer invite (the partner
 * portal `consumer-invites-store`), we pull the masked consumer name
 * straight off the invite record. Otherwise we fall back to the
 * canonical master-data row + mask its `customer` field.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { applications, type ApplicationRow } from '../../../../../../../lib/master-data';
import { findInviteByApplicationId } from '../../../../../../../lib/consumer-invites-store';
import { marketplaceLenders } from '../../../../../../../lib/marketplace-data';

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

/* Deterministic FNV-1a string hash so the synthetic timeline is the
 * same across reloads for a given application id. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function maskLastName(last: string | undefined): string {
  if (!last) return '';
  const first = last.charAt(0).toUpperCase();
  return first ? `${first}.` : '';
}

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
  /* If the modulo collided we may be short — top up sequentially. */
  let cursor = 0;
  while (ordered.length < count && cursor < all.length) {
    const candidate = all[cursor++];
    if (candidate && !ordered.includes(candidate)) ordered.push(candidate);
  }
  return ordered;
}

/**
 * Map the application id + the current real-world clock to a live
 * stage. The intent is: every ~15s the stage advances by one until we
 * hit `funded`. The seed shifts the start position so different apps
 * are at different points in the flow at any given moment.
 */
function deriveStage(applicationId: string, row?: ApplicationRow): LiveStatus {
  /* Terminal short-circuit — if the seeded row in master-data is
   * already `funded` / `declined`, freeze the live status accordingly. */
  if (row?.status === 'funded') return 'funded';
  if (row?.status === 'declined') return 'offers_available';

  const seed = hash(applicationId);
  /* Step interval: 15 seconds. */
  const intervalMs = 15_000;
  /* Random offset 0..ladder-length so each app sits at a different
   * point at the same wall-clock moment. */
  const offset = seed % STATUS_LADDER.length;
  const ticks = Math.floor(Date.now() / intervalMs);
  const idx = Math.min((ticks + offset) % (STATUS_LADDER.length + 4), STATUS_LADDER.length - 1);
  return STATUS_LADDER[idx] ?? 'invite_sent';
}

interface OfferOut {
  lenderId: string;
  lenderName: string;
  decision: 'approved' | 'declined' | 'pending';
  apr?: number;
  termMonths?: number;
  amount?: number;
}

function buildOffers(applicationId: string, stage: LiveStatus, row?: ApplicationRow): OfferOut[] {
  /* Offers only start appearing once orchestration is running. */
  const stageIdx = STATUS_LADDER.indexOf(stage);
  if (stageIdx < STATUS_LADDER.indexOf('orchestration_running')) return [];

  const names = pickLenders(applicationId, 4);
  const seed = hash(applicationId + '|offers');
  return names.map((name, i): OfferOut => {
    const lenderId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    /* During orchestration: mix of pending + a couple of returns.
     * Once we're past `offers_available`: approvals fully resolved. */
    let decision: OfferOut['decision'];
    if (stage === 'orchestration_running') {
      decision = i < 2 ? 'approved' : 'pending';
    } else {
      decision = i === names.length - 1 ? 'declined' : 'approved';
    }
    if (row?.status === 'declined') decision = 'declined';

    /* Synth APR + term per-lender, anchored to seed for stability. */
    const aprBp = 700 + ((seed + i * 137) % 1900); // 7.00% – 26.00%
    const termOptions = [24, 36, 48, 60, 72];
    const term = termOptions[(seed + i) % termOptions.length] ?? 48;
    const amount = (row?.amountCents ?? 1_500_000) - ((seed + i * 311) % 200_000);

    if (decision === 'pending') {
      return { lenderId, lenderName: name, decision };
    }
    if (decision === 'declined') {
      return { lenderId, lenderName: name, decision };
    }
    return {
      lenderId,
      lenderName: name,
      decision,
      apr: aprBp / 100,
      termMonths: term,
      amount,
    };
  });
}

interface TimelineEntry {
  ts: string;
  event: string;
  detail: string;
}

function buildTimeline(applicationId: string, stage: LiveStatus): TimelineEntry[] {
  const stageIdx = STATUS_LADDER.indexOf(stage);
  const out: TimelineEntry[] = [];
  const baseSeed = hash(applicationId + '|timeline');
  /* Walk every completed-or-current stage and stamp a relative ts. */
  for (let i = 0; i <= stageIdx; i++) {
    const stageKey = STATUS_LADDER[i];
    if (!stageKey) continue;
    /* Each step ~15s apart, with a small per-stage jitter from seed. */
    const jitter = (baseSeed + i * 53) % 6_000;
    const offsetMs = (stageIdx - i) * 15_000 + jitter;
    const ts = new Date(Date.now() - offsetMs).toISOString();
    out.push({
      ts,
      event: stageKey,
      detail: detailFor(stageKey, applicationId, i),
    });
  }
  return out;
}

function detailFor(stage: LiveStatus, applicationId: string, i: number): string {
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

function progressPctFor(stage: LiveStatus): number {
  const idx = STATUS_LADDER.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STATUS_LADDER.length) * 100);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brand: string; id: string }> },
) {
  const { brand, id } = await params;
  const brandParsed = BrandEnum.safeParse(brand);
  if (!brandParsed.success) {
    return NextResponse.json(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'unknown_brand',
        detail: `Unknown brand "${brand}".`,
      },
      { status: 400 },
    );
  }

  /* Resolve consumer identity. Invite store wins (most accurate),
   * master-data row is the fallback for legacy seed applications. */
  const invite = await findInviteByApplicationId(id);
  const row = applications.find((a) => a.id === id);

  let consumerFirstName = invite?.consumerFirstName ?? '';
  let consumerLastInitial = maskLastName(invite?.consumerLastName);
  if (!consumerFirstName && row?.customer) {
    const parts = row.customer.split(/\s+/);
    consumerFirstName = parts[0] ?? '';
    consumerLastInitial = maskLastName(parts[1]);
  }

  const stage = deriveStage(id, row);
  const offers = buildOffers(id, stage, row);
  const timeline = buildTimeline(id, stage);

  const body = {
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
  };

  return NextResponse.json(body);
}
