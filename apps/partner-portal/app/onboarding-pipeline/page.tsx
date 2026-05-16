'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  Banner,
  ArrowRightIcon,
  SendIcon,
  CheckIcon,
  ClockIcon,
  AlertIcon,
  DocIcon,
  SearchIcon,
  UsersIcon,
  CopyIcon,
  XIcon,
  Skeleton,
} from '@eazepay/ui/web';
import { Modal, ErrorBanner, EmptyDataState } from '../../components/a11y';
import { BRANDS } from '@eazepay/shared-types';
import {
  ONBOARDING_BUSINESSES,
  STATUS_LABEL,
  seedAgo,
  type OnboardingBusiness,
  type OnboardingStatus,
} from '../../lib/onboarding-data';

/**
 * Onboarding Command Centre — the master operator queue.
 *
 * One screen for every business currently being shepherded through
 * the configuration funnel. Lets ops:
 *   - filter by status (invited / KYB running / docs pending / info
 *     pending / review / approved / declined)
 *   - search by name, EIN, or contact
 *   - jump into a per-business detail page for full controls
 *   - mint a direct invite link via the modal — brand-locked, optionally
 *     prefilled, with a chosen expiry. The operator copies the URL and
 *     sends it themselves (email / SMS / whatever).
 *
 * "Your invites" tab surfaces every invite this operator has minted,
 * keyed off their email-derived `invitedById`. Each row carries its
 * status (active / expired / redeemed) and a re-copy CTA.
 */

type Tab = 'all' | OnboardingStatus | 'my_invites';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'invited', label: STATUS_LABEL.invited },
  { id: 'started', label: STATUS_LABEL.started },
  { id: 'kyb_running', label: STATUS_LABEL.kyb_running },
  { id: 'docs_pending', label: STATUS_LABEL.docs_pending },
  { id: 'info_pending', label: STATUS_LABEL.info_pending },
  { id: 'review', label: STATUS_LABEL.review },
  { id: 'approved', label: STATUS_LABEL.approved },
  { id: 'my_invites', label: 'Your invites' },
];

const statusPillTone = (
  s: OnboardingStatus,
): 'success' | 'warning' | 'info' | 'neutral' | 'accent' =>
  s === 'approved'
    ? 'success'
    : s === 'declined'
      ? 'warning'
      : s === 'review'
        ? 'accent'
        : s === 'docs_pending' || s === 'info_pending'
          ? 'warning'
          : 'neutral';

const ago = seedAgo;

/* Hard-coded operator identity for the demo — matches the email used
 * elsewhere in the master operator surfaces. Once Clerk wires in,
 * pull this from `useUser()`. */
const OPERATOR_EMAIL = 'brodie@amalafinance.com.au';
const OPERATOR_ID = 'op_brodie_amalafinance_com_au';

type InviteBrand = 'medpay' | 'tradepay' | 'coachpay';
type InviteStatus = 'active' | 'expired' | 'redeemed';

interface InviteRow {
  token: string;
  brand: InviteBrand;
  prefill: { businessName?: string; contactEmail?: string; contactPhone?: string };
  invitedByEmail: string;
  invitedById: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedApplicationId: string | null;
  status: InviteStatus;
  inviteUrl: string;
}

const BRAND_TILES: Array<{ id: InviteBrand; name: string; accent: string; tagline: string }> = [
  {
    id: 'medpay',
    name: 'MedPay',
    accent: '#0E7C66',
    tagline: 'Patient financing — dental, medical, vision, vet, fertility.',
  },
  {
    id: 'tradepay',
    name: 'TradePay',
    accent: '#F97316',
    tagline: 'Home improvement, solar, HVAC, roofing, contractor jobs.',
  },
  {
    id: 'coachpay',
    name: 'CoachPay',
    accent: '#6366F1',
    tagline: 'Pay-over-time for coaching, certifications, bootcamps.',
  },
];

const EXPIRY_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
];

