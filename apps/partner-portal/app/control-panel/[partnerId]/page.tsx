'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  Button as _Button,
  StatusPill,
  Money,
  Tabs,
  ArrowRightIcon,
  CheckIcon,
  XIcon,
  AlertIcon,
  ExternalIcon,
  ClockIcon,
  PhoneIcon,
  SendIcon,
  ShieldIcon,
  Skeleton,
  type ButtonVariant,
  type ButtonSize,
  type StatusTone,
} from '@eazepay/ui/web';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { Modal, ErrorBanner } from '../../../components/a11y';

/* Locally-typed Button wrapper to sidestep the codebase-wide
 * upstream-Button JSX-children inference issue. */
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
  type ProductBrand,
  type Niche,
  applications as MASTER_APPS,
} from '../../../lib/master-data';
import {
  marketplaces,
  marketplaceLenders,
  partnerAccessOverrides,
  isLenderEnabledForPartner,
} from '../../../lib/marketplace-data';

/**
 * Partner detail — Master operator's single-pane control surface for one
 * partner. Seven tabs (Overview, Users & Roles, Applications, Payouts,
 * Lender Access, Activity, Settings) — all editable with optimistic
 * React state. Backend wiring lands later.
 */

type TabKey =
  | 'overview'
  | 'users'
  | 'applications'
  | 'billing'
  | 'lender'
  | 'activity'
  | 'settings';

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'applications', label: 'Applications' },
  { key: 'billing', label: 'Billing' },
  { key: 'lender', label: 'Lender Access' },
  { key: 'activity', label: 'Activity' },
  { key: 'settings', label: 'Settings' },
];

/* ----------------------------------------------------------------------- */
/*  Deterministic per-partner seed data                                     */
/* ----------------------------------------------------------------------- */

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function rand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Operator' | 'Viewer';
  lastLoginAt: string;
}

function seedUsers(partnerId: string, partnerEmail: string): UserRow[] {
  const r = rand(hashStr(partnerId));
  const firsts = [
    'Alex',
    'Morgan',
    'Casey',
    'Jordan',
    'Riley',
    'Taylor',
    'Sam',
    'Drew',
    'Quinn',
    'Hayden',
  ];
  const lasts = [
    'Reed',
    'Park',
    'Singh',
    'Walsh',
    'Lopez',
    'Chen',
    'Khan',
    'Cole',
    'Hart',
    'Brooks',
  ];
  const owner: UserRow = {
    id: 'u_owner',
    name: 'Operator (Owner)',
    email: partnerEmail,
    role: 'Owner',
    lastLoginAt: '2026-05-14T09:12:00Z',
  };
  const extras = Math.floor(r() * 3) + 2;
  const users: UserRow[] = [owner];
  for (let i = 0; i < extras; i++) {
    const f = firsts[Math.floor(r() * firsts.length)] ?? 'Alex';
    const l = lasts[Math.floor(r() * lasts.length)] ?? 'Reed';
    const role: UserRow['role'] =
      (['Admin', 'Operator', 'Viewer', 'Operator'] as const)[Math.floor(r() * 4)] ?? 'Operator';
    users.push({
      id: `u_${partnerId}_${i}`,
      name: `${f} ${l}`,
      email: `${f.toLowerCase()}.${l.toLowerCase()}@${partnerEmail.split('@')[1] ?? 'example.com'}`,
      role,
      lastLoginAt: new Date(Date.now() - Math.floor(r() * 1000 * 60 * 60 * 24 * 30)).toISOString(),
    });
  }
  return users;
}

interface ActivityEvent {
  ts: string;
  kind: 'status' | 'user' | 'lender' | 'application' | 'payout' | 'note' | 'login';
  text: string;
  actor: string;
}

