'use client';
/**
 * Real-time deal-detail page for an application.
 *
 * Reachable via row-click from `/v/[brand]/applications`. Synthesizes deterministic
 * "live" telemetry from the seeded application row + Highsale snapshot — pipeline
 * progress, event stream, lender waterfall, risk panel, audit chain.
 *
 * The "real-time feel" comes from:
 *   - Pulse dots on the current pipeline stage + live event stream tail
 *   - Relative timestamps ("12s ago") instead of static dates
 *   - Stage dwell times rendered in monospace
 *   - Last-event glow + ticking second-by-second offsets
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusPill,
  type StatusTone,
  DataRow,
  MaskedField,
  Money,
  Apr,
  DataTable,
  type Column,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
  ShieldIcon,
  BoltIcon,
  ChartIcon,
  AlertIcon,
  ClockIcon,
  DocIcon,
  SendIcon,
  RouteIcon,
  BankIcon,
  GaugeIcon,
} from '@eazepay/ui/web';

/* ─── Live-status shapes — mirror the BFF status route response. ─── */
type LiveStatus =
  | 'invite_sent'
  | 'form_started'
  | 'consent_captured'
  | 'soft_pull_initiated'
  | 'soft_pull_returned'
  | 'orchestration_running'
  | 'offers_available'
  | 'offer_accepted'
  | 'contract_signed'
  | 'funded';

const LIVE_STATUS_ORDER: LiveStatus[] = [
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
];

