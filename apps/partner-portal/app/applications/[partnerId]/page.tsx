'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { findPartner, applicationsForPartner } from '../../../lib/master-data';
import {
  PageBody,
  Card,
  CardBody,
  DocIcon,
  DollarIcon,
  CheckIcon,
  XIcon,
  InfoIcon,
  ChevronDownIcon,
} from '@eazepay/ui/web';

/**
 * Partner Account — direct port of Lovable's "click a partner from
 * All Applications" drill view.
 *
 *   ← Back to All Partners
 *   PARTNER ACCOUNT eyebrow
 *   Partner name h1 · email · phone · industry
 *
 *   Status filter pills (icons + label):
 *     [All] · [Funded] · [Approved] · [Declined] · [Submitted]
 *
 *   6 KPI cards: TOTAL APPS · FUNDED · APPROVED · DECLINED · SUBMITTED · FUNDED VOL.
 *
 *   "Finance Applications (N)" table:
 *     ID · CLIENT · PRODUCT · AMOUNT · STATUS · DATE
 *   Clicking a row expands inline showing:
 *     CLIENT NAME · LOAN AMOUNT · LOAN TERM · INTEREST RATE
 *     CREDIT SCORE · PURPOSE · PRODUCT · DATE SUBMITTED
 *
 *   Pagination: Showing 1–10 of N · [Prev] [Next]
 */

type Status = 'All' | 'Funded' | 'Approved' | 'Declined' | 'Submitted';
const STATUSES: Array<{ label: Status; icon: React.ReactNode }> = [
  { label: 'All', icon: <DocIcon size={12} /> },
  { label: 'Funded', icon: <DollarIcon size={12} /> },
  { label: 'Approved', icon: <CheckIcon size={12} /> },
  { label: 'Declined', icon: <XIcon size={12} /> },
  { label: 'Submitted', icon: <InfoIcon size={12} /> },
];

interface AppRow {
  id: string;
  client: string;
  product: 'MedPay' | 'TradePay' | 'CoachPay';
  amount: number;
  status: Exclude<Status, 'All'>;
  date: string;
  detail: {
    loanTerm: string;
    interestRate: string;
    creditScore: number;
    purpose: string;
    dateSubmitted: string;
  };
}

interface PartnerInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
  industry: string;
  product: 'MedPay' | 'TradePay' | 'CoachPay' | 'Multi-brand';
  apps: AppRow[];
}

