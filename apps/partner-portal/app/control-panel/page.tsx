'use client';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button as _Button,
  StatusPill,
  Money,
  Filter,
  ArrowRightIcon,
  SearchIcon,
  ExternalIcon,
  XIcon,
  CheckIcon,
  AlertIcon,
  LiveIndicator,
  TimeRangeSelector,
  TIME_RANGES,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
  type FilterGroup,
  type FilterOption,
  type TimeRange,
} from '@eazepay/ui/web';
import {
  NICHES_BY_BRAND,
  NICHE_LABEL,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABEL,
  normalizePartnerStatus,
  type Niche as CanonicalNiche,
  type PartnerStatus,
} from '@eazepay/shared-types';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { Modal, ErrorBanner } from '../../components/a11y';

/* Local typed re-export — the upstream Button declares its props via a
 * destructured function signature, which strict TS JSX inference doesn't
 * pick `children` up from. Wrap it in a typed FC so call sites compile. */
type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};
const Button: React.FC<ButtonProps> = (props) => <_Button {...(props as any)} />;
import {
  partners as MASTER_PARTNERS,
  type PartnerSummary,
  type Niche,
  type ProductBrand,
  type ApprovalStatus,
} from '../../lib/master-data';

/**
 * Control Panel — operational list of every partner on the platform.
 *
 *  - Real master roster from lib/master-data.ts (no more 3-row stub).
 *  - Rows are clickable Links to /control-panel/[partnerId].
 *  - Each row has a kebab popover with quick actions (Suspend, Reactivate,
 *    View applications, View payouts, Lender access).
 *  - "Add Partner" modal — optimistic state push (engineer wires backend later).
 *  - "Refresh" button shuffles the visible order deterministically so the
 *    page feels live; useful for showing reactivity.
 *  - Stats bar at the top: total partners, active, suspended, funded volume.
 */

type LocalPartner = PartnerSummary & {
  /** Allow status to expand beyond the master tristate so we can flag suspended UI-side. */
  uiStatus: 'Approved' | 'Pending' | 'Suspended';
};

const statusTone: Record<LocalPartner['uiStatus'], StatusTone> = {
  Approved: 'success',
  Pending: 'warning',
  Suspended: 'danger',
};

const nicheLabel: Record<Niche, string> = {
  coaching: 'Coaching',
  medical: 'Medical',
  trades: 'Trades',
  dental: 'Dental',
  consumer: 'Consumer',
};

/* Canonical niche dropdown — grouped Brand → Niche per Builder P's
 * taxonomy. Brand groupings match `NICHES_BY_BRAND` in
 * `@eazepay/shared-types`; pre-existing fixture rows whose niche is
 * `coaching` / `trades` / `consumer` won't match any canonical key — they
 * simply won't pass the filter when one is applied. */
const NICHE_FILTER_GROUPS: FilterGroup<CanonicalNiche>[] = [
  {
    label: 'MedPay',
    options: NICHES_BY_BRAND.medpay.map(
      (n) => ({ value: n, label: NICHE_LABEL[n] }) as FilterOption<CanonicalNiche>,
    ),
  },
  {
    label: 'TradePay',
    options: NICHES_BY_BRAND.tradepay.map(
      (n) => ({ value: n, label: NICHE_LABEL[n] }) as FilterOption<CanonicalNiche>,
    ),
  },
  {
    label: 'CoachPay',
    options: NICHES_BY_BRAND.coachpay.map(
      (n) => ({ value: n, label: NICHE_LABEL[n] }) as FilterOption<CanonicalNiche>,
    ),
  },
];

const STATUS_FILTER_OPTIONS: FilterOption<PartnerStatus>[] = PARTNER_STATUSES.map((s) => ({
  value: s,
  label: PARTNER_STATUS_LABEL[s],
}));

const brandTone: Record<ProductBrand, StatusTone> = {
  MedPay: 'info',
  TradePay: 'accent',
  CoachPay: 'success',
  'Multi-brand': 'neutral',
};

/* Hydrate the master roster into local state shape. */
function seed(): LocalPartner[] {
  return MASTER_PARTNERS.map((p) => ({
    ...p,
    uiStatus: (p.status === 'approved'
      ? 'Approved'
      : p.status === 'pending'
        ? 'Pending'
        : 'Suspended') as LocalPartner['uiStatus'],
  }));
}

