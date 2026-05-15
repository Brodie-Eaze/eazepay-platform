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
} from '@eazepay/ui/web';
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
  { id: 'medpay', name: 'MedPay', accent: '#0E7C66', tagline: 'Patient financing — dental, medical, vision, vet, fertility.' },
  { id: 'tradepay', name: 'TradePay', accent: '#F97316', tagline: 'Home improvement, solar, HVAC, roofing, contractor jobs.' },
  { id: 'coachpay', name: 'CoachPay', accent: '#6366F1', tagline: 'Pay-over-time for coaching, certifications, bootcamps.' },
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
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button size="sm" variant="secondary">
              <DocIcon size={13} /> Export queue
            </Button>
            <Button size="sm" onClick={() => setShowInvite(true)}>
              <SendIcon size={13} /> Generate invite link
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
          <strong>How onboarding works.</strong> Generate a direct invite link for a brand, send
          it to the business, and they land on a brand-locked onboarding wizard with their
          details prefilled. On submit, the application is stamped with your invite token and
          shows up here.
        </Banner>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1 mb-3 -mx-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  'h-8 inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-semibold transition-colors ' +
                  (active
                    ? 'bg-[#0d1530] text-white'
                    : 'text-fg-secondary hover:text-fg hover:bg-bg-muted')
                }
              >
                {t.label}
                <span
                  className={
                    'text-[10px] tabular-nums ' + (active ? 'text-white/70' : 'text-fg-muted')
                  }
                >
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
          <div className="flex-1" />
          {tab !== 'my_invites' && (
            <div className="flex items-center gap-2 h-8 rounded-md border border-border bg-bg-elevated px-2.5 w-72">
              <SearchIcon size={13} className="text-fg-muted" />
              <input
                type="text"
                placeholder="Search by name, EIN, contact…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 h-full bg-transparent outline-none text-[12px]"
              />
            </div>
          )}
        </div>

        {tab === 'my_invites' ? (
          <YourInvitesPanel
            invites={invites}
            loading={invitesLoading}
            onGenerate={() => setShowInvite(true)}
          />
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted bg-bg-muted/40 border-b border-border">
                <span className="col-span-4">Business</span>
                <span className="col-span-2">Brand</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2">Integrations</span>
                <span className="col-span-1 text-right">Last activity</span>
                <span className="col-span-1 text-right">Actions</span>
              </div>
              {rows.length === 0 ? (
                <div className="px-5 py-12 text-center text-[13px] text-fg-muted">
                  No businesses match this filter.
                </div>
              ) : (
                <ul className="divide-y divide-border">
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
  const integrationsDone = Object.values(biz.integrations).filter(
    (s) => s === 'completed',
  ).length;
  const integrationsTotal = Object.values(biz.integrations).length;

  const initials = biz.legalName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <li>
      <Link
        href={`/onboarding-pipeline/${biz.id}`}
        className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-bg-muted/40 transition-colors"
      >
        <div className="col-span-4 flex items-center gap-3 min-w-0">
          <span className="size-9 rounded-lg bg-bg-muted text-fg-secondary font-semibold text-[11px] flex items-center justify-center shrink-0">
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
        <div className="col-span-2 flex flex-wrap items-center gap-1">
          {biz.brands.map((br) => (
            <span
              key={br}
              className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-bg-muted text-fg-secondary border border-border"
            >
              {BRANDS[br].name}
            </span>
          ))}
        </div>
        <div className="col-span-2">
          <StatusPill tone={statusPillTone(biz.status)} dot>
            {STATUS_LABEL[biz.status]}
          </StatusPill>
        </div>
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-bg-muted overflow-hidden max-w-[120px]">
              <span
                className="block h-full bg-fg"
                style={{ width: `${(integrationsDone / integrationsTotal) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-fg-secondary tabular-nums">
              {integrationsDone}/{integrationsTotal}
            </span>
          </div>
        </div>
        <div className="col-span-1 text-right text-[11px] text-fg-muted">
          {ago(biz.lastActivityAt)}
        </div>
        <div className="col-span-1 text-right">
          <ArrowRightIcon size={13} className="text-fg-muted inline" />
        </div>
      </Link>
    </li>
  );
}

/* ─── Generate invite modal ───────────────────────────────────────── */

function GenerateInviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [brand, setBrand] = useState<InviteBrand | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [expiryHours, setExpiryHours] = useState<24 | 168 | 720>(168);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; token: string; expiresAt: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!brand) {
      setError('Pick a brand to continue.');
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
      setResult({ url: json.inviteUrl, token: json.token, expiresAt: json.expiresAt });
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg-inverse/40 backdrop-blur-sm px-4 py-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-bg-elevated shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Generate invite link</h2>
            <p className="text-[12px] text-fg-muted mt-0.5">
              Brand-locked, optionally prefilled. The business lands on the matching onboarding
              wizard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg shrink-0 ml-2"
          >
            <XIcon size={16} />
          </button>
        </div>

        {result ? (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="size-9 rounded-lg bg-[#0d1530] text-white flex items-center justify-center shrink-0">
                <CheckIcon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-fg">Invite link ready</p>
                <p className="text-[11px] text-fg-muted mt-0.5">
                  Expires {new Date(result.expiresAt).toLocaleString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · Token {result.token.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[12px] text-fg-secondary bg-bg-muted rounded px-3 py-2 truncate">
                {result.url}
              </code>
              <Button size="sm" variant="secondary" onClick={() => copyLink(result.url)}>
                {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Link
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold text-fg-secondary hover:text-fg inline-flex items-center gap-1"
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
          <div className="px-6 py-5 space-y-5">
            <section>
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-2">
                Brand <span className="text-fg-muted">(locked once sent)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {BRAND_TILES.map((t) => {
                  const active = brand === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setBrand(t.id)}
                      className={
                        'text-left rounded-md border p-3 transition-colors ' +
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
                        />
                        <span className="text-[13px] font-semibold text-fg">{t.name}</span>
                      </div>
                      <p className="text-[11px] text-fg-muted leading-snug">{t.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Business name" optional>
                <input
                  placeholder="Atlas Dental Group"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
                />
              </Field>
              <Field label="Contact email" optional>
                <input
                  type="email"
                  placeholder="owner@business.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
                />
              </Field>
              <Field label="Contact phone" optional>
                <input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
                />
              </Field>
              <Field label="Link expiry">
                <select
                  value={expiryHours}
                  onChange={(e) =>
                    setExpiryHours(Number(e.target.value) as 24 | 168 | 720)
                  }
                  className="w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </section>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <p className="text-[11px] text-fg-muted max-w-sm leading-snug">
                You copy the link. You send it via your channel of choice. The system stamps the
                application with your operator id when they submit.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={generate} disabled={!brand || submitting}>
                  {submitting ? 'Generating…' : 'Generate link'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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
          <p className="text-[12px] text-fg-muted text-center py-8">Loading your invites…</p>
        </CardBody>
      </Card>
    );
  }
  if (invites.length === 0) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="size-10 rounded-lg bg-bg-muted text-fg-secondary flex items-center justify-center mb-3">
              <SendIcon size={16} />
            </span>
            <p className="text-[13px] font-semibold text-fg">No invites yet</p>
            <p className="text-[12px] text-fg-muted mt-1 max-w-sm">
              Generate a direct invite link for any brand and send it to the business yourself.
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={onGenerate}>
                <SendIcon size={13} /> Generate invite link
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardBody className="p-0">
        <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted bg-bg-muted/40 border-b border-border">
          <span className="col-span-3">Business</span>
          <span className="col-span-2">Brand</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Expires</span>
          <span className="col-span-1 text-right">Created</span>
          <span className="col-span-2 text-right">Actions</span>
        </div>
        <ul className="divide-y divide-border">
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
    <li className="grid grid-cols-12 items-center gap-3 px-5 py-3 hover:bg-bg-muted/40">
      <div className="col-span-3 min-w-0">
        <p className="text-[13px] font-semibold text-fg truncate">
          {inv.prefill.businessName || 'No business name provided'}
        </p>
        <p className="text-[11px] text-fg-muted truncate">
          {inv.prefill.contactEmail || inv.prefill.contactPhone || '—'}
        </p>
      </div>
      <div className="col-span-2">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: brandMeta?.accent }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: brandMeta?.accent }}
          />
          {brandMeta?.name}
        </span>
      </div>
      <div className="col-span-2">
        <StatusPill
          tone={
            inv.status === 'active'
              ? 'info'
              : inv.status === 'redeemed'
                ? 'success'
                : 'neutral'
          }
          dot
        >
          {inv.status === 'active' ? 'Active' : inv.status === 'redeemed' ? 'Redeemed' : 'Expired'}
        </StatusPill>
      </div>
      <div className="col-span-2 text-[11px] text-fg-secondary tabular-nums">
        {expiryLabel}
      </div>
      <div className="col-span-1 text-right text-[11px] text-fg-muted">
        {ago(inv.createdAt)}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inv.inviteUrl).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          disabled={inv.status !== 'active'}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-fg-secondary hover:text-fg hover:bg-bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link
          href={inv.inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-fg-secondary hover:text-fg hover:bg-bg-muted/60"
        >
          Open
          <ArrowRightIcon size={11} />
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