const PARTNERS: Record<string, PartnerInfo> = {
  premier: {
    id: 'premier',
    name: 'Premier Coaching Group',
    email: 'sarah@premiercoaching.com',
    phone: '(305) 555-0101',
    industry: 'Coaching',
    product: 'CoachPay',
    apps: [
      { id: 'FA-1001', client: 'John Martinez',  product: 'CoachPay', amount: 45_000, status: 'Funded',    date: '2026-03-05', detail: { loanTerm: '24 months', interestRate: '8.5%', creditScore: 720, purpose: 'Business expansion', dateSubmitted: '2026-03-05' } },
      { id: 'FA-1002', client: 'Lisa Chen',      product: 'CoachPay', amount: 32_000, status: 'Funded',    date: '2026-03-04', detail: { loanTerm: '36 months', interestRate: '9.2%', creditScore: 695, purpose: 'Coaching program',    dateSubmitted: '2026-03-04' } },
      { id: 'FA-1003', client: 'Robert Davis',   product: 'CoachPay', amount: 78_000, status: 'Approved',  date: '2026-03-03', detail: { loanTerm: '60 months', interestRate: '7.9%', creditScore: 745, purpose: 'Bootcamp series',     dateSubmitted: '2026-03-03' } },
      { id: 'FA-1004', client: 'Emily Watson',   product: 'CoachPay', amount: 25_000, status: 'Submitted', date: '2026-03-07', detail: { loanTerm: '24 months', interestRate: '—',    creditScore: 680, purpose: 'Certification',       dateSubmitted: '2026-03-07' } },
      { id: 'FA-1005', client: 'Michael Brown',  product: 'CoachPay', amount: 52_000, status: 'Funded',    date: '2026-02-28', detail: { loanTerm: '48 months', interestRate: '8.7%', creditScore: 710, purpose: 'Career programs',     dateSubmitted: '2026-02-28' } },
      { id: 'FA-1006', client: 'Amanda Torres',  product: 'CoachPay', amount: 18_000, status: 'Submitted', date: '2026-03-06', detail: { loanTerm: '24 months', interestRate: '—',    creditScore: 655, purpose: 'Coaching',             dateSubmitted: '2026-03-06' } },
      { id: 'FA-1007', client: 'David Kim',      product: 'CoachPay', amount: 65_000, status: 'Approved',  date: '2026-03-02', detail: { loanTerm: '48 months', interestRate: '8.1%', creditScore: 730, purpose: 'Bootcamp',             dateSubmitted: '2026-03-02' } },
      { id: 'FA-1008', client: 'Rachel Green',   product: 'CoachPay', amount: 40_000, status: 'Funded',    date: '2026-02-25', detail: { loanTerm: '36 months', interestRate: '8.6%', creditScore: 705, purpose: 'Coaching',             dateSubmitted: '2026-02-25' } },
      { id: 'FA-1009', client: 'Carlos Rivera',  product: 'CoachPay', amount: 15_000, status: 'Declined',  date: '2026-03-01', detail: { loanTerm: '12 months', interestRate: '—',    creditScore: 580, purpose: 'Specialty courses',    dateSubmitted: '2026-03-01' } },
      { id: 'FA-1010', client: 'Jessica Park',   product: 'CoachPay', amount: 55_000, status: 'Approved',  date: '2026-03-06', detail: { loanTerm: '60 months', interestRate: '7.8%', creditScore: 740, purpose: 'Executive coaching',  dateSubmitted: '2026-03-06' } },
      { id: 'FA-1011', client: 'Tyler Hughes',   product: 'CoachPay', amount: 37_000, status: 'Funded',    date: '2026-02-27', detail: { loanTerm: '36 months', interestRate: '8.4%', creditScore: 715, purpose: 'Coaching program',    dateSubmitted: '2026-02-27' } },
      { id: 'FA-1012', client: 'Olivia Chen',    product: 'CoachPay', amount: 22_500, status: 'Submitted', date: '2026-03-08', detail: { loanTerm: '24 months', interestRate: '—',    creditScore: 665, purpose: 'Certification',       dateSubmitted: '2026-03-08' } },
    ],
  },
  medfirst: {
    id: 'medfirst', name: 'MedFirst Solutions', email: 'james@medfirst.com', phone: '(212) 555-0202', industry: 'Medical', product: 'MedPay',
    apps: Array.from({ length: 8 }).map((_, i) => ({
      id: `MA-100${i + 1}`,
      client: ['Maria Santos', 'Angela White', 'Robert Taylor', 'David Park', 'Robert Kim', 'James Taylor', 'Sarah Chen', 'Emily Rodriguez'][i]!,
      product: 'MedPay' as const,
      amount: [42_000, 28_000, 20_000, 9_500, 15_000, 6_800, 75_000, 50_000][i]!,
      status: (['Submitted', 'Approved', 'Approved', 'Funded', 'Funded', 'Submitted', 'Approved', 'Declined'][i]) as Exclude<Status, 'All'>,
      date: '2026-02-15',
      detail: { loanTerm: '36 months', interestRate: '8.4%', creditScore: 690, purpose: 'Procedure financing', dateSubmitted: '2026-02-15' },
    })),
  },
  tradeforce: {
    id: 'tradeforce', name: 'TradeForce Pro', email: 'mike@tradeforce.com', phone: '(415) 555-0303', industry: 'Trades', product: 'TradePay',
    apps: Array.from({ length: 6 }).map((_, i) => ({
      id: `TA-100${i + 1}`,
      client: ['Jake Morrison', 'Tom Bradley', 'Carla Ruiz', 'Sandra Lopez', 'Lisa Chen', 'Mike Henderson'][i]!,
      product: 'TradePay' as const,
      amount: [8_500, 12_000, 22_000, 32_000, 45_000, 18_500][i]!,
      status: (['Submitted', 'Submitted', 'Declined', 'Approved', 'Funded', 'Funded'][i]) as Exclude<Status, 'All'>,
      date: '2026-02-20',
      detail: { loanTerm: '48 months', interestRate: '9.1%', creditScore: 680, purpose: 'Project financing', dateSubmitted: '2026-02-20' },
    })),
  },
  dental: {
    id: 'dental', name: 'Dental Care Partners', email: 'amy@dentalcarepartners.com', phone: '(310) 555-0404', industry: 'Dental', product: 'MedPay',
    apps: Array.from({ length: 4 }).map((_, i) => ({
      id: `DA-100${i + 1}`,
      client: ['Sandra Lopez', 'Aisha Khan', 'James Taylor', 'Robert Davis'][i]!,
      product: 'MedPay' as const,
      amount: [32_000, 28_000, 6_800, 81_000][i]!,
      status: (['Approved', 'Funded', 'Submitted', 'Approved'][i]) as Exclude<Status, 'All'>,
      date: '2026-02-25',
      detail: { loanTerm: '24 months', interestRate: '8.9%', creditScore: 695, purpose: 'Dental implants', dateSubmitted: '2026-02-25' },
    })),
  },
};

