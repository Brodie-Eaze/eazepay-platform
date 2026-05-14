'use client';
import { useMemo, useState } from 'react';
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
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
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
 *   - fire a new invite from this page (mocked link generator)
 *
 * The detail page (`/onboarding-pipeline/[id]`) carries every action
 * the user asked for: KYB tracker, docs request, push/email/SMS,
 * notes, approve/decline, throttle controls.
 */

type Tab = 'all' | OnboardingStatus;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'invited', label: STATUS_LABEL.invited },
  { id: 'started', label: STATUS_LABEL.started },
  { id: 'kyb_running', label: STATUS_LABEL.kyb_running },
  { id: 'docs_pending', label: STATUS_LABEL.docs_pending },
  { id: 'info_pending', label: STATUS_LABEL.info_pending },
  { id: 'review', label: STATUS_LABEL.review },
  { id: 'approved', label: STATUS_LABEL.approved },
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

export default function OnboardingPipelinePage() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const rows = useMemo(() => {
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
    };
    ONBOARDING_BUSINESSES.forEach((b) => {
      if (b.status !== 'approved' && b.status !== 'declined') c.all += 1;
      c[b.status] += 1;
    });
    return c;
  }, []);

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
            <Button size="sm" onClick={() => setShowInvite((v) => !v)}>
              {showInvite ? 'Cancel' : 'Invite business'}
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
          </>
        }
      />

      <PageBody>
        {showInvite && <InviteBusinessCard onClose={() => setShowInvite(false)} />}

        <Banner intent="info" className="mb-4">
          <strong>How onboarding works.</strong> Send an invite → the business completes KYB +
          brand wizard → integrations onboard (Highsale, MyCAMP, EZ Check, Processing,
          DialerPay) → ops reviews → approve. You can fire push, email, and SMS reminders, and
          request additional docs or information at any step.
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
        </div>

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
                  <PipelineRow key={b.id} biz={b} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

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

function PipelineRow({ biz }: { biz: OnboardingBusiness }) {
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
            <p className="text-[13px] font-semibold text-fg truncate">{biz.legalName}</p>
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

function InviteBusinessCard({ onClose }: { onClose: () => void }) {
  const [legalName, setLegalName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [brands, setBrands] = useState<Record<BrandCode, boolean>>({
    tradepay: false,
    medpay: false,
    coachpay: false,
    direct: false,
  });
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://app.eazepay.com/welcome?invite=${(legalName || 'demo').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(inviteLink);
  };

  if (submitted) {
    return (
      <Card className="mb-4">
        <CardBody>
          <div className="flex items-start gap-3">
            <span className="size-10 rounded-lg bg-bg-inverse text-white flex items-center justify-center shrink-0">
              <CheckIcon size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-semibold text-fg">
                Invite sent to {contactEmail || contactPhone}
              </h2>
              <p className="text-[12px] text-fg-muted mt-1">
                {channel === 'both' ? 'Both email and SMS' : channel === 'email' ? 'Email' : 'SMS'}{' '}
                delivery queued. They&apos;ll land on the welcome wizard when they tap the link.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 font-mono text-[12px] text-fg-secondary bg-bg-muted rounded px-2.5 py-1.5 truncate">
                  {submitted}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(submitted).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}{' '}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardBody>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Invite a new business</h2>
            <p className="text-[12px] text-fg-muted">
              We&apos;ll mint a one-time signed link, send it via the channel you pick, and start
              tracking the business in this pipeline.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldRow label="Legal business name" required>
            <input
              required
              placeholder="Atlas Dental Group, LLC"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            />
          </FieldRow>
          <FieldRow label="Primary contact name" required>
            <input
              required
              placeholder="Dr. Lena Park"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            />
          </FieldRow>
          <FieldRow label="Email" required>
            <input
              required
              type="email"
              placeholder="lena@atlasdental.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            />
          </FieldRow>
          <FieldRow label="Phone">
            <input
              type="tel"
              placeholder="(555) 123-4567"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            />
          </FieldRow>
          <div className="md:col-span-2">
            <FieldRow label="Brands they're onboarding for" required>
              <div className="flex flex-wrap gap-2">
                {BRAND_ORDER.filter((b) => b !== 'direct').map((b) => {
                  const active = brands[b];
                  return (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setBrands((s) => ({ ...s, [b]: !s[b] }))}
                      className={
                        'h-9 px-3 rounded-md text-[12px] font-semibold transition-colors border ' +
                        (active
                          ? 'bg-[#0d1530] text-white border-[#0d1530]'
                          : 'bg-bg-elevated border-border text-fg-secondary hover:bg-bg-muted')
                      }
                    >
                      {BRANDS[b].name}
                    </button>
                  );
                })}
              </div>
            </FieldRow>
          </div>
          <FieldRow label="Delivery channel">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'email' | 'sms' | 'both')}
              className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px]"
            >
              <option value="email">Email only</option>
              <option value="sms">SMS only</option>
              <option value="both">Email + SMS</option>
            </select>
          </FieldRow>
          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2 border-t border-border">
            <p className="text-[11px] text-fg-muted leading-snug max-w-md">
              Link expires in 7 days. The business completes business profile → KYB → brand
              wizards → integrations. You&apos;ll see real-time status here.
            </p>
            <Button type="submit" disabled={!legalName || !contactEmail || !contactName}>
              <SendIcon size={13} /> Send invite
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-secondary mb-1.5">
        {label}
        {required && <span className="text-fg-muted ml-1">*</span>}
      </span>
      {children}
    </label>
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