function seedActivity(partnerId: string): ActivityEvent[] {
  const r = rand(hashStr(partnerId + 'activity'));
  const out: ActivityEvent[] = [];
  const templates: Array<Omit<ActivityEvent, 'ts'>> = [
    {
      kind: 'status',
      text: 'Partner status changed: Pending → Approved',
      actor: 'brodie@amalafinance.com.au',
    },
    { kind: 'user', text: 'Invited new user as Operator', actor: 'brodie@amalafinance.com.au' },
    {
      kind: 'lender',
      text: 'Lender override added: SageHeal disabled — compliance review',
      actor: 'risk@eaze.internal',
    },
    { kind: 'application', text: 'New application submitted — TradePay $19,500', actor: 'system' },
    { kind: 'payout', text: 'Payout settled — $4,820.00 net', actor: 'system' },
    {
      kind: 'note',
      text: 'Quarterly review note added by operator',
      actor: 'brodie@amalafinance.com.au',
    },
    {
      kind: 'login',
      text: 'User signed in from 73.2.18.4 (San Francisco)',
      actor: 'sarah.park@partner.com',
    },
    {
      kind: 'application',
      text: 'Application a_004 transitioned: submitted → in_review',
      actor: 'system',
    },
    { kind: 'lender', text: 'Marketplace sync completed — 36 lenders refreshed', actor: 'system' },
    {
      kind: 'status',
      text: 'Brand assignment changed: MedPay → Multi-brand',
      actor: 'brodie@amalafinance.com.au',
    },
    { kind: 'user', text: 'Role changed: Operator → Admin', actor: 'brodie@amalafinance.com.au' },
    { kind: 'application', text: 'Application a_007 funded — $39,600', actor: 'system' },
    { kind: 'note', text: 'KYB re-verified, expires 2027-01', actor: 'compliance@eaze.internal' },
    { kind: 'payout', text: 'Payout scheduled for T+1 (2026-05-16)', actor: 'system' },
    {
      kind: 'lender',
      text: 'Kestrel Trade Finance toggled OFF for this partner',
      actor: 'brodie@amalafinance.com.au',
    },
    {
      kind: 'login',
      text: 'Master operator viewed sensitive PII field (audited)',
      actor: 'brodie@amalafinance.com.au',
    },
    { kind: 'application', text: 'Application declined — DTI > 50%', actor: 'system' },
    {
      kind: 'status',
      text: 'Commission rate adjusted: 1.4% → 1.6%',
      actor: 'brodie@amalafinance.com.au',
    },
    { kind: 'user', text: 'Removed user (Operator)', actor: 'brodie@amalafinance.com.au' },
    { kind: 'note', text: 'AAN delivery confirmed for declined applicant', actor: 'system' },
  ];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const tpl = templates[Math.floor(r() * templates.length)] ?? templates[0]!;
    out.push({
      ...tpl,
      ts: new Date(
        now - i * 1000 * 60 * 60 * Math.ceil(r() * 18) - Math.floor(r() * 1000 * 60 * 60 * 6),
      ).toISOString(),
    });
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

interface ApplicationStub {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: 'submitted' | 'approved' | 'funded' | 'declined' | 'in_review';
  date: string;
}
function seedApplications(partnerId: string, partnerName: string): ApplicationStub[] {
  // Pull from canonical master apps where the partner column matches; if none, synthesize.
  const real = MASTER_APPS.filter((a) =>
    a.partner.toLowerCase().includes(partnerName.split(' ')[0]!.toLowerCase()),
  )
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      customer: a.customer,
      product: a.product,
      amount: a.amountCents,
      status: a.status,
      date: a.date,
    }));
  if (real.length >= 3) return real;
  const r = rand(hashStr(partnerId + 'apps'));
  const customers = [
    'Cassidy Wren',
    'Tomas Ibarra',
    'Priya Anand',
    'Markus Hale',
    'Avery Cho',
    'Rosa Delgado',
  ];
  const products: ApplicationStub['product'][] = ['med-pay', 'trade-pay', 'coach-pay'];
  const statuses: ApplicationStub['status'][] = [
    'submitted',
    'approved',
    'funded',
    'declined',
    'in_review',
  ];
  return Array.from({ length: 5 }, (_, i) => ({
    id: 'a_synth_' + i,
    customer: customers[Math.floor(r() * customers.length)] ?? 'Anonymous',
    product: products[Math.floor(r() * products.length)] ?? 'med-pay',
    amount: Math.floor(r() * 50000) * 100 + 500_000,
    status: statuses[Math.floor(r() * statuses.length)] ?? 'submitted',
    date: new Date(Date.now() - i * 86400000 * 3).toISOString().slice(0, 10),
  }));
}

interface PayoutStub {
  id: string;
  date: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  status: 'pending' | 'settled' | 'paid';
}
function seedPayouts(partnerId: string): PayoutStub[] {
  const r = rand(hashStr(partnerId + 'payouts'));
  return Array.from({ length: 5 }, (_, i) => {
    const gross = Math.floor(r() * 200000) * 100 + 200_000;
    const fee = Math.floor(gross * 0.022);
    return {
      id: 'po_' + partnerId.slice(2) + '_' + i,
      date: new Date(Date.now() - i * 86400000 * 7).toISOString().slice(0, 10),
      grossCents: gross,
      feeCents: fee,
      netCents: gross - fee,
      status: (['paid', 'settled', 'pending'] as const)[Math.min(i, 2)] ?? 'pending',
    };
  });
}

const brandTone: Record<ProductBrand, StatusTone> = {
  MedPay: 'info',
  TradePay: 'accent',
  CoachPay: 'success',
  'Multi-brand': 'neutral',
};

/* ----------------------------------------------------------------------- */
/*  Page                                                                    */
/* ----------------------------------------------------------------------- */

// Synthetic placeholder used to keep the useState initializer total
// when no partner matches the route. The component short-circuits to
// notFound() immediately after the hooks block, so this seed never
// reaches the rendered surface.
const PLACEHOLDER_PARTNER = {
  id: '',
  legalName: '',
  email: 'placeholder@example.com',
  phone: '',
  niche: '',
  product: 'MedPay' as ProductBrand,
};