const STATUS_PILL: Record<Exclude<Status, 'All'>, string> = {
  Funded:    'bg-bg-inverse text-white before:bg-white',
  Approved:  'bg-bg-muted text-fg border border-border before:bg-fg',
  Declined:  'bg-bg-muted text-fg-muted border border-border before:bg-fg-muted',
  Submitted: 'bg-bg-muted text-fg-secondary border border-border before:bg-fg-secondary',
};

const PAGE_SIZE = 10;
const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
const capitalize = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)) as 'Submitted' | 'Funded' | 'Approved' | 'Declined' | 'Submitted';

export default function PartnerAccountPage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  // Bridge the two id namespaces: legacy slug ('premier') and master id ('p_atlas').
  // First try the local PARTNERS map; if that misses, synthesise a partner shell
  // from the master roster + master applications. The control-panel always
  // links here with the master id so this branch is the common path.
  let partner: PartnerInfo | undefined = PARTNERS[partnerId];
  if (!partner) {
    const master = findPartner(partnerId);
    if (master) {
      const masterApps = applicationsForPartner(master.id);
      const fakeApps: AppRow[] = masterApps.map((a, i) => ({
        id: `FA-${master.id.slice(2).toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`,
        client: a.customer,
        product:
          a.product === 'med-pay' ? 'MedPay' : a.product === 'trade-pay' ? 'TradePay' : 'CoachPay',
        amount: Math.round(a.amountCents / 100),
        status: (a.status === 'in_review' ? 'Submitted' : capitalize(a.status)) as Exclude<Status, 'All'>,
        date: a.date,
        detail: {
          loanTerm: a.product === 'trade-pay' ? '48 months' : a.product === 'med-pay' ? '36 months' : '24 months',
          interestRate: a.status === 'funded' || a.status === 'approved' ? '8.4%' : '—',
          creditScore: a.fico,
          purpose:
            a.product === 'med-pay'
              ? 'Procedure financing'
              : a.product === 'trade-pay'
                ? 'Home improvement project'
                : 'Coaching program',
          dateSubmitted: a.date,
        },
      }));
      partner = {
        id: master.id,
        name: master.legalName,
        email: master.email,
        phone: master.phone ?? '—',
        industry: master.niche.charAt(0).toUpperCase() + master.niche.slice(1),
        product: master.product,
        apps: fakeApps,
      };
    }
  }
  if (!partner) notFound();

  const [filter, setFilter] = useState<Status>('All');
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'All' ? partner!.apps : partner!.apps.filter((a) => a.status === filter)),
    [filter, partner],
  );
  const totals = {
    total: partner!.apps.length,
    funded: partner!.apps.filter((a) => a.status === 'Funded').length,
    approved: partner!.apps.filter((a) => a.status === 'Approved').length,
    declined: partner!.apps.filter((a) => a.status === 'Declined').length,
    submitted: partner!.apps.filter((a) => a.status === 'Submitted').length,
    fundedVol: partner!.apps.filter((a) => a.status === 'Funded').reduce((s, a) => s + a.amount, 0),
  };
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="px-8 py-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 text-[12px] text-fg-muted hover:text-fg mb-3"
      >
        ← Back to All Partners
      </Link>

      <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted">
        Partner Account
      </p>
      <h1 className="mt-1 text-fg">{partner!.name}</h1>
      <p className="mt-2 text-[13px] text-fg-muted">
        ✉ {partner!.email} &nbsp; · &nbsp; ☎ {partner!.phone} &nbsp; · &nbsp; {partner!.industry}
      </p>

      <PageBody>
        <div className="flex flex-wrap gap-2 mb-5">
          {STATUSES.map(({ label, icon }) => {
            const active = filter === label;
            return (
              <button
                key={label}
                onClick={() => {
                  setFilter(label);
                  setPage(1);
                }}
                className={
                  'h-9 inline-flex items-center gap-1.5 px-3 rounded-full text-[12px] font-semibold transition-all border ' +
                  (active
                    ? 'bg-[#0d1530] text-white border-[#0d1530]'
                    : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong')
                }
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Kpi label="Total Apps" value={String(totals.total)} icon={<DocIcon size={12} />} />
          <Kpi label="Funded" value={String(totals.funded)} icon={<DollarIcon size={12} />} />
          <Kpi label="Approved" value={String(totals.approved)} icon={<CheckIcon size={12} />} />
          <Kpi label="Declined" value={String(totals.declined)} icon={<XIcon size={12} />} />
          <Kpi label="Submitted" value={String(totals.submitted)} icon={<InfoIcon size={12} />} />
          <Kpi label="Funded Vol." value={`$${Math.round(totals.fundedVol / 1000)}K`} icon={<DollarIcon size={12} />} />
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-[14px] font-semibold text-fg">Finance Applications ({filtered.length})</h2>
            </div>
            <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-2">ID</span>
              <span className="col-span-3">Client</span>
              <span className="col-span-2">Product</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>
            <ul className="divide-y divide-border">
              {slice.map((a) => {
                const open = openRow === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setOpenRow(open ? null : a.id)}
                      className="w-full grid grid-cols-12 px-5 py-3 items-center text-[13px] text-left hover:bg-bg-muted/40"
                    >
                      <span className="col-span-2 font-mono text-fg-secondary">{a.id}</span>
                      <span className="col-span-3 font-medium text-fg truncate">{a.client}</span>
                      <span className="col-span-2 text-fg-secondary text-[12px]">{a.product}</span>
                      <span className="col-span-2 text-right font-semibold text-fg tabular-nums">{fmt(a.amount)}</span>
                      <span className="col-span-2">
                        <span className={'text-[10px] px-2 py-0.5 rounded-full font-medium ' + STATUS_PILL[a.status]}>
                          {a.status}
                        </span>
                      </span>
                      <span className="col-span-1 text-right text-[11px] text-fg-muted flex items-center justify-end gap-1">
                        {a.date}
                        <ChevronDownIcon
                          size={12}
                          className={'transition-transform ' + (open ? 'rotate-180' : '')}
                        />
                      </span>
                    </button>
                    {open && (
                      <div className="px-5 pb-5 pt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 bg-bg-muted/30 border-t border-border">
                        <Field k="Client Name" v={a.client} />
                        <Field k="Loan Amount" v={fmt(a.amount)} />
                        <Field k="Loan Term" v={a.detail.loanTerm} />
                        <Field k="Interest Rate" v={a.detail.interestRate} />
                        <Field k="Credit Score" v={String(a.detail.creditScore)} />
                        <Field k="Purpose" v={a.detail.purpose} />
                        <Field k="Product" v={a.product} />
                        <Field k="Date Submitted" v={a.detail.dateSubmitted} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-[11px] text-fg-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-bg-muted disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-[12px] rounded-md border border-border hover:bg-bg-muted disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-[20px] font-bold tracking-tight text-fg leading-none">{value}</p>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">{k}</dt>
      <dd className="text-[13px] text-fg mt-0.5">{v || '—'}</dd>
    </div>
  );
}