export default function ControlPanelPage() {
  const [rows, setRows] = useState<LocalPartner[]>(seed);
  const [search, setSearch] = useState('');
  /* Canonical niche from `@eazepay/shared-types` (Builder P). Local fixture
   * rows use a smaller `Niche` union ('coaching' / 'trades' / 'consumer'
   * mixed with 'medical' / 'dental'); the canonical taxonomy narrows that to
   * a brand-scoped set (`medical | dental | wellness | veterinary | hvac …`).
   * The dropdown drives the filter against the fixture `p.niche` field —
   * matches happen on the overlap ('medical', 'dental'). 'consumer' is
   * dropped per the spec. */
  const [niche, setNiche] = useState<CanonicalNiche | null>(null);
  const [status, setStatus] = useState<PartnerStatus | null>(null);
  const [sortSeed, setSortSeed] = useState(0);
  const [openKebab, setOpenKebab] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* Sprint H: URL-driven time range. The roster itself doesn't filter by
   * window today (the fixture is timeless), but the selector ships for
   * cross-dashboard consistency and to carry the window across drill-ins
   * into the per-partner detail page. */
  const sp = useSearchParams();
  const router = useRouter();
  const rangeFromUrl = (sp?.get('range') as TimeRange | null) ?? null;
  const range: TimeRange =
    rangeFromUrl && (TIME_RANGES as readonly string[]).includes(rangeFromUrl)
      ? rangeFromUrl
      : '30d';
  const handleRangeChange = useCallback(
    (next: TimeRange) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('range', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, sp],
  );

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  /* Filtered + sorted list. */
  const filtered = useMemo(() => {
    let list = rows.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.legalName.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q))
          return false;
      }
      if (niche && p.niche !== niche) return false;
      if (status) {
        // Normalize the fixture row's legacy uiStatus ('Approved' / 'Pending'
        // / 'Suspended') into canonical PartnerStatus before comparing.
        const canonical = normalizePartnerStatus(p.uiStatus);
        if (canonical !== status) return false;
      }
      return true;
    });
    if (sortSeed > 0) {
      // Deterministic shuffle for the "Refresh" button — keeps results stable per click.
      list = [...list].sort((a, b) => {
        const ha = (a.id + sortSeed).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const hb = (b.id + sortSeed).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        return ha - hb;
      });
    } else {
      // Default sort: most-recently-approved first. Pending rows
      // (approvedOn undefined) sink to the bottom so the active
      // roster is what operators see on landing. ISO YYYY-MM-DD
      // strings compare lexicographically === chronologically.
      list = [...list].sort((a, b) => {
        const ad = a.approvedOn ?? '';
        const bd = b.approvedOn ?? '';
        return ad < bd ? 1 : ad > bd ? -1 : 0;
      });
    }
    return list;
  }, [rows, search, niche, status, sortSeed]);

  /* Stats. */
  const stats = useMemo(() => {
    const active = rows.filter((p) => p.uiStatus === 'Approved').length;
    const suspended = rows.filter((p) => p.uiStatus === 'Suspended').length;
    const totalFunded = rows.reduce((s, p) => s + p.netCents, 0);
    return { total: rows.length, active, suspended, totalFunded };
  }, [rows]);

  function toggleStatus(id: string, next: LocalPartner['uiStatus']) {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, uiStatus: next } : p)));
    setOpenKebab(null);
    flash(
      `Partner ${next === 'Approved' ? 'reactivated' : next === 'Suspended' ? 'suspended' : 'moved to pending'}`,
    );
  }

  function addPartner(p: Omit<LocalPartner, 'fundedCount' | 'netCents' | 'approvedOn' | 'status'>) {
    setRows((prev) => [
      {
        ...p,
        fundedCount: 0,
        netCents: 0,
        approvedOn: new Date().toISOString().slice(0, 10),
        status: 'approved' as ApprovalStatus,
      },
      ...prev,
    ]);
    setShowAdd(false);
    flash(`Partner "${p.legalName}" added`);
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }, { label: 'Control Panel' }]}
        title="Control Panel"
        description="Full partner management — profiles, applications, payouts, users, and lender access"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <LiveIndicator pulseKey={sortSeed} />
            <TimeRangeSelector value={range} onChange={handleRangeChange} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSortSeed((s) => s + 1);
                flash('Refreshed');
              }}
            >
              Refresh
            </Button>
            <Button size="sm" variant="primary" onClick={() => setShowAdd(true)}>
              + Add Partner
            </Button>
          </div>
        }
      />
      <PageBody>
        {/* Stats bar — each tile drills into the roster pre-filtered by
            the matching status query. The time-range selector above
            carries forward via `?range=`. */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatTile
            label="Total partners"
            value={String(stats.total)}
            hint="across all brands"
            href={`?range=${range}`}
          />
          <StatTile
            label="Active"
            value={String(stats.active)}
            hint="approved & live"
            tone="success"
            href={`?status=active&range=${range}`}
          />
          <StatTile
            label="Suspended"
            value={String(stats.suspended)}
            hint="blocked from intake"
            tone={stats.suspended > 0 ? 'danger' : 'neutral'}
            href={`?status=suspended&range=${range}`}
          />
          <StatTile
            label="Funded volume"
            value={<Money cents={stats.totalFunded} compact />}
            hint="all-time net"
            href={`?range=${range}`}
          />
        </div>

        {/* Filter bar */}
        <div
          className="flex flex-wrap items-stretch gap-2 mb-3"
          role="search"
          aria-label="Filter partners"
        >
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[220px] sm:min-w-[260px] max-w-md focus-within:border-border-strong focus-within:ring-2 focus-within:ring-border-focus/30">
            <SearchIcon size={14} className="text-fg-muted" aria-hidden />
            <span className="sr-only">Search partners</span>
            <input
              placeholder="Search by partner name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search partners by name or email"
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="inline-flex items-center justify-center h-7 w-7 -mr-1.5 rounded text-fg-muted hover:text-fg hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <XIcon size={12} />
              </button>
            )}
          </label>
          <Filter<CanonicalNiche>
            label="Niche"
            value={niche}
            onChange={setNiche}
            options={NICHE_FILTER_GROUPS}
            allLabel="All niches"
          />
          <Filter<PartnerStatus>
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            allLabel="All statuses"
          />
        </div>

        <p className="text-[12px] text-fg-muted mb-3" role="status" aria-live="polite">
          {pluralize(filtered.length, 'partner')} found
          {(search || niche || status) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setNiche(null);
                setStatus(null);
              }}
              className="ml-2 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
            >
              Clear filters
            </button>
          )}
        </p>

        <Card>
          <CardBody className="p-0">
            {filtered.length === 0 ? (
              <div role="status" className="py-10 px-5 text-center text-[13px] text-fg-muted">
                No partners match the current filters.{' '}
                {(search || niche || status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setNiche(null);
                      setStatus(null);
                    }}
                    className="ml-1 text-accent font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border" aria-label={`${filtered.length} partners`}>
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className="relative grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-3 px-4 sm:px-5 py-3.5 hover:bg-bg-muted/30"
                  >
                    <Link
                      href={`/control-panel/${p.id}`}
                      className="md:col-span-5 flex items-center gap-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-md"
                    >
                      <span
                        className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0"
                        aria-hidden
                      >
                        {p.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">
                          {p.legalName}
                        </p>
                        <p className="text-[11px] text-fg-muted truncate">
                          {p.email} {p.phone && <span>· {p.phone}</span>}
                        </p>
                      </div>
                    </Link>
                    <div className="md:col-span-1 flex md:block items-center gap-2">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                        Brand
                      </span>
                      <StatusPill tone={brandTone[p.product]}>{p.product}</StatusPill>
                    </div>
                    <div className="md:col-span-1 text-[12px] text-fg-secondary capitalize flex md:block items-center gap-2">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                        Niche
                      </span>
                      {nicheLabel[p.niche]}
                    </div>
                    <div className="md:col-span-2 flex md:block items-baseline gap-2 md:gap-0 md:text-right">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                        Funded
                      </span>
                      <p className="text-[12px] font-semibold text-fg tabular-nums">
                        <Money cents={p.netCents} compact />
                      </p>
                      <p className="text-[10px] text-fg-muted tabular-nums md:mt-0 ml-2 md:ml-0">
                        {p.fundedCount} funded
                      </p>
                    </div>
                    <div className="md:col-span-1 flex md:block items-center gap-2">
                      <span className="md:hidden text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                        Status
                      </span>
                      <StatusPill tone={statusTone[p.uiStatus]} dot>
                        {p.uiStatus}
                      </StatusPill>
                    </div>
                    <div className="md:col-span-2 flex items-center md:justify-end gap-1.5 mt-1 md:mt-0">
                      <Link
                        href={`/control-panel/${p.id}`}
                        className="inline-flex items-center justify-center gap-1.5 h-9 min-w-[44px] rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                      >
                        Open <ArrowRightIcon size={11} />
                      </Link>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label={`Quick actions for ${p.legalName}`}
                          aria-haspopup="menu"
                          aria-expanded={openKebab === p.id}
                          onClick={() => setOpenKebab((k) => (k === p.id ? null : p.id))}
                          className="h-9 w-11 rounded-md border border-border bg-bg-elevated text-fg-secondary hover:bg-bg-muted inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <circle cx="5" cy="12" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="19" cy="12" r="1.6" />
                          </svg>
                        </button>
                        {openKebab === p.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-20"
                              aria-label="Close menu"
                              onClick={() => setOpenKebab(null)}
                            />
                            <div
                              role="menu"
                              aria-label={`Actions for ${p.legalName}`}
                              className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-border bg-bg-elevated shadow-lg py-1 text-[12px]"
                            >
                              {p.uiStatus !== 'Suspended' && (
                                <KebabItem
                                  onClick={() => toggleStatus(p.id, 'Suspended')}
                                  icon={<AlertIcon size={12} />}
                                  danger
                                >
                                  Suspend
                                </KebabItem>
                              )}
                              {p.uiStatus === 'Suspended' && (
                                <KebabItem
                                  onClick={() => toggleStatus(p.id, 'Approved')}
                                  icon={<CheckIcon size={12} />}
                                >
                                  Reactivate
                                </KebabItem>
                              )}
                              <KebabLink
                                href={`/applications/${p.id}`}
                                icon={<ExternalIcon size={12} />}
                              >
                                View applications
                              </KebabLink>
                              <KebabLink
                                href={`/payouts/${p.id}`}
                                icon={<ExternalIcon size={12} />}
                              >
                                View payouts
                              </KebabLink>
                              <KebabLink
                                href="/lender-marketplace/access"
                                icon={<ExternalIcon size={12} />}
                              >
                                Lender access
                              </KebabLink>
                              <div className="border-t border-border my-1" role="separator" />
                              <KebabLink
                                href={`/control-panel/${p.id}`}
                                icon={<ArrowRightIcon size={12} />}
                              >
                                Open detail page
                              </KebabLink>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </PageBody>

      {showAdd && <AddPartnerModal onClose={() => setShowAdd(false)} onAdd={addPartner} />}
      {toast && <Toast message={toast} />}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Sub-components                                                          */
/* ----------------------------------------------------------------------- */

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatusTone;
  /** Optional drill-in URL — when provided the tile becomes a Link. */
  href?: string;
}) {
  const accent =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-fg';
  const body = (
    <>
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tracking-tight leading-none ${accent}`}>
        {value}
      </p>
      {hint && <p className="text-[10px] text-fg-muted mt-1.5">{hint}</p>}
    </>
  );
  const base = 'block rounded-xl border border-border bg-bg-elevated px-4 py-3';
  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label}. Filter list.`}
        className={`${base} transition-colors hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

function KebabItem({
  onClick,
  children,
  icon,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-bg-muted ${danger ? 'text-danger hover:bg-danger/5' : 'text-fg-secondary hover:bg-bg-muted hover:text-fg'}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}

function KebabLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="w-full text-left px-3 py-2 flex items-center gap-2 text-fg-secondary hover:bg-bg-muted hover:text-fg focus-visible:outline-none focus-visible:bg-bg-muted"
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

function AddPartnerModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (p: Omit<LocalPartner, 'fundedCount' | 'netCents' | 'approvedOn' | 'status'>) => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [niche, setNiche] = useState<Niche>('medical');
  const [product, setProduct] = useState<ProductBrand>('MedPay');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const initials = legalName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
      const id =
        'p_' +
        (legalName
          .toLowerCase()
          .replace(/[^a-z]/g, '')
          .slice(0, 8) || Date.now().toString(36));
      onAdd({
        id,
        initials: initials || 'NP',
        legalName,
        email,
        phone: phone || undefined,
        niche,
        product,
        uiStatus: 'Approved',
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create partner.');
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add Partner" size="sm">
      <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
        {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}
        <Field label="Legal name" value={legalName} onChange={setLegalName} required />
        <Field label="Contact email" value={email} onChange={setEmail} type="email" required />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-fg-secondary">
            Niche
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value as Niche)}
              aria-label="Niche"
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
            >
              <option value="medical">Medical</option>
              <option value="trades">Trades</option>
              <option value="coaching">Coaching</option>
              <option value="dental">Dental</option>
              <option value="consumer">Consumer</option>
            </select>
          </label>
          <label className="block text-[12px] font-medium text-fg-secondary">
            Initial brand
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductBrand)}
              aria-label="Initial brand"
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
            >
              <option value="MedPay">MedPay</option>
              <option value="TradePay">TradePay</option>
              <option value="CoachPay">CoachPay</option>
              <option value="Multi-brand">Multi-brand</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button size="sm" variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!legalName || !email || submitting}
          >
            {submitting ? 'Creating…' : 'Create partner'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-[12px] font-medium text-fg-secondary">
      <span>
        {label}
        {required && (
          <>
            <span className="text-danger ml-0.5" aria-hidden>
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required}
        className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
      />
    </label>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2"
    >
      <CheckIcon size={14} aria-hidden />
      {message}
    </div>
  );
}