const LIVE_STATUS_LABEL: Record<LiveStatus, string> = {
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

const LIVE_STATUS_TONE: Record<LiveStatus, StatusTone> = {
  invite_sent: 'neutral',
  form_started: 'info',
  consent_captured: 'info',
  soft_pull_initiated: 'warning',
  soft_pull_returned: 'warning',
  orchestration_running: 'warning',
  offers_available: 'success',
  offer_accepted: 'success',
  contract_signed: 'success',
  funded: 'success',
};

interface LiveOffer {
  lenderId: string;
  lenderName: string;
  decision: 'approved' | 'declined' | 'pending';
  apr?: number;
  termMonths?: number;
  amount?: number;
}

interface LiveTimelineEntry {
  ts: string;
  event: LiveStatus | string;
  detail: string;
}

interface LiveStatusBody {
  applicationId: string;
  status: LiveStatus;
  statusLabel: string;
  progressPct: number;
  timeline: LiveTimelineEntry[];
  offers: LiveOffer[];
  consumerContact: { firstName: string; lastInitial: string };
  lastUpdatedAt: string;
}
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { applications, type ApplicationRow } from '../../../../../lib/master-data';
import {
  lookupHighsaleSnapshot,
  marketplaceLenders,
  tierLabel,
  type CreditTier,
} from '../../../../../lib/marketplace-data';

const slugToBrand = (slug: string): BrandCode | null =>
  BRAND_ORDER.find((c) => BRANDS[c].slug === slug) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic synth helpers — every value derived from app.id so reloads match.
// ─────────────────────────────────────────────────────────────────────────────

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const seeded = (seed: string) => {
  let s = hash(seed) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const pick = <T,>(rand: () => number, list: readonly T[]): T => {
  const idx = Math.floor(rand() * list.length);
  return list[idx] as T;
};

const productLabel: Record<ApplicationRow['product'], string> = {
  'med-pay': 'Medical procedure',
  'trade-pay': 'Home improvement',
  'coach-pay': 'Coaching program',
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Stable "now" baseline so timestamps don't jitter every render.
const FROZEN_NOW = 1747900000000; // 2026-05-15 ~UTC; matches user's currentDate.

const fmtRel = (msAgo: number): string => {
  if (msAgo < 0) return 'just now';
  const s = Math.floor(msAgo / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const fmtClock = (ms: number): string => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms3 = String(d.getMilliseconds()).padStart(3, '0').slice(0, 3);
  return `${hh}:${mm}:${ss}.${ms3}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Agent codenames — the orchestration internals that surface on the timeline.
// ─────────────────────────────────────────────────────────────────────────────

type AgentCode = 'PRISM' | 'VEGA' | 'ORACLE' | 'HELIX' | 'NEXUS' | 'FLUX' | 'ECHO' | 'SENTRY' | 'LEDGER';

const agentTone: Record<AgentCode, StatusTone> = {
  PRISM: 'info',
  VEGA: 'accent',
  ORACLE: 'accent',
  HELIX: 'info',
  NEXUS: 'accent',
  FLUX: 'success',
  ECHO: 'neutral',
  SENTRY: 'warning',
  LEDGER: 'success',
};

const AgentBadge = ({ code }: { code: AgentCode }) => (
  <span
    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] font-mono ring-1 ring-inset ${
      agentTone[code] === 'success'
        ? 'bg-success-bg text-success ring-success/20'
        : agentTone[code] === 'warning'
          ? 'bg-warning-bg text-warning ring-warning/20'
          : agentTone[code] === 'accent'
            ? 'bg-accent-soft text-accent ring-accent/20'
            : agentTone[code] === 'info'
              ? 'bg-info-bg text-info ring-info/20'
              : 'bg-bg-muted text-fg-secondary ring-border'
    }`}
  >
    {code}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline stages — six stage scaffolding with status + dwell.
// ─────────────────────────────────────────────────────────────────────────────

type StageStatus = 'done' | 'active' | 'pending' | 'skipped';
interface Stage {
  key: string;
  label: string;
  status: StageStatus;
  /** seconds spent in this stage (or to reach it from previous) */
  dwellSec: number;
  /** ms offset from baseStart when this stage completed (or 'active' = now) */
  completedAtMs: number | null;
}

const stageOrder = [
  { key: 'apply', label: 'Apply' },
  { key: 'soft_pull', label: 'Soft pull' },
  { key: 'kyc', label: 'KYC' },
  { key: 'waterfall', label: 'Lender waterfall' },
  { key: 'offer', label: 'Offer' },
  { key: 'esign', label: 'e-Sign' },
  { key: 'funded', label: 'Funded' },
] as const;

function buildPipeline(app: ApplicationRow, baseStart: number): Stage[] {
  const r = seeded(app.id + '|pipe');
  // Stage dwell seconds — realistic ranges per stage.
  const dwells = [
    Math.floor(r() * 2 + 1), // apply (form complete)
    Math.floor(r() * 3 + 2), // soft pull
    Math.floor(r() * 4 + 2), // kyc
    Math.floor(r() * 5 + 3), // waterfall
    Math.floor(r() * 8 + 4), // offer
    Math.floor(r() * 24 + 10), // esign
    Math.floor(r() * 6 + 2), // funded
  ];

  // Decide how far the pipeline advanced based on app.status.
  let activeIdx: number;
  if (app.status === 'submitted') activeIdx = pick(seeded(app.id + '|stage'), [1, 2, 3]); // mid-flight
  else if (app.status === 'in_review') activeIdx = 3;
  else if (app.status === 'approved') activeIdx = 5; // sitting at esign
  else if (app.status === 'declined') activeIdx = 3; // declined at waterfall
  else activeIdx = 7; // funded — past the end (all done)

  let cursor = baseStart;
  return stageOrder.map((s, i): Stage => {
    const dwell = dwells[i] ?? 1;
    cursor += dwell * 1000;
    let status: StageStatus;
    if (app.status === 'declined' && i >= activeIdx) {
      status = i === activeIdx ? 'active' : i > activeIdx ? 'skipped' : 'done';
    } else if (i < activeIdx) status = 'done';
    else if (i === activeIdx) status = 'active';
    else status = 'pending';
    return {
      key: s.key,
      label: s.label,
      status,
      dwellSec: dwell,
      completedAtMs: status === 'done' ? cursor : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event stream — synthesized realistic events anchored to the pipeline.
// ─────────────────────────────────────────────────────────────────────────────

interface DealEvent {
  ts: number;
  agent: AgentCode;
  message: string;
  /** secondary line — context / IDs / refs */
  ref?: string;
}

function buildEvents(app: ApplicationRow, baseStart: number, lenders: WaterfallRow[]): DealEvent[] {
  const r = seeded(app.id + '|events');
  const slug = app.product.replace('-', '');
  const partnerRef = app.partner.split(/\s+/)[0]?.toLowerCase() ?? 'partner';
  const ev: DealEvent[] = [];
  let t = baseStart;
  const bump = (lo: number, hi: number) => {
    t += Math.floor(r() * (hi - lo) + lo);
  };

  ev.push({ ts: t, agent: 'PRISM', message: `Application submitted via /apply/${slug}`, ref: `partner_${partnerRef} · ip 10.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}` });
  bump(800, 1400);
  ev.push({ ts: t, agent: 'PRISM', message: 'Smart-form complete · 8 fields · 2 conditional branches', ref: `form_${app.id.replace('a_', 'f_')}` });
  bump(600, 1100);
  ev.push({ ts: t, agent: 'PRISM', message: 'Identity capture · ID front + back + selfie liveness', ref: `persona_inq_${(hash(app.id) % 100000).toString(16)}` });
  bump(800, 1300);
  ev.push({ ts: t, agent: 'SENTRY', message: 'Device fingerprint match · trusted browser · no VPN', ref: `fp_${(hash(app.id + 'fp') % 1_000_000).toString(36)}` });
  bump(900, 1500);
  ev.push({ ts: t, agent: 'VEGA', message: 'Enrichment fan-out · 3 providers · matched in 312ms', ref: 'Persona, Plaid Identity, Highsale' });
  bump(700, 1200);
  ev.push({ ts: t, agent: 'ORACLE', message: `Risk score 0.${(20 + Math.floor(r() * 40)).toString().padStart(2, '0')} · tier ${tierLabelInline(app.fico)}`, ref: `oracle_v3.2 · fico_band ${ficoBand(app.fico)}` });
  bump(500, 900);
  ev.push({ ts: t, agent: 'HELIX', message: `Income / DTI computed · ${Math.floor(15 + r() * 25)}.${Math.floor(r() * 99).toString().padStart(2, '0')}% DTI`, ref: 'plaid_assets + paystub_ocr' });
  bump(600, 1100);
  ev.push({ ts: t, agent: 'NEXUS', message: `Routed to ${lenders.length} lenders in parallel`, ref: lenders.slice(0, 4).map((l) => l.lender).join(', ') + (lenders.length > 4 ? ', ...' : '') });

  // Lender results — interleaved.
  for (const l of lenders) {
    bump(120, 480);
    if (l.decision === 'approved') {
      ev.push({
        ts: t,
        agent: 'NEXUS',
        message: `${l.lender} approved · $${(l.monthlyCents * l.termMonths / 100).toFixed(0)} total · ${l.termMonths}mo · ${(l.aprBps / 100).toFixed(2)}% APR`,
        ref: `quote ${(hash(l.lender + app.id) % 1_000_000).toString(36)} · ${l.latencyMs}ms`,
      });
    } else {
      ev.push({
        ts: t,
        agent: 'NEXUS',
        message: `${l.lender} declined · ${l.topReason}`,
        ref: `quote ${(hash(l.lender + app.id) % 1_000_000).toString(36)} · ${l.latencyMs}ms`,
      });
    }
  }

  // Status-conditional tail.
  if (app.status === 'submitted') {
    bump(800, 2000);
    ev.push({ ts: t, agent: 'ECHO', message: 'Awaiting customer selection on offer screen', ref: `session_${(hash(app.id + 'sess') % 1_000_000).toString(36)}` });
  } else if (app.status === 'approved') {
    bump(900, 2200);
    ev.push({ ts: t, agent: 'ECHO', message: 'Customer viewing offer screen', ref: `session_${(hash(app.id + 'sess') % 1_000_000).toString(36)}` });
    bump(8000, 22000);
    ev.push({ ts: t, agent: 'ECHO', message: 'Customer accepted offer · awaiting e-signature', ref: 'tila_box_ack=true' });
  } else if (app.status === 'funded') {
    bump(1500, 3500);
    ev.push({ ts: t, agent: 'ECHO', message: 'Customer accepted offer', ref: 'tila_box_ack=true' });
    bump(12000, 30000);
    ev.push({ ts: t, agent: 'ECHO', message: `Customer e-signed offer · IP 10.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}.${Math.floor(r() * 250)} · device ✓`, ref: `envelope_${(hash(app.id + 'env') % 100000).toString(16)}` });
    bump(1000, 2500);
    ev.push({ ts: t, agent: 'FLUX', message: `Disbursing via RTP · routing #${21000000 + Math.floor(r() * 89)}`, ref: `${app.lender} → partner_${partnerRef} account ✓` });
    bump(2500, 5500);
    ev.push({ ts: t, agent: 'FLUX', message: `Funded · $${(app.amountCents / 100).toLocaleString('en-US')} disbursed`, ref: `txn_${(hash(app.id + 'txn') % 1_000_000_000).toString(36)} · RTP settled in 4.2s` });
    bump(500, 900);
    ev.push({ ts: t, agent: 'LEDGER', message: 'Servicing handoff complete · payment schedule registered', ref: `loan_${(hash(app.id + 'loan') % 1_000_000).toString(36)}` });
  } else if (app.status === 'declined') {
    bump(800, 1600);
    ev.push({ ts: t, agent: 'NEXUS', message: 'All lender quotes returned · no fundable offer', ref: 'waterfall.reject_all' });
    bump(400, 900);
    ev.push({ ts: t, agent: 'ECHO', message: 'Adverse action notice queued (ECOA / FCRA)', ref: `notice_${(hash(app.id + 'aan') % 100000).toString(16)} · scheduled +30d` });
  }

  return ev;
}

function tierLabelInline(fico: number): string {
  if (fico >= 720) return 'PRIME-PLUS';
  if (fico >= 680) return 'PRIME';
  if (fico >= 640) return 'NEAR-PRIME';
  return 'SUB-PRIME';
}
function ficoBand(fico: number): string {
  if (fico >= 720) return '720+';
  if (fico >= 680) return '680-719';
  if (fico >= 640) return '640-679';
  if (fico >= 600) return '600-639';
  return '<600';
}

// ─────────────────────────────────────────────────────────────────────────────
// Lender waterfall synthesis.
// ─────────────────────────────────────────────────────────────────────────────

interface WaterfallRow {
  lender: string;
  marketplace: string;
  decision: 'approved' | 'declined';
  aprBps: number;
  termMonths: number;
  monthlyCents: number;
  topReason: string;
  latencyMs: number;
  recommended: boolean;
}

const DECLINE_REASONS = [
  'DTI exceeds program max (>45%)',
  'Insufficient revolving file depth',
  'Recent 60-day delinquency on tradeline',
  'Cash-flow stability below threshold',
  'Loan amount exceeds tier ceiling',
  'NSF events in last 90 days',
  'Employment tenure under 6 months',
] as const;

function buildWaterfall(app: ApplicationRow, tier: CreditTier | null): WaterfallRow[] {
  const r = seeded(app.id + '|water');
  // Pull plausible lenders from the marketplace pool — fall back to a static set.
  const pool = marketplaceLenders
    .filter((l) => (tier ? l.servesTiers.includes(tier) : true))
    .slice(0, 8);
  const lenders = pool.length >= 6 ? pool : marketplaceLenders.slice(0, 6);

  // Pick 6-8 lenders.
  const count = 6 + Math.floor(r() * 3);
  const chosen = lenders.slice(0, count);

  // For declined apps, everyone declines. For others, sprinkle 2-4 approvals.
  const approvalCount =
    app.status === 'declined'
      ? 0
      : app.status === 'funded' || app.status === 'approved'
        ? 3 + Math.floor(r() * 2)
        : 2 + Math.floor(r() * 2);

  const indices = chosen.map((_, i) => i).sort(() => r() - 0.5);
  const approvedSet = new Set(indices.slice(0, approvalCount));

  const rows: WaterfallRow[] = chosen.map((l, i) => {
    const decision: WaterfallRow['decision'] = approvedSet.has(i) ? 'approved' : 'declined';
    const termOptions = [24, 36, 48, 60, 72] as const;
    const term = termOptions[Math.floor(r() * termOptions.length)] ?? 48;
    const aprBps = decision === 'approved' ? Math.floor(699 + r() * 1400) : 0;
    const total = app.amountCents * (1 + (aprBps / 10000) * (term / 12));
    return {
      lender: l.displayName,
      marketplace: l.marketplaceId,
      decision,
      aprBps,
      termMonths: term,
      monthlyCents: decision === 'approved' ? Math.round(total / term) : 0,
      topReason: decision === 'declined' ? pick(seeded(app.id + l.displayName), DECLINE_REASONS) : '',
      latencyMs: 120 + Math.floor(r() * 800),
      recommended: false,
    };
  });

  // Sort: approved-first, cheapest APR.
  rows.sort((a, b) => {
    if (a.decision !== b.decision) return a.decision === 'approved' ? -1 : 1;
    return a.aprBps - b.aprBps;
  });
  // Star the top approved.
  const topApproved = rows.find((r) => r.decision === 'approved');
  if (topApproved) topApproved.recommended = true;
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const { brand: brandSlug, id } = useParams<{ brand: string; id: string }>();
  const brand = slugToBrand(brandSlug);
  if (!brand) notFound();
  const spec = BRANDS[brand];

  const app = applications.find((a) => a.id === id);
  if (!app) notFound();

  const highsale = lookupHighsaleSnapshot(app.id);
  const tier: CreditTier | null = highsale?.creditTier ?? null;

  /* ─── Live-tracking poll ─────────────────────────────────────────
   * Fetch `/api/v/<brand>/applications/<id>/status` every 5s. The
   * partner sees a real-time pulse on stage transitions + offers as
   * they roll in. Polling stops when:
   *   1. status === 'funded'             (terminal happy path)
   *   2. total elapsed > 30 minutes      (safety cap)
   *
   * Network errors do NOT spam the console — we surface a single
   * "Live updates paused" banner so the operator can refresh. */
  const [live, setLive] = useState<LiveStatusBody | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [pollPaused, setPollPaused] = useState(false);
  const pollStartedAtRef = useRef<number>(Date.now());
  const errorLoggedRef = useRef(false);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/v/${brandSlug}/applications/${encodeURIComponent(app.id)}/status`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (!errorLoggedRef.current) {
          errorLoggedRef.current = true;
          /* Single log line — see top-of-function comment. */
          console.warn(`[live-status] non-2xx for ${app.id}: ${res.status}`);
        }
        setLiveError(true);
        return;
      }
      const body = (await res.json()) as LiveStatusBody;
      setLive(body);
      setLiveError(false);
    } catch (err) {
      if (!errorLoggedRef.current) {
        errorLoggedRef.current = true;
        console.warn('[live-status] fetch failed', err);
      }
      setLiveError(true);
    }
  }, [app.id, brandSlug]);

  useEffect(() => {
    pollStartedAtRef.current = Date.now();
    void fetchLive();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - pollStartedAtRef.current;
      const reachedCap = elapsed > 30 * 60 * 1000;
      const reachedTerminal = live?.status === 'funded';
      if (reachedCap || reachedTerminal) {
        setPollPaused(true);
        window.clearInterval(interval);
        return;
      }
      void fetchLive();
    }, 5_000);
    return () => window.clearInterval(interval);
    /* live.status is read inside the interval body via the closure
     * snapshot — that's fine here because we replace the interval each
     * time `live?.status` flips to a terminal value via this dep. */
  }, [fetchLive, live?.status]);

  // Ticking "now" so relative timestamps refresh every second (real-time feel).
  const [now, setNow] = useState<number>(FROZEN_NOW);
  useEffect(() => {
    setNow(Date.now());
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, []);

  // Anchor the synthetic timeline so the most recent event is ~30-300s ago.
  const tailLagSec = useMemo(() => 12 + (hash(app.id + 'tail') % 240), [app.id]);
  const baseStart = useMemo(() => now - (tailLagSec + 60) * 1000, [now, tailLagSec]);

  const pipeline = useMemo(() => buildPipeline(app, baseStart), [app, baseStart]);
  const waterfall = useMemo(() => buildWaterfall(app, tier), [app, tier]);
  const events = useMemo(() => buildEvents(app, baseStart, waterfall), [app, baseStart, waterfall]);

  // Reverse-chronological for the feed.
  const feed = [...events].reverse();
  const lastEvent = feed[0];

  const activeStage = pipeline.find((s) => s.status === 'active');
  const isLive = app.status === 'submitted' || app.status === 'in_review';

  const statusTone: StatusTone =
    app.status === 'funded' || app.status === 'approved'
      ? 'success'
      : app.status === 'declined'
        ? 'danger'
        : 'info';
  const statusLabel =
    app.status === 'in_review'
      ? 'In review'
      : (app.status.charAt(0).toUpperCase() + app.status.slice(1));

  // ─── Compliance / risk / docs (deterministic synth) ───
  const r = seeded(app.id + '|misc');
  const riskScore = (0.08 + r() * 0.18).toFixed(2);
  const personaConfidence = (88 + Math.floor(r() * 11)).toFixed(0);
  const siftScore = (7.4 + r() * 2).toFixed(1);
  const velocity = Math.floor(r() * 2);
  const dti = (14 + r() * 28).toFixed(1);

  const auditChain = useMemo(() => {
    const ar = seeded(app.id + '|audit');
    return Array.from({ length: 10 }).map((_, i) => {
      const stageName = ['INIT', 'CONSENT', 'PII_HASH', 'SOFT_PULL', 'ENRICH', 'SCORE', 'ROUTE', 'QUOTE', 'OFFER', 'EXEC'][i];
      const hashHex = Array.from({ length: 16 })
        .map(() => Math.floor(ar() * 16).toString(16))
        .join('');
      return { stage: stageName, hash: `0x${hashHex}`, tsMs: baseStart + i * 2200 };
    });
  }, [app.id, baseStart]);

  // ─── Waterfall column setup ───
  const waterfallCols: Column<WaterfallRow>[] = [
    {
      key: 'lender',
      header: 'Lender',
      cell: (row) => (
        <div>
          <div className="font-medium flex items-center gap-2">
            {row.lender}
            {row.recommended && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                <span aria-hidden>★</span>Recommended
              </span>
            )}
          </div>
          <div className="text-[11px] text-fg-muted font-mono">{row.marketplace}</div>
        </div>
      ),
    },
    {
      key: 'decision',
      header: 'Decision',
      cell: (row) =>
        row.decision === 'approved' ? (
          <StatusPill tone="success" icon={<CheckIcon size={10} />}>Approved</StatusPill>
        ) : (
          <StatusPill tone="danger" icon={<XIcon size={10} />}>Declined</StatusPill>
        ),
    },
    {
      key: 'apr',
      header: 'APR',
      align: 'right',
      cell: (row) => (row.decision === 'approved' ? <Apr bps={row.aprBps} /> : <span className="text-fg-muted">—</span>),
    },
    {
      key: 'term',
      header: 'Term',
      align: 'right',
      cell: (row) => (row.decision === 'approved' ? `${row.termMonths} mo` : <span className="text-fg-muted">—</span>),
    },
    {
      key: 'monthly',
      header: 'Monthly',
      align: 'right',
      cell: (row) => (row.decision === 'approved' ? <Money cents={row.monthlyCents} /> : <span className="text-fg-muted">—</span>),
    },
    {
      key: 'reason',
      header: 'Top reason',
      cell: (row) => (
        <span className="text-[12px] text-fg-secondary">
          {row.decision === 'approved' ? 'Within policy envelope' : row.topReason}
        </span>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      align: 'right',
      cell: (row) => <span className="font-mono text-[11px] text-fg-muted">{row.latencyMs}ms</span>,
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master', href: '/' },
          { label: spec.name, href: `/v/${spec.slug}` },
          { label: 'Applications', href: `/v/${spec.slug}/applications` },
          { label: app.id.toUpperCase() },
        ]}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="size-9 rounded-full bg-bg-muted text-fg-secondary inline-flex items-center justify-center text-[12px] font-semibold ring-1 ring-border">
              {initialsOf(app.customer)}
            </span>
            <span>{app.customer}</span>
            <span className="inline-flex items-center gap-1.5">
              {isLive && <span className="size-1.5 rounded-full bg-info animate-pulse" aria-hidden />}
              <StatusPill tone={statusTone} dot={!isLive}>
                {statusLabel}
              </StatusPill>
            </span>
          </span>
        }
        description={
          <>
            <span className="font-mono text-[12px] text-fg-secondary">{app.id.toUpperCase()}</span>
            <span className="mx-1.5 text-fg-muted">·</span>
            Requested <Money cents={app.amountCents} noFractions />
            <span className="mx-1.5 text-fg-muted">·</span>
            FICO {app.fico}
            <span className="mx-1.5 text-fg-muted">·</span>
            {productLabel[app.product]}
            <span className="mx-1.5 text-fg-muted">·</span>
            via {app.partner}
          </>
        }
        meta={
          <>
            <StatusPill tone="accent">{spec.name}</StatusPill>
            {tier && <StatusPill tone="info">{tierLabel[tier]}</StatusPill>}
            <StatusPill tone="neutral">Lender of record: {app.lender}</StatusPill>
            <span className="text-[11px] text-fg-muted font-mono">last event {lastEvent ? fmtRel(now - lastEvent.ts) : '—'}</span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" leadingIcon={<RouteIcon size={14} />}>Reroute to lender</Button>
            <Button variant="ghost" size="sm" leadingIcon={<AlertIcon size={14} />}>Mark for review</Button>
            <Button size="sm" leadingIcon={<SendIcon size={14} />}>Send notice</Button>
          </>
        }
      />
      <PageBody>
        {/* ─── A. Live tracking — what the partner watches in real time ─── */}
        <Card className="mb-4">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Live consumer tracker
                <span className="size-1.5 rounded-full bg-info animate-pulse" aria-hidden />
                <span className="text-[11px] font-normal text-fg-muted">
                  {pollPaused ? 'paused' : 'polling every 5s'}
                </span>
              </span>
            }
            description={
              live
                ? `Watching ${live.consumerContact.firstName || 'consumer'} ${live.consumerContact.lastInitial || ''}. Last updated ${new Date(live.lastUpdatedAt).toLocaleTimeString()}.`
                : 'Connecting…'
            }
            action={
              <div className="flex items-center gap-2">
                {live && (
                  <StatusPill tone={LIVE_STATUS_TONE[live.status]} dot>
                    {LIVE_STATUS_LABEL[live.status]}
                  </StatusPill>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLiveError(false);
                    errorLoggedRef.current = false;
                    void fetchLive();
                  }}
                >
                  Refresh
                </Button>
              </div>
            }
          />
          <CardBody>
            {/* Progress bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] text-fg-muted mb-1.5">
                <span>
                  {live ? `${live.progressPct}%` : '—'} complete
                </span>
                <span className="font-mono">
                  {live ? `step ${LIVE_STATUS_ORDER.indexOf(live.status) + 1} of ${LIVE_STATUS_ORDER.length}` : ''}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
                <span
                  className="block h-full bg-accent transition-all"
                  style={{ width: `${live?.progressPct ?? 0}%` }}
                />
              </div>
            </div>
            {liveError && (
              <div className="mb-3 rounded-md border border-warning/30 bg-warning-bg/40 px-3 py-2 text-[12px] text-warning">
                Live updates paused. Click Refresh to retry.
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Vertical stepper — completed steps marked, current step pulses */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
                  Timeline
                </div>
                <ol className="space-y-2">
                  {LIVE_STATUS_ORDER.map((stage, idx) => {
                    const currentIdx = live ? LIVE_STATUS_ORDER.indexOf(live.status) : -1;
                    const isDone = currentIdx >= 0 && idx < currentIdx;
                    const isActive = currentIdx === idx;
                    const isPending = currentIdx >= 0 && idx > currentIdx;
                    /* Resolve the matching timeline entry (server-emitted)
                     * so we can show the human detail line + relative ts. */
                    const entry = live?.timeline.find((t) => t.event === stage);
                    return (
                      <li key={stage} className="flex items-start gap-3">
                        <span className="shrink-0 mt-0.5">
                          {isDone ? (
                            <span className="inline-flex size-5 rounded-full bg-success-bg ring-1 ring-inset ring-success/40 items-center justify-center text-success">
                              <CheckIcon size={11} />
                            </span>
                          ) : isActive ? (
                            <span className="relative inline-flex size-5 items-center justify-center">
                              <span className="absolute inset-0 rounded-full bg-info/20 animate-pulse" aria-hidden />
                              <span className="relative inline-flex size-2.5 rounded-full bg-info ring-2 ring-info/30" aria-hidden />
                            </span>
                          ) : (
                            <span className="inline-flex size-5 rounded-full bg-bg-elevated ring-1 ring-inset ring-border" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                'text-[13px] font-medium ' +
                                (isPending ? 'text-fg-muted' : 'text-fg')
                              }
                            >
                              {LIVE_STATUS_LABEL[stage]}
                            </span>
                            {entry && (
                              <span className="font-mono text-[10px] text-fg-muted">
                                {new Date(entry.ts).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                          {entry?.detail && (
                            <p className="text-[11px] text-fg-muted truncate">{entry.detail}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {/* Offers list — populated once orchestration starts returning quotes */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted mb-2 flex items-center justify-between">
                  <span>Lender offers</span>
                  {live?.offers.length ? (
                    <span className="font-mono">{live.offers.length} so far</span>
                  ) : null}
                </div>
                {live && live.offers.length === 0 && (
                  <div className="rounded-md border border-dashed border-border bg-bg-muted/30 px-4 py-6 text-center text-[12px] text-fg-muted">
                    Offers will appear here once the consumer's application reaches the lender waterfall.
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2">
                  {live?.offers.map((offer) => {
                    const tone: StatusTone =
                      offer.decision === 'approved'
                        ? 'success'
                        : offer.decision === 'declined'
                          ? 'danger'
                          : 'info';
                    return (
                      <div
                        key={offer.lenderId}
                        className="rounded-md border border-border bg-bg-elevated px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-fg truncate">{offer.lenderName}</span>
                            <StatusPill tone={tone}>
                              {offer.decision === 'approved'
                                ? 'Approved'
                                : offer.decision === 'declined'
                                  ? 'Declined'
                                  : 'Pending'}
                            </StatusPill>
                          </div>
                          {offer.decision === 'approved' && (
                            <p className="text-[11px] text-fg-muted font-mono mt-0.5">
                              {offer.apr ? `${offer.apr.toFixed(2)}% APR` : ''}
                              {offer.termMonths ? ` · ${offer.termMonths}mo` : ''}
                              {typeof offer.amount === 'number' ? ` · $${Math.round(offer.amount / 100).toLocaleString('en-US')}` : ''}
                            </p>
                          )}
                          {offer.decision === 'pending' && (
                            <p className="text-[11px] text-fg-muted mt-0.5">Quoting in progress…</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* ─── B. Pipeline progress strip ─── */}
        <Card className="mb-4">
          <CardBody className="py-4">
            <div className="flex items-stretch gap-0 overflow-x-auto">
              {pipeline.map((s, i) => (
                <div key={s.key} className="flex items-stretch flex-1 min-w-[120px]">
                  <div className="flex flex-col items-center flex-1 px-2">
                    <StageDot status={s.status} />
                    <div className="mt-2 text-[12px] font-semibold text-fg">{s.label}</div>
                    <div className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-fg-muted">
                      {s.status === 'done' && s.completedAtMs ? fmtRel(now - s.completedAtMs) : null}
                      {s.status === 'active' ? 'in progress' : null}
                      {s.status === 'pending' ? 'pending' : null}
                      {s.status === 'skipped' ? 'skipped' : null}
                    </div>
                    <div className="mt-0.5 text-[10px] font-mono text-fg-muted">dwell {s.dwellSec}s</div>
                  </div>
                  {i < pipeline.length - 1 && (
                    <div className="flex items-center px-1">
                      <div
                        className={
                          s.status === 'done'
                            ? 'h-px w-full bg-success/60'
                            : s.status === 'active'
                              ? 'h-px w-full bg-gradient-to-r from-info to-border'
                              : 'h-px w-full bg-border'
                        }
                        style={{ minWidth: 24 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {activeStage && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[12px] text-fg-secondary">
                <span className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-info animate-pulse" aria-hidden />
                  Currently at <strong className="text-fg">{activeStage.label}</strong>
                  <span className="text-fg-muted">· active for {activeStage.dwellSec}s</span>
                </span>
                <span className="font-mono text-[11px] text-fg-muted">orchestration-v3.2 · trace_id={(hash(app.id + 'trace') % 1_000_000_000_000).toString(36)}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Top grid: event stream | waterfall */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
          {/* ─── C. Real-time event stream ─── */}
          <Card className="xl:col-span-2">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Real-time event stream
                  <span className="size-1.5 rounded-full bg-info animate-pulse" aria-hidden />
                  <span className="text-[11px] font-normal text-fg-muted">live</span>
                </span>
              }
              description={`${events.length} events · newest top`}
              action={<StatusPill tone="neutral" icon={<ClockIcon size={10} />}>{fmtRel(now - (lastEvent?.ts ?? now))}</StatusPill>}
            />
            <CardBody padded={false}>
              <ol className="max-h-[520px] overflow-y-auto divide-y divide-border">
                {feed.map((e, i) => (
                  <li key={`${e.ts}-${i}`} className="px-4 py-2.5 hover:bg-bg-muted/30 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 pt-0.5">
                        {i === 0 && isLive ? (
                          <span className="inline-flex size-2 rounded-full bg-info animate-pulse" aria-hidden />
                        ) : (
                          <span className="inline-flex size-2 rounded-full bg-border" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] text-fg-muted tabular-nums">{fmtClock(e.ts)}</span>
                          <AgentBadge code={e.agent} />
                          <span className="font-mono text-[10px] text-fg-muted ml-auto tabular-nums">{fmtRel(now - e.ts)}</span>
                        </div>
                        <div className="text-[13px] text-fg leading-snug">{e.message}</div>
                        {e.ref && <div className="text-[11px] text-fg-muted font-mono mt-0.5 truncate">{e.ref}</div>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          {/* ─── D. Lender waterfall results ─── */}
          <Card className="xl:col-span-3">
            <CardHeader
              title={`Lender waterfall (${waterfall.length})`}
              description={`Parallel quote results · ${waterfall.filter((w) => w.decision === 'approved').length} approved · ${waterfall.filter((w) => w.decision === 'declined').length} declined`}
              action={
                <Button variant="ghost" size="sm" trailingIcon={<ArrowRightIcon size={12} />}>
                  Pool settings
                </Button>
              }
            />
            <CardBody padded={false}>
              <DataTable
                columns={waterfallCols}
                rows={waterfall}
                rowKey={(w) => w.lender}
                dense
              />
            </CardBody>
          </Card>
        </div>

        {/* Middle: details + risk */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {/* ─── E. Application details ─── */}
          <Card>
            <CardHeader
              title="Customer"
              description="PII masked at rest · just-in-time unmask requires SOC2 step-up"
              action={<StatusPill tone="info" icon={<ShieldIcon size={10} />}>PII masked</StatusPill>}
            />
            <CardBody className="space-y-3">
              <MaskedField label="Legal name" masked={maskName(app.customer)} />
              <MaskedField label="DOB" masked="••/••/19••" />
              <MaskedField label="SSN" masked={`•••-••-${(hash(app.id + 'ssn') % 9000 + 1000)}`} />
              <MaskedField label="Address" masked="••• ••••• St · ••••••••, ••" />
              <MaskedField label="Email" masked={app.customerEmail.replace(/^(.).+(@.+)$/, '$1•••$2')} />
              <MaskedField label="Phone" masked={`(•••) •••-${(hash(app.id + 'ph') % 9000 + 1000)}`} />
              <div className="pt-2 border-t border-border grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">DTI</div>
                  <div className="mt-0.5 font-mono tabular-nums">{dti}%</div>
                </div>
                <div>
                  <div className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">FICO</div>
                  <div className="mt-0.5 font-mono tabular-nums">{app.fico} ({ficoBand(app.fico)})</div>
                </div>
                <div>
                  <div className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">Income</div>
                  <div className="mt-0.5 font-mono tabular-nums">
                    {highsale ? (
                      <>
                        <Money cents={highsale.summary.annualIncomeCentsRange.lowCents} compact noFractions />
                        <span className="text-fg-muted"> – </span>
                        <Money cents={highsale.summary.annualIncomeCentsRange.highCents} compact noFractions />
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-fg-muted text-[10px] uppercase tracking-wider font-semibold">Employment</div>
                  <div className="mt-0.5 text-[12px]">W-2 · 4y tenure</div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Application" />
            <CardBody>
              <DataRow label="Amount requested" value={<Money cents={app.amountCents} noFractions />} />
              <DataRow label="Purpose" value={productLabel[app.product]} />
              <DataRow label="Term preferred" value="48 months" />
              <DataRow label="Brand" value={spec.name} />
              <DataRow label="Partner" value={app.partner} />
              <DataRow label="Referral source" value={<span className="font-mono text-[12px]">{app.partner.split(/\s+/)[0]?.toLowerCase()}.eaze.pay</span>} />
              <DataRow label="Submitted" value={`${app.date} · ${fmtClock(baseStart)}`} />
              <DataRow label="Lender of record" value={app.lender} />
            </CardBody>
          </Card>

          {/* ─── F. Risk & fraud panel ─── */}
          <Card>
            <CardHeader
              title="Risk & fraud"
              description="SENTRY composite over identity, velocity, device, and synthetic-ID signals."
              action={<AgentBadge code="SENTRY" />}
            />
            <CardBody>
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">SENTRY risk</div>
                  <div className="text-[28px] font-semibold tabular-nums leading-none mt-1">{riskScore}</div>
                  <div className="text-[11px] text-success mt-1 font-medium">low</div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-fg-muted font-semibold">Sift</div>
                  <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{siftScore}</div>
                  <div className="text-[11px] text-success mt-1 font-medium">clean</div>
                </div>
              </div>
              <div className="space-y-2 text-[12px]">
                <RiskRow ok label="Identity match (Persona)" detail={`${personaConfidence}% confidence`} />
                <RiskRow ok={velocity === 0} label="Velocity (24h)" detail={`${velocity} app${velocity === 1 ? '' : 's'}`} />
                <RiskRow ok label="Device fingerprint" detail="trusted · no VPN" />
                <RiskRow ok label="Synthetic-ID check" detail="passed (Socure + Plaid)" />
                <RiskRow ok label="OFAC / sanctions" detail="clear" />
                <RiskRow ok label="IT red flags (FCRA)" detail="no discrepancies" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Bottom: docs | disbursement | audit */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {/* ─── G. Documents ─── */}
          <Card>
            <CardHeader
              title="Documents captured"
              description="Stored encrypted at rest · retained 7y per FCRA"
              action={<StatusPill tone="neutral">{4} files</StatusPill>}
            />
            <CardBody className="space-y-2">
              {[
                { name: 'ID front (drivers license)', ts: baseStart + 4_200, kind: 'image' as const },
                { name: 'ID back', ts: baseStart + 4_800, kind: 'image' as const },
                { name: 'Proof of income (paystub)', ts: baseStart + 6_100, kind: 'pdf' as const },
                { name: 'Consent / e-signature form', ts: baseStart + 9_500, kind: 'pdf' as const },
              ].map((d) => (
                <div key={d.name} className="flex items-center gap-3 rounded border border-border bg-bg-elevated px-3 py-2 hover:bg-bg-muted/30">
                  <div className="size-9 rounded bg-bg-muted ring-1 ring-border flex items-center justify-center text-fg-muted shrink-0">
                    <DocIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{d.name}</div>
                    <div className="text-[11px] text-fg-muted font-mono">
                      {d.kind.toUpperCase()} · captured {fmtRel(now - d.ts)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </CardBody>
          </Card>

          {/* ─── I. Disbursement (if funded) / Compliance otherwise ─── */}
          {app.status === 'funded' ? (
            <Card>
              <CardHeader
                title="Disbursement"
                description="Lender of record funds partner via FLUX rails. Servicing handed off to LEDGER."
                action={<AgentBadge code="FLUX" />}
              />
              <CardBody>
                <DataRow label="Rail" value={<StatusPill tone="success">RTP</StatusPill>} />
                <DataRow label="Funded at" value={<span className="font-mono text-[12px]">{fmtClock(baseStart + 65_000)}</span>} />
                <DataRow label="Net to partner" value={<Money cents={Math.round(app.amountCents * 0.97)} noFractions />} />
                <DataRow label="Platform take" value={<Money cents={Math.round(app.amountCents * 0.03)} noFractions />} />
                <DataRow label="Lender of record" value={`${app.lender} (TILA disclosed)`} />
                <DataRow label="Settlement latency" value={<span className="font-mono">4.2s</span>} />
                <DataRow label="Servicing" value={<span className="inline-flex items-center gap-1.5">handed off <AgentBadge code="LEDGER" /></span>} />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Compliance" />
              <CardBody className="space-y-2 text-[12px]">
                <RiskRow ok label="FCRA permissible purpose" detail="601(a)(3)(A) · soft pull only" />
                <RiskRow ok label="ECOA notice scheduled" detail={app.status === 'declined' ? 'AAN +30d window' : 'n/a — no adverse action'} />
                <RiskRow ok label="TILA box delivered" detail="acknowledged at offer" />
                <RiskRow ok label="State licensing" detail={`AZ · NMLS #1234567`} />
                <RiskRow ok label="Soft-pull artifact" detail={highsale ? `ref ${highsale.highsaleRef}` : 'pending'} />
                <RiskRow ok label="Consent log" detail={`opt-in v2.4 · ${fmtClock(baseStart + 2_400)}`} />
              </CardBody>
            </Card>
          )}

          {/* ─── H. Audit trail ─── */}
          <Card>
            <CardHeader
              title="Audit chain"
              description="Tamper-evident hash chain · last 10 entries"
              action={
                <StatusPill tone="success" icon={<CheckIcon size={10} />}>
                  integrity ✓
                </StatusPill>
              }
            />
            <CardBody padded={false}>
              <ol className="divide-y divide-border max-h-[360px] overflow-y-auto">
                {auditChain.map((a, i) => (
                  <li key={a.hash} className="px-4 py-2 flex items-center gap-3">
                    <span className="text-[10px] font-mono text-fg-muted tabular-nums shrink-0">#{(auditChain.length - i).toString().padStart(2, '0')}</span>
                    <span className="inline-flex items-center rounded bg-bg-muted text-fg-secondary px-1.5 py-0.5 text-[10px] font-bold tracking-wider font-mono ring-1 ring-inset ring-border shrink-0">
                      {a.stage}
                    </span>
                    <span className="text-[11px] font-mono text-fg-secondary truncate flex-1">
                      {a.hash.slice(0, 10)}…{a.hash.slice(-6)}
                    </span>
                    <span className="text-[10px] font-mono text-fg-muted tabular-nums shrink-0">{fmtClock(a.tsMs)}</span>
                  </li>
                ))}
              </ol>
              <div className="px-4 py-2.5 border-t border-border bg-bg-muted/30 text-[11px] text-fg-muted font-mono flex items-center gap-2">
                <CheckIcon size={12} className="text-success" />
                Verified · last hash <span className="text-fg-secondary">{auditChain[0]?.hash.slice(0, 8)}…{auditChain[0]?.hash.slice(-4)}</span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Footer system bar */}
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-fg-muted">
            <span className="inline-flex items-center gap-2">
              <BankIcon size={12} /> trace_id <span className="text-fg-secondary">{(hash(app.id + 'trace') % 1_000_000_000_000).toString(36)}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <ChartIcon size={12} /> orchestration-v3.2
            </span>
            <span className="inline-flex items-center gap-2">
              <GaugeIcon size={12} /> p50 latency 412ms · p99 1.4s
            </span>
            <span className="inline-flex items-center gap-2">
              <BoltIcon size={12} /> region us-east-1
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldIcon size={12} /> retention 7y · audit-replicated 3 regions
            </span>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function StageDot({ status }: { status: StageStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex size-7 rounded-full bg-success-bg ring-1 ring-inset ring-success/40 items-center justify-center text-success">
        <CheckIcon size={14} />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="relative inline-flex size-7 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-info/20 animate-pulse" aria-hidden />
        <span className="relative inline-flex size-4 rounded-full bg-info ring-2 ring-info/30" aria-hidden />
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex size-7 rounded-full bg-bg-muted ring-1 ring-inset ring-border items-center justify-center text-fg-muted">
        <XIcon size={12} />
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 rounded-full bg-bg-elevated ring-1 ring-inset ring-border items-center justify-center text-fg-muted">
      <ClockIcon size={12} />
    </span>
  );
}

function RiskRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          ok
            ? 'inline-flex size-4 rounded-full bg-success-bg text-success ring-1 ring-inset ring-success/30 items-center justify-center shrink-0 mt-0.5'
            : 'inline-flex size-4 rounded-full bg-warning-bg text-warning ring-1 ring-inset ring-warning/30 items-center justify-center shrink-0 mt-0.5'
        }
        aria-hidden
      >
        {ok ? <CheckIcon size={10} /> : <AlertIcon size={10} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[12px]">{label}</div>
        <div className="text-fg-muted text-[11px]">{detail}</div>
      </div>
    </div>
  );
}

function maskName(full: string): string {
  return full
    .split(/\s+/)
    .map((p) => p[0] + '•'.repeat(Math.max(p.length - 1, 3)))
    .join(' ');
}