export default function OnboardingPipelinePage() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  const refreshInvites = async () => {
    setInvitesLoading(true);
    try {
      const res = await fetch(
        `/api/onboarding/invite?invitedByEmail=${encodeURIComponent(OPERATOR_EMAIL)}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const json = (await res.json()) as { invites: InviteRow[] };
        setInvites(json.invites ?? []);
      }
    } catch {
      /* ignore — list stays empty in dev when API is misconfigured. */
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    void refreshInvites();
  }, []);

  /* Build a set of business IDs the operator invited, for the badge.
   * In the seed data, `invitedBy` is a display name — we can't match
   * cleanly, so the badge currently lights up for businesses whose
   * primaryContact.email matches an invite prefill we minted. That's
   * the truthful signal we have until applications carry
   * `meta.invitedById`. */
  const invitedEmailSet = useMemo(() => {
    const s = new Set<string>();
    for (const inv of invites) {
      if (inv.prefill.contactEmail) s.add(inv.prefill.contactEmail.toLowerCase());
    }
    return s;
  }, [invites]);

  const rows = useMemo(() => {
    if (tab === 'my_invites') return [];
    const filtered = ONBOARDING_BUSINESSES.filter((b) =>
      tab === 'all' ? b.status !== 'approved' && b.status !== 'declined' : b.status === tab,
    );
    if (!query.trim()) return filtered;
    const q = query.toLowerCase();
    return filtered.filter(
      (b) =>
        b.legalName.toLowerCase().includes(q) ||
        b.dba?.toLowerCase().includes(q) ||
        b.ein.includes(q) ||
        b.primaryContact.email.toLowerCase().includes(q) ||
        b.primaryContact.phone.includes(q),
    );
  }, [tab, query]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      all: 0,
      invited: 0,
      started: 0,
      kyb_running: 0,
      docs_pending: 0,
      info_pending: 0,
      review: 0,
      approved: 0,
      declined: 0,
      my_invites: 0,
    };
    ONBOARDING_BUSINESSES.forEach((b) => {
      if (b.status !== 'approved' && b.status !== 'declined') c.all += 1;
      c[b.status] += 1;
    });
    c.my_invites = invites.length;
    return c;
  }, [invites]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: 'Onboarding' }]}
        title="Onboarding Pipeline"
        description="Every business EazePay is currently shepherding through configuration. Drill into any row to manage KYB, document requests, comms, and approval."
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
            <Button size="sm" variant="secondary">
              <DocIcon size={13} aria-hidden /> Export queue
            </Button>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <SendIcon size={13} aria-hidden /> Generate invite link
            </Button>
          </div>
        }
        meta={
          <>
            <StatusPill tone="neutral" dot>
              {counts.all} in flight
            </StatusPill>
            <StatusPill tone="accent" dot>
              {counts.review} ready for review
            </StatusPill>
            <StatusPill tone="warning" dot>
              {counts.docs_pending + counts.info_pending} waiting on customer
            </StatusPill>
            {invites.length > 0 && (
              <StatusPill tone="info" dot>
                {invites.filter((i) => i.status === 'active').length} active invites
              </StatusPill>
            )}
          </>
        }
      />

      <PageBody>
        {showInvite && (
          <GenerateInviteModal
            onClose={() => setShowInvite(false)}
            onCreated={async () => {
              await refreshInvites();
              setTab('my_invites');
            }}
          />
        )}

        <Banner intent="info" className="mb-4">
          <strong>How onboarding works.</strong> Generate a direct invite link for a brand, send it
          to the business, and they land on a brand-locked onboarding wizard with their details
          prefilled. On submit, the application is stamped with your invite token and shows up here.
        </Banner>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1 mb-3 -mx-1">
          <div
            role="tablist"
            aria-label="Pipeline filters"
            className="flex flex-wrap items-center gap-1"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`pipeline-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="pipeline-tabpanel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={
                    'min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 ' +
                    (active
                      ? 'bg-[#0d1530] text-white'
                      : 'text-fg-secondary hover:text-fg hover:bg-bg-muted')
                  }
                >
                  <span>{t.label}</span>
                  <span
                    className={
                      'text-[10px] tabular-nums ' + (active ? 'text-white/70' : 'text-fg-muted')
                    }
                    aria-label={`${counts[t.id]} items`}
                  >
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          {tab !== 'my_invites' && (
            <label className="flex items-center gap-2 min-h-[36px] rounded-md border border-border bg-bg-elevated px-2.5 w-full sm:w-72 focus-within:border-border-strong focus-within:ring-2 focus-within:ring-border-focus/30">
              <SearchIcon size={13} className="text-fg-muted" aria-hidden />
              <span className="sr-only">Search businesses by name, EIN, or contact</span>
              <input
                type="text"
                placeholder="Search by name, EIN, contact…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search businesses by name, EIN, or contact"
                className="flex-1 bg-transparent outline-none text-[12px]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="inline-flex items-center justify-center h-6 w-6 rounded text-fg-muted hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <XIcon size={11} />
                </button>
              )}
            </label>
          )}
        </div>

        <div id="pipeline-tabpanel" role="tabpanel" aria-labelledby={`pipeline-tab-${tab}`}>
          {tab === 'my_invites' ? (
            <YourInvitesPanel
              invites={invites}
              loading={invitesLoading}
              onGenerate={() => setShowInvite(true)}
            />
          ) : (
            <Card>
              <CardBody className="p-0">
                <div className="hidden md:grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted bg-bg-muted/40 border-b border-border">
                  <span className="col-span-4">Business</span>
                  <span className="col-span-2">Brand</span>
                  <span className="col-span-2">Status</span>
                  <span className="col-span-2">Integrations</span>
                  <span className="col-span-1 text-right">Last activity</span>
                  <span className="col-span-1 text-right">Actions</span>
                </div>
                {rows.length === 0 ? (
                  <EmptyDataState
                    className="m-4"
                    title="No businesses match this filter"
                    description={
                      query
                        ? 'Try clearing the search or pick a different tab.'
                        : 'Switch tabs above or generate a fresh invite to start a new flow.'
                    }
                    action={
                      query ? (
                        <Button size="sm" variant="secondary" onClick={() => setQuery('')}>
                          Clear search
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setShowInvite(true)}>
                          <SendIcon size={13} /> Generate invite link
                        </Button>
                      )
                    }
                  />
                ) : (
                  <ul
                    className="divide-y divide-border"
                    aria-label={`${rows.length} businesses in pipeline`}
                  >
                    {rows.map((b) => (
                      <PipelineRow
                        key={b.id}
                        biz={b}
                        invitedByOperator={invitedEmailSet.has(
                          b.primaryContact.email.toLowerCase(),
                        )}
                      />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard
            icon={<UsersIcon size={14} />}
            label="Total invites sent (30d)"
            value="42"
            sub="+8 vs. previous 30d"
          />
          <StatCard
            icon={<CheckIcon size={14} />}
            label="Median time to approve"
            value="9 days"
            sub="P90: 14 days"
          />
          <StatCard
            icon={<AlertIcon size={14} />}
            label="Stuck > 7 days"
            value="3"
            sub="Owner: Cole · Maya"
          />
        </div>
      </PageBody>
    </>
  );
}

function PipelineRow({
  biz,
  invitedByOperator,
}: {
  biz: OnboardingBusiness;
  invitedByOperator?: boolean;
}) {
  const integrationsDone = Object.values(biz.integrations).filter((s) => s === 'completed').length;
  const integrationsTotal = Object.values(biz.integrations).length;

  const initials = biz.legalName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const integrationsPct = Math.round((integrationsDone / integrationsTotal) * 100);
  return (
    <li>
      <Link
        href={`/onboarding-pipeline/${biz.id}`}
        aria-label={`${biz.legalName} — ${STATUS_LABEL[biz.status]} — ${integrationsDone} of ${integrationsTotal} integrations complete`}
        className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-3 px-4 sm:px-5 py-3 hover:bg-bg-muted/40 transition-colors focus-visible:outline-none focus-visible:bg-bg-muted/50"
      >
        <div className="md:col-span-4 flex items-center gap-3 min-w-0">
          <span
            className="size-9 rounded-lg bg-bg-muted text-fg-secondary font-semibold text-[11px] flex items-center justify-center shrink-0"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-fg truncate">{biz.legalName}</p>
              {invitedByOperator && (
                <span
                  title="You invited this business"
                  className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-[#0d1530] text-white shrink-0"
                >
                  Your invite
                </span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted truncate">
              {biz.industry} · {biz.state} · {biz.primaryContact.name}
            </p>
          </div>
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-1">
          <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
            Brand
          </span>
          {biz.brands.map((br) => (
            <span
              key={br}
              className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-bg-muted text-fg-secondary border border-border"
            >
              {BRANDS[br].name}
            </span>
          ))}
        </div>
        <div className="md:col-span-2 flex md:block items-center gap-2">
          <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
            Status
          </span>
          <StatusPill tone={statusPillTone(biz.status)} dot>
            {STATUS_LABEL[biz.status]}
          </StatusPill>
        </div>
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
              Integrations
            </span>
            <div
              className="flex-1 h-1.5 rounded-full bg-bg-muted overflow-hidden max-w-[120px]"
              role="progressbar"
              aria-valuenow={integrationsPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Integrations ${integrationsDone} of ${integrationsTotal} complete`}
            >
              <span
                className="block h-full bg-fg"
                style={{ width: `${integrationsPct}%` }}
                aria-hidden
              />
            </div>
            <span className="text-[11px] text-fg-secondary tabular-nums">
              {integrationsDone}/{integrationsTotal}
            </span>
          </div>
        </div>
        <div className="md:col-span-1 md:text-right text-[11px] text-fg-muted">
          <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted mr-1">
            Last:
          </span>
          {ago(biz.lastActivityAt)}
        </div>
        <div className="hidden md:flex md:col-span-1 md:justify-end">
          <ArrowRightIcon size={13} className="text-fg-muted" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

/* ─── Generate invite modal ───────────────────────────────────────── */

type LinkChoice = InviteBrand | 'universal';

function GenerateInviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [brand, setBrand] = useState<LinkChoice | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [expiryHours, setExpiryHours] = useState<24 | 168 | 720>(168);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    url: string;
    token: string;
    expiresAt: string;
    brand: LinkChoice;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!brand) {
      setError('Pick a link type to continue.');
      return;
    }

    // ── Universal link: prospect picks their own vertical on /welcome.
    // No API token needed — the /welcome wizard already starts with an
    // industry-picker step, so it's a safe public entry point. We just
    // construct the URL client-side with the operator's ref so the
    // submission is still attributed.
    if (brand === 'universal') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const params = new URLSearchParams({ ref: OPERATOR_ID });
      if (businessName.trim()) params.set('business', businessName.trim());
      if (contactEmail.trim()) params.set('email', contactEmail.trim());
      const url = `${origin}/welcome?${params.toString()}`;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      setResult({ url, token: 'universal', expiresAt, brand: 'universal' });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brand,
          expiryHours,
          invitedByEmail: OPERATOR_EMAIL,
          prefill: {
            businessName: businessName.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(body?.detail ?? 'Could not generate invite. Check the fields and try again.');
        setSubmitting(false);
        return;
      }
      const json = (await res.json()) as {
        inviteUrl: string;
        token: string;
        expiresAt: string;
      };
      setResult({ url: json.inviteUrl, token: json.token, expiresAt: json.expiresAt, brand });
      await onCreated();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  /**
   * Open the OS email composer with a prefilled subject + body. Uses a
   * `mailto:` link rather than a server-side send so it works from any
   * device, requires no SMTP wiring, and lets the operator personalise
   * before sending. The prospect's email goes in the To: field when we
   * have it; otherwise the composer opens with no recipient.
   */
  const sendByEmail = (r: { url: string; expiresAt: string; brand: LinkChoice }) => {
    const brandLabel =
      r.brand === 'universal'
        ? 'EazePay'
        : (BRAND_TILES.find((b) => b.id === r.brand)?.name ?? 'EazePay');
    const expiry = new Date(r.expiresAt).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const greeting = businessName.trim() ? `Hi ${businessName.trim()} team,` : 'Hi,';
    const verticalLine =
      r.brand === 'universal'
        ? "Once you start the wizard you'll pick the vertical that matches your business (MedPay, TradePay, or CoachPay)."
        : `This is your direct onboarding link for ${brandLabel}.`;
    const body =
      `${greeting}\n\n` +
      `Thanks for the chat. Here's your onboarding link to get set up on the EazePay platform:\n\n` +
      `${r.url}\n\n` +
      `${verticalLine}\n\n` +
      `It expires ${expiry}. Reply to this email if you hit any snags.\n\n` +
      `— Brodie\n` +
      `${OPERATOR_EMAIL}`;
    const subject = `Your EazePay onboarding link${brandLabel !== 'EazePay' ? ` · ${brandLabel}` : ''}`;
    const to = encodeURIComponent(contactEmail.trim());
    const params = `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const href = `mailto:${to}${params}`;
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Generate invite link"
      description="Brand-locked, optionally prefilled. The business lands on the matching onboarding wizard."
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3" role="status" aria-live="polite">
            <span
              className="size-9 rounded-lg bg-[#0d1530] text-white flex items-center justify-center shrink-0"
              aria-hidden
            >
              <CheckIcon size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-fg">Invite link ready</p>
              <p className="text-[11px] text-fg-muted mt-0.5">
                Expires{' '}
                {new Date(result.expiresAt).toLocaleString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                · Token {result.token.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex-1 min-w-[180px]">
              <span className="sr-only">Invite URL</span>
              <code className="block w-full font-mono text-[12px] text-fg-secondary bg-bg-muted rounded px-3 py-2 truncate">
                {result.url}
              </code>
            </label>
            <Button size="sm" variant="secondary" onClick={() => copyLink(result.url)}>
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              size="sm"
              onClick={() => sendByEmail(result)}
              aria-label="Open email composer with the invite link prefilled"
            >
              <SendIcon size={13} />
              Send via email
            </Button>
          </div>
          {!contactEmail.trim() && (
            <p className="text-[11px] text-fg-muted leading-snug">
              No contact email captured — the composer will open with an empty To: field so you can
              type it in.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            <Link
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold text-fg-secondary hover:text-fg inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
            >
              Open the onboarding page <ArrowRightIcon size={12} />
            </Link>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  setBrand(null);
                  setBusinessName('');
                  setContactEmail('');
                  setContactPhone('');
                }}
              >
                Generate another
              </Button>
              <Button size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <p
              className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2"
              id="invite-brand-label"
            >
              Link type{' '}
              <span className="text-fg-muted">
                (brand-locked, or universal if the vertical isn't decided)
              </span>
            </p>
            <div
              role="radiogroup"
              aria-labelledby="invite-brand-label"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {BRAND_TILES.map((t) => {
                const active = brand === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBrand(t.id)}
                    className={
                      'text-left rounded-md border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 ' +
                      (active
                        ? 'border-[#0d1530] bg-[#0d1530]/5'
                        : 'border-border bg-bg hover:bg-bg-muted/40')
                    }
                    style={active ? { boxShadow: `inset 0 0 0 1px ${t.accent}` } : undefined}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: t.accent }}
                        aria-hidden
                      />
                      <span className="text-[13px] font-semibold text-fg">{t.name}</span>
                    </div>
                    <p className="text-[11px] text-fg-muted leading-snug">{t.tagline}</p>
                  </button>
                );
              })}
            </div>
            {/* Universal tile — full-width, distinguished from the 3 brand
                tiles. Sends the prospect to /welcome where they self-pick
                their vertical (industry-picker is step 1 of that wizard). */}
            <button
              type="button"
              role="radio"
              aria-checked={brand === 'universal'}
              onClick={() => setBrand('universal')}
              className={
                'mt-2 w-full text-left rounded-md border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1 ' +
                (brand === 'universal'
                  ? 'border-[#0d1530] bg-[#0d1530]/5 shadow-[inset_0_0_0_1px_#0d1530]'
                  : 'border-border bg-bg hover:bg-bg-muted/40')
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shrink-0"
                  aria-hidden
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="text-[13px] font-semibold text-fg">Universal · they pick</span>
                <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted bg-bg-muted rounded px-1.5 py-0.5 ml-auto">
                  Config link
                </span>
              </div>
              <p className="text-[11px] text-fg-muted leading-snug">
                When you don't know the vertical yet. The prospect lands on the EazePay onboarding
                wizard and picks MedPay / TradePay / CoachPay themselves on step 1.
              </p>
            </button>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Business name" optional>
              <input
                placeholder="Atlas Dental Group"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                aria-label="Business name (optional)"
                className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong outline-none"
              />
            </Field>
            <Field label="Contact email" optional>
              <input
                type="email"
                placeholder="owner@business.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                aria-label="Contact email (optional)"
                className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong outline-none"
              />
            </Field>
            <Field label="Contact phone" optional>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                aria-label="Contact phone (optional)"
                className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong outline-none"
              />
            </Field>
            <Field label="Link expiry">
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value) as 24 | 168 | 720)}
                aria-label="Link expiry"
                className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong outline-none"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.hours} value={o.hours}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <p className="text-[11px] text-fg-muted max-w-sm leading-snug">
              Copy the link or send it directly via email. The system stamps the application with
              your operator id when they submit.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={generate} disabled={!brand || submitting}>
                {submitting ? (
                  <>
                    <span
                      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                      aria-hidden
                    />
                    Generating…
                  </>
                ) : brand === 'universal' ? (
                  'Generate universal link'
                ) : (
                  'Generate link'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-1">
        {label}
        {optional && <span className="text-fg-muted ml-1">optional</span>}
      </span>
      {children}
    </label>
  );
}

/* ─── Your invites tab ────────────────────────────────────────────── */

function YourInvitesPanel({
  invites,
  loading,
  onGenerate,
}: {
  invites: InviteRow[];
  loading: boolean;
  onGenerate: () => void;
}) {
  if (loading && invites.length === 0) {
    return (
      <Card>
        <CardBody>
          <div
            className="space-y-2 py-3"
            role="status"
            aria-busy="true"
            aria-live="polite"
            aria-label="Loading your invites"
          >
            <Skeleton rows={4} bare />
          </div>
        </CardBody>
      </Card>
    );
  }
  if (invites.length === 0) {
    return (
      <EmptyDataState
        title="No invites yet"
        description="Generate a direct invite link for any brand and send it to the business yourself."
        icon={<SendIcon size={18} />}
        action={
          <Button size="sm" onClick={onGenerate}>
            <SendIcon size={13} /> Generate invite link
          </Button>
        }
      />
    );
  }
  return (
    <Card>
      <CardBody className="p-0">
        <div className="hidden md:grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted bg-bg-muted/40 border-b border-border">
          <span className="col-span-3">Business</span>
          <span className="col-span-2">Brand</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Expires</span>
          <span className="col-span-1 text-right">Created</span>
          <span className="col-span-2 text-right">Actions</span>
        </div>
        <ul className="divide-y divide-border" aria-label={`${invites.length} invites`}>
          {invites.map((inv) => (
            <InviteRowItem key={inv.token} inv={inv} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function InviteRowItem({ inv }: { inv: InviteRow }) {
  const [copied, setCopied] = useState(false);
  const brandMeta = BRAND_TILES.find((b) => b.id === inv.brand);
  const expiryLabel = new Date(inv.expiresAt).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <li className="grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-3 px-4 sm:px-5 py-3 hover:bg-bg-muted/40">
      <div className="md:col-span-3 min-w-0">
        <p className="text-[13px] font-semibold text-fg truncate">
          {inv.prefill.businessName || 'No business name provided'}
        </p>
        <p className="text-[11px] text-fg-muted truncate">
          {inv.prefill.contactEmail || inv.prefill.contactPhone || '—'}
        </p>
      </div>
      <div className="md:col-span-2 flex md:block items-center gap-2">
        <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
          Brand
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: brandMeta?.accent }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: brandMeta?.accent }}
            aria-hidden
          />
          {brandMeta?.name}
        </span>
      </div>
      <div className="md:col-span-2 flex md:block items-center gap-2">
        <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
          Status
        </span>
        <StatusPill
          tone={
            inv.status === 'active' ? 'info' : inv.status === 'redeemed' ? 'success' : 'neutral'
          }
          dot
        >
          {inv.status === 'active' ? 'Active' : inv.status === 'redeemed' ? 'Redeemed' : 'Expired'}
        </StatusPill>
      </div>
      <div className="md:col-span-2 text-[11px] text-fg-secondary tabular-nums flex md:block items-center gap-2">
        <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
          Expires
        </span>
        {expiryLabel}
      </div>
      <div className="md:col-span-1 md:text-right text-[11px] text-fg-muted flex md:block items-center gap-2">
        <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold">
          Created
        </span>
        {ago(inv.createdAt)}
      </div>
      <div className="md:col-span-2 flex items-center md:justify-end gap-1.5 mt-1 md:mt-0">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inv.inviteUrl).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          disabled={inv.status !== 'active'}
          aria-label={`Copy invite link for ${inv.prefill.businessName || 'this invite'}`}
          className="inline-flex items-center gap-1 min-h-[36px] px-2 rounded-md text-[11px] font-semibold text-fg-secondary hover:text-fg hover:bg-bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {copied ? <CheckIcon size={11} aria-hidden /> : <CopyIcon size={11} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link
          href={inv.inviteUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open invite link for ${inv.prefill.businessName || 'this invite'} in a new tab`}
          className="inline-flex items-center gap-1 min-h-[36px] px-2 rounded-md text-[11px] font-semibold text-fg-secondary hover:text-fg hover:bg-bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          Open
          <ArrowRightIcon size={11} aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
            {label}
          </p>
          <span className="text-fg-muted">{icon}</span>
        </div>
        <p className="text-[20px] font-semibold text-fg leading-none">{value}</p>
        <p className="text-[11px] text-fg-muted mt-1.5">{sub}</p>
      </CardBody>
    </Card>
  );
}

/* Silence unused-import warnings for icons reserved for future surfaces
 * (the original page imported these for now-unused panels). */
void ClockIcon;
void OPERATOR_ID;