export default function PartnerDetailPage() {
  const params = useParams<{ partnerId: string }>();
  const partnerId = params?.partnerId;
  const base = MASTER_PARTNERS.find((p) => p.id === partnerId);

  // Hooks must run unconditionally to keep the call order stable across
  // renders. We use a synthetic placeholder when the partner row isn't
  // found and short-circuit to `notFound()` below the hooks block.
  const safeBase = base ?? PLACEHOLDER_PARTNER;

  const [tab, setTab] = useState<TabKey>('overview');
  const [toast, setToast] = useState<string | null>(null);
  const [partner, setPartner] = useState(() => ({
    legalName: safeBase.legalName,
    contactName: 'Operator (Owner)',
    email: safeBase.email,
    phone: safeBase.phone ?? '',
    website: 'https://' + safeBase.email.split('@')[1],
    addressLine: '500 Market St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94104',
    ein: '00-' + (1000000 + (hashStr(safeBase.id) % 8999999)),
    structure: 'LLC',
    yearFounded: 2018 + (hashStr(safeBase.id) % 6),
    monthlyRevenueRange: '$100K – $500K',
    niche: safeBase.niche,
    status: 'Approved' as 'Approved' | 'Pending' | 'Suspended',
    brand: safeBase.product,
    commissionPct: 1.6,
    payoutSchedule: 'T+1' as 'T+1' | 'T+2' | 'Weekly',
    notes: '',
  }));

  if (!base) return notFound();

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const headerStatusTone: StatusTone =
    partner.status === 'Approved'
      ? 'success'
      : partner.status === 'Suspended'
        ? 'danger'
        : 'warning';

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master' },
          { label: 'Control Panel', href: '/control-panel' },
          { label: partner.legalName },
        ]}
        title={
          <span className="inline-flex items-center gap-3">
            <span className="size-9 rounded-full bg-bg-muted text-fg-secondary inline-flex items-center justify-center font-bold text-[13px]">
              {base.initials}
            </span>
            {partner.legalName}
            <StatusPill tone={headerStatusTone} dot>
              {partner.status}
            </StatusPill>
            <StatusPill tone={brandTone[partner.brand]}>{partner.brand}</StatusPill>
          </span>
        }
        description={`${partner.email} · ${partner.phone || 'no phone on file'} · partner id ${base.id}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {partner.status !== 'Suspended' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPartner((p) => ({ ...p, status: 'Suspended' }));
                  flash('Partner suspended');
                }}
              >
                <AlertIcon size={12} aria-hidden /> Suspend
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPartner((p) => ({ ...p, status: 'Approved' }));
                  flash('Partner reactivated');
                }}
              >
                <CheckIcon size={12} aria-hidden /> Reactivate
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => flash('Impersonation token issued (audited)')}
            >
              <ShieldIcon size={12} aria-hidden /> View as partner
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => flash(`Email drafted to ${partner.email}`)}
            >
              <SendIcon size={12} aria-hidden /> Email
            </Button>
            {partner.phone && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => flash(`Calling ${partner.phone}`)}
              >
                <PhoneIcon size={12} aria-hidden /> Phone
              </Button>
            )}
          </div>
        }
      />

      <div className="px-4 sm:px-7">
        <Tabs
          label="Partner sections"
          items={TAB_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
          active={tab}
          onChange={(k: string) => setTab(k as TabKey)}
        />
      </div>

      <PageBody>
        <div role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && (
            <OverviewTab partner={partner} setPartner={setPartner} flash={flash} />
          )}
          {tab === 'users' && <UsersTab partnerId={base.id} email={base.email} flash={flash} />}
          {tab === 'applications' && (
            <ApplicationsTab partnerId={base.id} partnerName={base.legalName} />
          )}
          {tab === 'billing' && (
            <BillingTab
              partnerId={base.id}
              partnerName={base.legalName}
              partnerEmail={base.email}
              flash={flash}
            />
          )}
          {tab === 'lender' && <LenderAccessTab partnerId={base.id} flash={flash} />}
          {tab === 'activity' && <ActivityTab partnerId={base.id} />}
          {tab === 'settings' && (
            <SettingsTab
              partner={partner}
              setPartner={setPartner}
              partnerId={base.id}
              flash={flash}
            />
          )}
        </div>
      </PageBody>

      {toast && <Toast message={toast} />}
    </>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Overview                                                           */
/* ----------------------------------------------------------------------- */

function OverviewTab({
  partner,
  setPartner,
  flash,
}: {
  partner: ReturnType<typeof useState<any>>[0];
  setPartner: ReturnType<typeof useState<any>>[1];
  flash: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(partner);

  function startEdit() {
    setDraft(partner);
    setEditing(true);
  }
  function save() {
    setPartner(draft);
    setEditing(false);
    flash('Partner profile saved');
  }
  function cancel() {
    setDraft(partner);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader
        title="Partner profile"
        description="Master record. Updates here propagate to KYB, payouts, and partner-facing portal."
        action={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={save}>
                Save changes
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              Edit
            </Button>
          )
        }
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <ProfileField
            label="Legal name"
            value={draft.legalName}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, legalName: v })}
          />
          <ProfileField
            label="Contact name"
            value={draft.contactName}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, contactName: v })}
          />
          <ProfileField
            label="Email"
            value={draft.email}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, email: v })}
          />
          <ProfileField
            label="Phone"
            value={draft.phone}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, phone: v })}
          />
          <ProfileField
            label="Website"
            value={draft.website}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, website: v })}
          />
          <ProfileField
            label="EIN"
            value={draft.ein}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, ein: v })}
          />
          <ProfileField
            label="Address"
            value={draft.addressLine}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, addressLine: v })}
          />
          <div className="grid grid-cols-3 gap-3">
            <ProfileField
              label="City"
              value={draft.city}
              editing={editing}
              onChange={(v) => setDraft({ ...draft, city: v })}
            />
            <ProfileField
              label="State"
              value={draft.state}
              editing={editing}
              onChange={(v) => setDraft({ ...draft, state: v })}
            />
            <ProfileField
              label="ZIP"
              value={draft.zip}
              editing={editing}
              onChange={(v) => setDraft({ ...draft, zip: v })}
            />
          </div>
          <ProfileField
            label="Business structure"
            value={draft.structure}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, structure: v })}
            options={['LLC', 'C-Corp', 'S-Corp', 'Sole Proprietor', 'Partnership']}
          />
          <ProfileField
            label="Year founded"
            value={String(draft.yearFounded)}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, yearFounded: Number(v) || draft.yearFounded })}
          />
          <ProfileField
            label="Monthly revenue range"
            value={draft.monthlyRevenueRange}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, monthlyRevenueRange: v })}
            options={[
              '< $10K',
              '$10K – $50K',
              '$50K – $100K',
              '$100K – $500K',
              '$500K – $1M',
              '$1M+',
            ]}
          />
          <ProfileField
            label="Niche"
            value={draft.niche}
            editing={editing}
            onChange={(v) => setDraft({ ...draft, niche: v as Niche })}
            options={['medical', 'trades', 'coaching', 'dental', 'consumer']}
          />
        </div>
      </CardBody>
    </Card>
  );
}

function ProfileField({
  label,
  value,
  editing,
  onChange,
  options,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  options?: string[];
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">{label}</p>
      {editing ? (
        options ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus:border-border-strong"
          />
        )
      ) : (
        <p className="mt-1.5 text-[13px] text-fg font-medium">
          {value || <span className="text-fg-muted">—</span>}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Users & Roles                                                      */
/* ----------------------------------------------------------------------- */

function UsersTab({
  partnerId,
  email,
  flash,
}: {
  partnerId: string;
  email: string;
  flash: (m: string) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>(() => seedUsers(partnerId, email));
  const [showInvite, setShowInvite] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  function invite(u: { name: string; email: string; role: UserRow['role'] }) {
    setUsers((prev) => [
      ...prev,
      {
        id: 'u_new_' + Date.now().toString(36),
        ...u,
        lastLoginAt: '—',
      },
    ]);
    setShowInvite(false);
    flash(`User invited as ${u.role}`);
  }
  function changeRole(id: string, role: UserRow['role']) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    flash(`Role updated to ${role}`);
  }
  function confirmRemove() {
    if (!removeId) return;
    setUsers((prev) => prev.filter((u) => u.id !== removeId));
    setRemoveId(null);
    flash('User removed from partner');
  }

  return (
    <>
      <Card>
        <CardHeader
          title={`Team members (${users.length})`}
          description="Anyone with access to this partner's portal — Owners can add users; only Master can change Owners."
          action={
            <Button size="sm" variant="primary" onClick={() => setShowInvite(true)}>
              + Add User
            </Button>
          }
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto" role="region" aria-label="Team members" tabIndex={0}>
            <div className="min-w-[640px]">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
                <span className="col-span-4">Name</span>
                <span className="col-span-4">Email</span>
                <span className="col-span-2">Role</span>
                <span className="col-span-1">Last login</span>
                <span className="col-span-1 text-right">Actions</span>
              </div>
              <ul className="divide-y divide-border" aria-label={`${users.length} team members`}>
                {users.map((u) => (
                  <li key={u.id} className="grid grid-cols-12 items-center px-5 py-3 text-[12px]">
                    <div className="col-span-4 font-medium text-fg">{u.name}</div>
                    <div className="col-span-4 text-fg-secondary truncate">{u.email}</div>
                    <div className="col-span-2">
                      {u.role === 'Owner' ? (
                        <StatusPill tone="accent">Owner</StatusPill>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value as UserRow['role'])}
                          className="h-7 rounded-md border border-border bg-bg-elevated px-2 text-[11px] outline-none"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Operator">Operator</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      )}
                    </div>
                    <div className="col-span-1 text-[11px] text-fg-muted">
                      {formatRelative(u.lastLoginAt)}
                    </div>
                    <div className="col-span-1 text-right">
                      {u.role !== 'Owner' && (
                        <button
                          type="button"
                          onClick={() => setRemoveId(u.id)}
                          aria-label={`Remove ${u.name}`}
                          className="text-[11px] text-danger hover:underline min-h-[36px] inline-flex items-center px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} onAdd={invite} />}
      {removeId && (
        <Modal open onClose={() => setRemoveId(null)} size="sm" title="Remove user?">
          <p className="text-[13px] text-fg-secondary">
            This will revoke {users.find((u) => u.id === removeId)?.name}&apos;s access to this
            partner immediately. They will be signed out of any active sessions.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
            <Button size="sm" variant="secondary" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={confirmRemove}>
              Remove user
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function InviteUserModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (u: { name: string; email: string; role: UserRow['role'] }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRow['role']>('Operator');
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal open onClose={onClose} size="sm" title="Invite team member">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          setTimeout(() => {
            onAdd({ name, email, role });
            setSubmitting(false);
          }, 250);
        }}
        className="space-y-3"
        aria-busy={submitting}
      >
        <label className="block text-[12px] font-medium text-fg-secondary">
          <span>
            Full name
            <span className="sr-only"> (required)</span>
            <span className="text-danger ml-0.5" aria-hidden>
              *
            </span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-required="true"
            aria-label="Full name"
            className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
          />
        </label>
        <label className="block text-[12px] font-medium text-fg-secondary">
          <span>
            Email
            <span className="sr-only"> (required)</span>
            <span className="text-danger ml-0.5" aria-hidden>
              *
            </span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-required="true"
            aria-label="Email"
            className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
          />
        </label>
        <label className="block text-[12px] font-medium text-fg-secondary">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRow['role'])}
            aria-label="Role"
            className="mt-1.5 w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:border-border-strong"
          >
            <option value="Admin">Admin — manage users + settings</option>
            <option value="Operator">Operator — submit applications</option>
            <option value="Viewer">Viewer — read-only</option>
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button size="sm" variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!name || !email || submitting}
          >
            {submitting ? (
              <>
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                  aria-hidden
                />
                Sending…
              </>
            ) : (
              'Send invite'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Applications                                                       */
/* ----------------------------------------------------------------------- */

function ApplicationsTab({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const apps = useMemo(() => seedApplications(partnerId, partnerName), [partnerId, partnerName]);
  return (
    <Card>
      <CardHeader
        title="Recent applications"
        description={`Last ${pluralize(apps.length, 'application')} submitted by this partner.`}
        action={
          <Link
            href={`/applications/${partnerId}`}
            className="text-[12px] text-accent hover:underline inline-flex items-center gap-1"
          >
            View all <ArrowRightIcon size={11} />
          </Link>
        }
      />
      <CardBody className="p-0">
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Recent applications"
          tabIndex={0}
        >
          <div className="min-w-[640px]">
            <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-3">ID</span>
              <span className="col-span-3">Customer</span>
              <span className="col-span-2">Product</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>
            <ul className="divide-y divide-border" aria-label={`${apps.length} applications`}>
              {apps.map((a) => (
                <li key={a.id}>
                  {/* Sprint H: each row drills into the filtered list
                      scoped to this partner + the row's status. The
                      destination /applications page reads `partnerId` +
                      `status` to apply both filters. */}
                  <Link
                    href={`/applications?partnerId=${encodeURIComponent(partnerId)}&status=${a.status}`}
                    aria-label={`Open ${a.customer} ${a.status} applications for ${partnerName}`}
                    className="grid grid-cols-12 items-center px-5 py-3 text-[12px] hover:bg-bg-muted/40 focus-visible:outline-none focus-visible:bg-bg-muted/40"
                  >
                    <div className="col-span-3 font-mono text-fg-muted">{a.id}</div>
                    <div className="col-span-3 font-medium text-fg">{a.customer}</div>
                    <div className="col-span-2 text-fg-secondary font-mono text-[11px]">
                      {a.product}
                    </div>
                    <div className="col-span-2 text-right font-semibold tabular-nums">
                      <Money cents={a.amount} noFractions />
                    </div>
                    <div className="col-span-1">
                      <StatusPill
                        tone={
                          a.status === 'funded'
                            ? 'success'
                            : a.status === 'approved'
                              ? 'info'
                              : a.status === 'declined'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {a.status}
                      </StatusPill>
                    </div>
                    <div className="col-span-1 text-right text-[11px] text-fg-muted">{a.date}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Billing                                                            */
/* ----------------------------------------------------------------------- */

import { getBillingConfig, setBillingConfig, type BillingCycle } from '../../../lib/billing-config';
import { readInvoiceOverrides } from '../../../lib/invoicing';
import { partners as MASTER_PARTNERS_ROSTER } from '../../../lib/master-data';
import { computeInvoiceForPartner } from '../../../lib/invoicing';

function BillingTab({
  partnerId,
  partnerName,
  partnerEmail,
  flash,
}: {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  flash: (m: string) => void;
}) {
  const [version, setVersion] = useState(0);
  const cfg = useMemo(() => getBillingConfig(partnerId), [partnerId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Locate the partner's invoices in localStorage. The invoiceNo
  // convention is `INV-<periodId>-<partnerId>` (set by the generator).
  const invoices = useMemo(() => {
    const overrides = readInvoiceOverrides();
    const partner = MASTER_PARTNERS_ROSTER.find((p) => p.id === partnerId);
    if (!partner) return [];
    return Object.entries(overrides)
      .filter(([id]) => id.endsWith(`-${partnerId}`))
      .map(([invoiceNo, ov]) => {
        const computed = computeInvoiceForPartner({
          partnerId: partner.id,
          product: partner.product,
          fundedNetCents: partner.netCents,
        });
        const amount =
          typeof ov.customFeeCents === 'number' ? ov.customFeeCents : computed.feeAmountCents;
        const paid = (ov.payments ?? []).reduce((s, p) => s + p.amountCents, 0);
        return {
          invoiceNo,
          status: (ov.status ?? 'draft') as 'draft' | 'sent' | 'paid' | 'overdue',
          voided: !!ov.voidedAt,
          dueDate: ov.dueDate ?? '—',
          amountCents: amount,
          paidCents: paid,
          feePct: computed.feePct,
        };
      })
      .sort((a, b) => b.invoiceNo.localeCompare(a.invoiceNo));
  }, [partnerId, version]);

  const totalOutstanding = invoices
    .filter((i) => i.status !== 'paid' && !i.voided)
    .reduce((s, i) => s + Math.max(0, i.amountCents - i.paidCents), 0);
  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.amountCents, 0);

  const updateCfg = (
    patch: Partial<{
      cycle: BillingCycle;
      dayOfPeriod: number;
      sendToEmail?: string;
      autoSend: boolean;
      paymentLinkTemplate?: string;
    }>,
  ) => {
    setBillingConfig({ ...cfg, ...patch, partnerId });
    setVersion((v) => v + 1);
    flash('Billing config updated');
  };

  return (
    <div className="space-y-4">
      {/* Header / stats */}
      <Card>
        <CardHeader
          title="Billing"
          description={`Platform-fee invoicing for ${partnerName}. Defaults inherit from the merchant's vertical; edit per-merchant overrides below.`}
          action={
            <Link
              href={`/invoices?merchantId=${encodeURIComponent(partnerId)}`}
              className="text-[12px] text-accent hover:underline inline-flex items-center gap-1"
            >
              Open in billing workspace <ArrowRightIcon size={11} />
            </Link>
          }
        />
        <CardBody className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Outstanding" value={<Money cents={totalOutstanding} />} />
          <Kpi label="Paid (lifetime)" value={<Money cents={totalPaid} />} />
          <Kpi label="Cycle" value={<span className="capitalize">{cfg.cycle}</span>} />
          <Kpi
            label="Auto-send"
            value={
              cfg.autoSend ? (
                <span className="text-emerald-700">On</span>
              ) : (
                <span className="text-fg-muted">Off</span>
              )
            }
          />
        </CardBody>
      </Card>

      {/* Per-merchant config */}
      <Card>
        <CardHeader
          title="Billing config"
          description="Cycle, day, recipient override, payment-link template, and auto-send. These settings drive what 'Generate from activity' produces for this merchant each period."
        />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Cycle">
            <select
              value={cfg.cycle}
              onChange={(e) => updateCfg({ cycle: e.target.value as BillingCycle })}
              className="w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px]"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="paused">Paused</option>
            </select>
          </Field>
          <Field label={cfg.cycle === 'weekly' ? 'Day of week (0=Sun)' : 'Day of month'}>
            <input
              type="number"
              min={0}
              max={cfg.cycle === 'weekly' ? 6 : 28}
              value={cfg.dayOfPeriod}
              onChange={(e) => updateCfg({ dayOfPeriod: Number(e.target.value) || 1 })}
              className="w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px] tabular-nums"
            />
          </Field>
          <Field label="Send-to email (defaults to merchant contact)">
            <input
              type="email"
              value={cfg.sendToEmail ?? ''}
              onChange={(e) => updateCfg({ sendToEmail: e.target.value || undefined })}
              placeholder={partnerEmail}
              className="w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[13px]"
            />
          </Field>
          <Field label="Auto-send drafts on generate">
            <label className="inline-flex items-center gap-2 h-9 text-[13px]">
              <input
                type="checkbox"
                checked={cfg.autoSend}
                onChange={(e) => updateCfg({ autoSend: e.target.checked })}
              />
              {cfg.autoSend ? 'Yes — flip to Sent immediately' : 'No — leave as Draft'}
            </label>
          </Field>
          <div className="md:col-span-2">
            <Field label="Payment-link template ({{invoice}} + {{amount}} placeholders)">
              <input
                type="text"
                value={cfg.paymentLinkTemplate ?? ''}
                onChange={(e) => updateCfg({ paymentLinkTemplate: e.target.value || undefined })}
                placeholder="https://pay.stripe.com/inv/{{invoice}}?amount={{amount}}"
                className="w-full h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-[12px] font-mono"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Invoice list for this merchant */}
      <Card>
        <CardHeader
          title="Recent invoices"
          description={`${pluralize(invoices.length, 'invoice')} on file. Use the billing workspace for full edit / send / payment flows.`}
        />
        <CardBody className="p-0">
          {invoices.length === 0 ? (
            <div className="px-5 py-10 text-center text-fg-muted text-[13px]">
              No invoices yet. Click <strong>"Generate from activity"</strong> on the master billing
              page to create drafts.
            </div>
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Recent invoices"
              tabIndex={0}
            >
              <div className="min-w-[640px]">
                <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
                  <span className="col-span-4">Invoice</span>
                  <span className="col-span-2">Due</span>
                  <span className="col-span-2 text-right">Amount</span>
                  <span className="col-span-2 text-right">Paid</span>
                  <span className="col-span-2">Status</span>
                </div>
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li
                      key={i.invoiceNo}
                      className={`grid grid-cols-12 items-center px-5 py-3 text-[12px] ${i.voided ? 'opacity-60' : ''}`}
                    >
                      <div className="col-span-4 font-mono text-fg-secondary truncate">
                        {i.invoiceNo}
                        {i.voided && (
                          <span className="ml-1.5 text-rose-600 font-semibold">VOID</span>
                        )}
                      </div>
                      <div className="col-span-2 text-fg-muted">{i.dueDate}</div>
                      <div className="col-span-2 text-right tabular-nums font-semibold">
                        <Money cents={i.amountCents} />
                      </div>
                      <div className="col-span-2 text-right tabular-nums text-fg-muted">
                        <Money cents={i.paidCents} />
                      </div>
                      <div className="col-span-2">
                        <StatusPill
                          tone={
                            i.status === 'paid'
                              ? 'success'
                              : i.status === 'overdue'
                                ? 'danger'
                                : i.status === 'sent'
                                  ? 'warning'
                                  : 'neutral'
                          }
                        >
                          {i.status}
                        </StatusPill>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wider font-semibold text-fg-muted mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Lender Access                                                      */
/* ----------------------------------------------------------------------- */

function LenderAccessTab({ partnerId, flash }: { partnerId: string; flash: (m: string) => void }) {
  // Bump version on mutate so the in-memory mock store re-renders.
  const [version, setVersion] = useState(0);

  // Toggle the per-partner override for a lender. Default-on means: if no
  // override exists, the row is enabled (assuming global+marketplace are
  // active). First click writes a disabled override; second click flips it
  // back to enabled. To "reset to default" the operator can clear the
  // override via the deeper /lender-marketplace/access editor.
  const toggleLender = (lenderId: string, lenderName: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    const now = new Date().toISOString();
    const idx = partnerAccessOverrides.findIndex(
      (o) => o.merchantId === partnerId && o.marketplaceLenderId === lenderId,
    );
    if (idx >= 0) {
      const prev = partnerAccessOverrides[idx]!;
      partnerAccessOverrides[idx] = {
        ...prev,
        enabled: nextEnabled,
        reason: nextEnabled ? null : (prev.reason ?? 'Partner-level toggle'),
        changedAt: now,
      };
    } else {
      partnerAccessOverrides.push({
        merchantId: partnerId,
        marketplaceLenderId: lenderId,
        enabled: nextEnabled,
        reason: nextEnabled ? null : 'Partner-level toggle',
        changedAt: now,
      });
    }
    setVersion((v) => v + 1);
    flash(`${lenderName} ${nextEnabled ? 'enabled' : 'disabled'} for this partner.`);
  };

  const clearOverride = (lenderId: string, lenderName: string) => {
    const idx = partnerAccessOverrides.findIndex(
      (o) => o.merchantId === partnerId && o.marketplaceLenderId === lenderId,
    );
    if (idx >= 0) {
      partnerAccessOverrides.splice(idx, 1);
      setVersion((v) => v + 1);
      flash(`${lenderName} reset to global default.`);
    }
  };

  const view = useMemo(() => {
    return marketplaceLenders.map((l) => {
      const mkt = marketplaces.find((m) => m.id === l.marketplaceId)!;
      const eff = isLenderEnabledForPartner(partnerId, l, mkt);
      const override = partnerAccessOverrides.find(
        (o) => o.merchantId === partnerId && o.marketplaceLenderId === l.id,
      );
      return { lender: l, marketplace: mkt, effective: eff, override };
    });
    // version dep ensures recompute after toggle
  }, [partnerId, version]);

  const enabled = view.filter((v) => v.effective.enabled).length;
  const overridden = view.filter((v) => v.override).length;

  return (
    <div className="space-y-4">
      {/* Sprint H: per-partner stat tiles drill into pre-filtered list
          views. Lender-related tiles route to the lender marketplace
          scoped to this partner. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Lenders enabled"
          value={String(enabled)}
          hint={`of ${view.length} available`}
          tone="success"
          href={`/lender-marketplace?partnerId=${encodeURIComponent(partnerId)}&enabled=true`}
        />
        <StatTile
          label="Overrides"
          value={String(overridden)}
          hint="partner-specific"
          tone={overridden > 0 ? 'warning' : 'neutral'}
          href={`/lender-marketplace/access?partnerId=${encodeURIComponent(partnerId)}`}
        />
        <StatTile
          label="Marketplaces"
          value={String(marketplaces.length)}
          hint="active pools"
          href="/lender-marketplace"
        />
        <StatTile label="Sync freshness" value="4h ago" hint="last marketplace sync" />
      </div>

      <Card>
        <CardHeader
          title="Lender access matrix"
          description="Effective access — combines global lender state, marketplace status, and partner-level overrides."
          action={
            <Link
              href="/lender-marketplace/access"
              className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
            >
              Edit overrides <ExternalIcon size={11} />
            </Link>
          }
        />
        <CardBody className="p-0">
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Lender access matrix"
            tabIndex={0}
          >
            <div className="min-w-[640px]">
              <div className="grid grid-cols-12 px-5 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
                <span className="col-span-3">Lender</span>
                <span className="col-span-3">Marketplace</span>
                <span className="col-span-2">Tiers</span>
                <span className="col-span-2">Source</span>
                <span className="col-span-2 text-right">Effective</span>
              </div>
              <ul className="divide-y divide-border" aria-label={`${view.length} lenders`}>
                {view.map((v) => (
                  <li
                    key={v.lender.id}
                    className="grid grid-cols-12 items-center px-5 py-2.5 text-[12px]"
                  >
                    <div className="col-span-3 font-medium text-fg truncate">
                      {v.lender.displayName}
                    </div>
                    <div className="col-span-3 text-fg-secondary truncate">
                      {v.marketplace.displayName}
                    </div>
                    <div className="col-span-2 text-[11px] text-fg-muted">
                      {v.lender.servesTiers.length} tiers
                    </div>
                    <div className="col-span-2 text-[11px]">
                      {v.effective.via === 'override' ? (
                        <span className="text-warning">Override</span>
                      ) : v.effective.via === 'marketplace-paused' ? (
                        <span className="text-fg-muted">Marketplace paused</span>
                      ) : (
                        <span className="text-fg-muted">Global</span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {v.override && (
                        <button
                          type="button"
                          onClick={() => clearOverride(v.lender.id, v.lender.displayName)}
                          className="text-[10px] text-fg-muted hover:text-fg underline-offset-2 hover:underline transition"
                          title={`Reset to global default (${v.lender.globallyEnabled ? 'enabled' : 'disabled'})`}
                        >
                          reset
                        </button>
                      )}
                      <label
                        className={`relative inline-flex items-center gap-2 ${
                          v.effective.via === 'marketplace-paused'
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                        title={
                          v.effective.via === 'marketplace-paused'
                            ? 'Marketplace is paused — cannot toggle.'
                            : v.effective.enabled
                              ? 'Click to disable for this partner'
                              : 'Click to enable for this partner'
                        }
                      >
                        <span
                          className={`text-[11px] tabular-nums font-medium ${
                            v.effective.enabled ? 'text-fg' : 'text-fg-muted'
                          }`}
                          aria-hidden
                        >
                          {v.effective.enabled ? 'On' : 'Off'}
                        </span>
                        <input
                          type="checkbox"
                          checked={v.effective.enabled}
                          disabled={v.effective.via === 'marketplace-paused'}
                          onChange={() =>
                            toggleLender(v.lender.id, v.lender.displayName, v.effective.enabled)
                          }
                          className="peer sr-only"
                          aria-label={`Toggle ${v.lender.displayName} for this partner`}
                        />
                        <span
                          className={`relative h-5 w-9 rounded-full bg-bg-muted ring-1 ring-border transition-colors duration-200 peer-checked:bg-emerald-500 peer-checked:ring-emerald-600/40 peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus`}
                          aria-hidden
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              v.effective.enabled ? 'translate-x-4' : ''
                            }`}
                          />
                        </span>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Tab: Activity                                                           */
/* ----------------------------------------------------------------------- */

function ActivityTab({ partnerId }: { partnerId: string }) {
  const events = useMemo(() => seedActivity(partnerId), [partnerId]);
  return (
    <Card>
      <CardHeader
        title="Activity feed"
        description="Last 20 audit-relevant events. Append-only; mirrored to the global audit log."
      />
      <CardBody>
        <ol className="relative border-l border-border ml-2 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="pl-4 relative">
              <span
                className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full ${eventDotColor(e.kind)}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-fg">{e.text}</p>
                  <p className="text-[10px] text-fg-muted mt-0.5">
                    {e.actor} · <span className="capitalize">{e.kind}</span>
                  </p>
                </div>
                <span className="text-[10px] text-fg-muted tabular-nums shrink-0 inline-flex items-center gap-1">
                  <ClockIcon size={10} />
                  {formatRelative(e.ts)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function eventDotColor(kind: ActivityEvent['kind']): string {
  switch (kind) {
    case 'status':
      return 'bg-warning';
    case 'user':
      return 'bg-accent';
    case 'lender':
      return 'bg-info';
    case 'application':
      return 'bg-success';
    case 'payout':
      return 'bg-success';
    case 'login':
      return 'bg-fg-muted';
    case 'note':
    default:
      return 'bg-fg-muted';
  }
}

/* ----------------------------------------------------------------------- */
/*  Tab: Settings                                                           */
/* ----------------------------------------------------------------------- */

function SettingsTab({
  partner,
  setPartner,
  partnerId,
  flash,
}: {
  partner: any;
  setPartner: any;
  partnerId: string;
  flash: (m: string) => void;
}) {
  const [draft, setDraft] = useState(partner);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    setTimeout(() => {
      setPartner(draft);
      setSaving(false);
      flash('Settings saved');
    }, 300);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Operational settings"
          description="Status, brand assignment, commission, and payout cadence."
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted"
                id="partner-status-label"
              >
                Status
              </p>
              <div
                role="radiogroup"
                aria-labelledby="partner-status-label"
                className="mt-1.5 flex gap-1.5 flex-wrap"
              >
                {(['Approved', 'Pending', 'Suspended'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={draft.status === s}
                    onClick={() => setDraft({ ...draft, status: s })}
                    className={`px-3 min-h-[36px] rounded-md text-[12px] font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus ${draft.status === s ? 'bg-fg text-white border-fg' : 'bg-bg-elevated text-fg-secondary border-border'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
                Brand assignment
              </p>
              <select
                value={draft.brand}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value as ProductBrand })}
                className="mt-1.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              >
                <option value="MedPay">MedPay</option>
                <option value="TradePay">TradePay</option>
                <option value="CoachPay">CoachPay</option>
                <option value="Multi-brand">Multi-brand</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
                Commission rate (%)
              </p>
              <input
                type="number"
                step="0.05"
                value={draft.commissionPct}
                onChange={(e) => setDraft({ ...draft, commissionPct: Number(e.target.value) })}
                className="mt-1.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
                Payout schedule
              </p>
              <select
                value={draft.payoutSchedule}
                onChange={(e) =>
                  setDraft({ ...draft, payoutSchedule: e.target.value as 'T+1' | 'T+2' | 'Weekly' })
                }
                className="mt-1.5 w-full h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] outline-none"
              >
                <option value="T+1">T+1 (next business day)</option>
                <option value="T+2">T+2</option>
                <option value="Weekly">Weekly (every Friday)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fg-muted">
                Operator notes
              </p>
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Internal-only notes about this partner…"
                className="mt-1.5 w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-[13px] outline-none focus:border-border-strong"
              />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft(partner)}
              disabled={saving}
            >
              Reset
            </Button>
            <Button size="sm" variant="primary" onClick={save} disabled={saving} aria-busy={saving}>
              {saving ? (
                <>
                  <span
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                'Save settings'
              )}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="border-danger/30">
        <CardHeader
          title={<span className="text-danger">Danger zone</span>}
          description="Irreversible actions for this partner — requires Master role + audit log entry."
        />
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-fg">Delete partner</p>
              <p className="text-[12px] text-fg-muted">
                Removes partner profile, archives users, soft-deletes applications. Payout history
                retained for 7 years per AU record-keeping rules.
              </p>
            </div>
            <Button size="sm" variant="danger" onClick={() => setShowDelete(true)}>
              Delete partner…
            </Button>
          </div>
        </CardBody>
      </Card>

      {showDelete && (
        <Modal open onClose={() => setShowDelete(false)} size="sm" title="Delete partner?">
          <p className="text-[13px] text-fg-secondary">
            Type <span className="font-mono font-bold text-danger">{partnerId}</span> to confirm
            deletion. This action is logged to the master audit trail and cannot be undone from the
            UI.
          </p>
          <ConfirmDelete
            partnerId={partnerId}
            onCancel={() => setShowDelete(false)}
            onConfirm={() => {
              setShowDelete(false);
              flash('Delete request queued — pending dual-control approval');
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ConfirmDelete({
  partnerId,
  onCancel,
  onConfirm,
}: {
  partnerId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [v, setV] = useState('');
  return (
    <div className="mt-4">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={partnerId}
        className="w-full h-10 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-mono outline-none focus:border-danger"
      />
      <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="danger" disabled={v !== partnerId} onClick={onConfirm}>
          Delete partner
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Shared helpers                                                          */
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
      <p className={`mt-1.5 text-[20px] font-bold tracking-tight leading-none ${accent}`}>
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
        aria-label={`${label}. Open filtered list.`}
        className={`${base} transition-colors hover:border-border-strong hover:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

function formatRelative(iso: string): string {
  if (!iso || iso === '—') return '—';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
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
