'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button as _Button,
  StatusPill,
  Money,
  ArrowRightIcon,
  SearchIcon,
  ExternalIcon,
  XIcon,
  CheckIcon,
  AlertIcon,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
} from '@eazepay/ui/web';

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
import { partners as MASTER_PARTNERS, type PartnerSummary, type Niche, type ProductBrand, type ApprovalStatus } from '../../lib/master-data';

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
    uiStatus: ((p.status === 'approved' ? 'Approved' : p.status === 'pending' ? 'Pending' : 'Suspended') as LocalPartner['uiStatus']),
  }));
}

export default function ControlPanelPage() {
  const [rows, setRows] = useState<LocalPartner[]>(seed);
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState<Niche | ''>('');
  const [status, setStatus] = useState<LocalPartner['uiStatus'] | ''>('');
  const [sortSeed, setSortSeed] = useState(0);
  const [openKebab, setOpenKebab] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  /* Filtered + sorted list. */
  const filtered = useMemo(() => {
    let list = rows.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.legalName.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      }
      if (niche && p.niche !== niche) return false;
      if (status && p.uiStatus !== status) return false;
      return true;
    });
    if (sortSeed > 0) {
      // Deterministic shuffle for the "Refresh" button — keeps results stable per click.
      list = [...list].sort((a, b) => {
        const ha = (a.id + sortSeed).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const hb = (b.id + sortSeed).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        return ha - hb;
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
    flash(`Partner ${next === 'Approved' ? 'reactivated' : next === 'Suspended' ? 'suspended' : 'moved to pending'}`);
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
          <div className="flex items-center gap-2">
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
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatTile label="Total partners" value={String(stats.total)} hint="across all brands" />
          <StatTile label="Active" value={String(stats.active)} hint="approved & live" tone="success" />
          <StatTile label="Suspended" value={String(stats.suspended)} hint="blocked from intake" tone={stats.suspended > 0 ? 'danger' : 'neutral'} />
          <StatTile label="Funded volume" value={<Money cents={stats.totalFunded} compact />} hint="all-time net" />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search by partner name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-fg-muted hover:text-fg">
                <XIcon size={12} />
              </button>
            )}
          </div>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value as Niche | '')}
            className="h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg outline-none"
          >
            <option value="">All niches</option>
            <option value="medical">Medical</option>
            <option value="trades">Trades</option>
            <option value="coaching">Coaching</option>
            <option value="dental">Dental</option>
            <option value="consumer">Consumer</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LocalPartner['uiStatus'] | '')}
            className="h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg outline-none"
          >
            <option value="">All statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        <p className="text-[12px] text-fg-muted mb-3">
          {filtered.length} partner{filtered.length === 1 ? '' : 's'} found
          {(search || niche || status) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setNiche('');
                setStatus('');
              }}
              className="ml-2 text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </p>

        <Card>
          <CardBody className="p-0">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-fg-muted">
                No partners match the current filters.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <li key={p.id} className="relative grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-bg-muted/30">
                    <Link
                      href={`/control-panel/${p.id}`}
                      className="col-span-5 flex items-center gap-3 min-w-0 group"
                    >
                      <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                        {p.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-fg truncate group-hover:underline">{p.legalName}</p>
                        <p className="text-[11px] text-fg-muted truncate">{p.email} {p.phone && <span>· {p.phone}</span>}</p>
                      </div>
                    </Link>
                    <div className="col-span-1">
                      <StatusPill tone={brandTone[p.product]}>{p.product}</StatusPill>
                    </div>
                    <div className="col-span-1 text-[12px] text-fg-secondary capitalize">{nicheLabel[p.niche]}</div>
                    <div className="col-span-2 text-right">
                      <p className="text-[12px] font-semibold text-fg tabular-nums">
                        <Money cents={p.netCents} compact />
                      </p>
                      <p className="text-[10px] text-fg-muted tabular-nums">{p.fundedCount} funded</p>
                    </div>
                    <div className="col-span-1">
                      <StatusPill tone={statusTone[p.uiStatus]} dot>{p.uiStatus}</StatusPill>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <Link
                        href={`/control-panel/${p.id}`}
                        className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-border bg-bg-elevated text-[11px] font-medium text-fg-secondary hover:bg-bg-muted px-2.5"
                      >
                        Open <ArrowRightIcon size={11} />
                      </Link>
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Quick actions"
                          onClick={() => setOpenKebab((k) => (k === p.id ? null : p.id))}
                          className="h-8 w-8 rounded-md border border-border bg-bg-elevated text-fg-secondary hover:bg-bg-muted inline-flex items-center justify-center"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
                            <div className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-border bg-bg-elevated shadow-lg py-1 text-[12px]">
                              {p.uiStatus !== 'Suspended' && (
                                <KebabItem onClick={() => toggleStatus(p.id, 'Suspended')} icon={<AlertIcon size={12} />} danger>
                                  Suspend
                                </KebabItem>
                              )}
                              {p.uiStatus === 'Suspended' && (
                                <KebabItem onClick={() => toggleStatus(p.id, 'Approved')} icon={<CheckIcon size={12} />}>
                                  Reactivate
                                </KebabItem>
                              )}
                              <KebabLink href={`/applications/${p.id}`} icon={<ExternalIcon size={12} />}>
                                View applications
                              </KebabLink>
                              <KebabLink href={`/payouts/${p.id}`} icon={<ExternalIcon size={12} />}>
                                View payouts
                              </KebabLink>
                              <KebabLink href="/lender-marketplace/access" icon={<ExternalIcon size={12} />}>
                                Lender access
                              </KebabLink>
                              <div className="border-t border-border my-1" />
                              <KebabLink href={`/control-panel/${p.id}`} icon={<ArrowRightIcon size={12} />}>
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
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatusTone;
}) {
  const accent =
    tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className={`mt-1.5 text-[22px] font-bold tracking-tight leading-none ${accent}`}>{value}</p>
      {hint && <p className="text-[10px] text-fg-muted mt-1.5">{hint}</p>}
    </div>
  );
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
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 ${danger ? 'text-danger hover:bg-danger/5' : 'text-fg-secondary hover:bg-bg-muted hover:text-fg'}`}
    >
      {icon}
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
    <Link href={href} className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-fg-secondary hover:bg-bg-muted hover:text-fg">
      {icon}
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const initials = legalName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
    const id = 'p_' + (legalName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || Date.now().toString(36));
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
  }

  return (
    <ModalShell title="Add Partner" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Legal name" value={legalName} onChange={setLegalName} required />
        <Field label="Contact email" value={email} onChange={setEmail} type="email" required />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] font-medium text-fg-secondary">
            Niche
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value as Niche)}
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
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
              className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
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
          <Button size="sm" variant="primary" type="submit" disabled={!legalName || !email}>
            Create partner
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div className={`relative w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'} rounded-xl border border-border bg-bg-elevated shadow-xl`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
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
      {label}
      {required && <span className="text-danger ml-0.5">*</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus:border-border-strong"
      />
    </label>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg flex items-center gap-2">
      <CheckIcon size={14} />
      {message}
    </div>
  );
}
