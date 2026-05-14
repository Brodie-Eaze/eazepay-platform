'use client';
import { useMemo, useState } from 'react';
import { PageHeader, PageBody, Card, CardBody, ClockIcon } from '@eazepay/ui/web';

/**
 * Reports — direct port of Lovable's `/reports` analytics page.
 * 6 KPIs + segmented status chips + full applications table.
 */

type Status = 'All' | 'Funded' | 'Approved' | 'Declined' | 'Submitted';
const STATUSES: Status[] = ['All', 'Funded', 'Approved', 'Declined', 'Submitted'];

interface AppRow {
  customer: string;
  customerEmail: string;
  partner: string;
  product: 'med-pay' | 'trade-pay' | 'coach-pay';
  amount: number;
  fico: number;
  lender: string;
  status: Exclude<Status, 'All'>;
  date: string;
}

const SEED: AppRow[] = [
  { customer: 'James Taylor',    customerEmail: 'james.t@email.com',    partner: 'MedCare Clinic',           product: 'med-pay',   amount: 6_800,  fico: 580, lender: 'SoFi',       status: 'Submitted', date: '06/03/2026' },
  { customer: 'Jake Morrison',   customerEmail: 'jake.m@email.com',     partner: 'TradesPro Services',       product: 'trade-pay', amount: 8_500,  fico: 610, lender: 'SoFi',       status: 'Submitted', date: '05/03/2026' },
  { customer: 'James Kim',       customerEmail: 'james.k@email.com',    partner: 'Demo Account',             product: 'trade-pay', amount: 30_000, fico: 690, lender: 'SoFi',       status: 'Submitted', date: '04/03/2026' },
  { customer: 'Amanda Foster',   customerEmail: 'amanda.f@email.com',   partner: 'Demo Account',             product: 'trade-pay', amount: 60_000, fico: 670, lender: 'BlueVine',   status: 'Submitted', date: '02/03/2026' },
  { customer: 'Samantha Reed',   customerEmail: 'samantha.r@email.com', partner: 'Peak Performance Coaching',product: 'coach-pay', amount: 15_000, fico: 655, lender: 'CapitalOne', status: 'Submitted', date: '01/03/2026' },
  { customer: 'Robert Taylor',   customerEmail: 'robert.t@email.com',   partner: 'Demo Account',             product: 'med-pay',   amount: 20_000, fico: 705, lender: 'CapitalOne', status: 'Approved',  date: '28/02/2026' },
  { customer: 'Maria Santos',    customerEmail: 'maria.s@email.com',    partner: 'MedCare Clinic',           product: 'med-pay',   amount: 42_000, fico: 660, lender: 'LendFi',     status: 'Submitted', date: '26/02/2026' },
  { customer: 'David Williams',  customerEmail: 'david.w@email.com',    partner: 'Demo Account',             product: 'trade-pay', amount: 15_000, fico: 650, lender: 'BlueVine',   status: 'Submitted', date: '23/02/2026' },
  { customer: 'Tom Bradley',     customerEmail: 'tom.b@email.com',      partner: 'TradesPro Services',       product: 'trade-pay', amount: 12_000, fico: 640, lender: 'BlueVine',   status: 'Submitted', date: '20/02/2026' },
  { customer: 'Alan Foster',     customerEmail: 'alan.f@email.com',     partner: 'Peak Performance Coaching',product: 'coach-pay', amount: 5_500,  fico: 520, lender: 'BlueVine',   status: 'Declined',  date: '18/02/2026' },
  { customer: 'Derek Johnson',   customerEmail: 'derek.j@email.com',    partner: 'Peak Performance Coaching',product: 'coach-pay', amount: 8_000,  fico: 700, lender: 'Prosper',    status: 'Approved',  date: '15/02/2026' },
  { customer: 'Carla Ruiz',      customerEmail: 'carla.r@email.com',    partner: 'TradesPro Services',       product: 'trade-pay', amount: 22_000, fico: 540, lender: 'LendFi',     status: 'Declined',  date: '11/02/2026' },
  { customer: 'Angela White',    customerEmail: 'angela.w@email.com',   partner: 'MedCare Clinic',           product: 'med-pay',   amount: 28_000, fico: 695, lender: 'Prosper',    status: 'Approved',  date: '08/02/2026' },
  { customer: 'Emily Rodriguez', customerEmail: 'emily.r@email.com',    partner: 'Demo Account',             product: 'med-pay',   amount: 50_000, fico: 560, lender: 'Prosper',    status: 'Declined',  date: '06/02/2026' },
  { customer: 'Sandra Lopez',    customerEmail: 'sandra.l@email.com',   partner: 'TradesPro Services',       product: 'trade-pay', amount: 32_000, fico: 685, lender: 'CapitalOne', status: 'Approved',  date: '04/02/2026' },
  { customer: 'Sarah Chen',      customerEmail: 'sarah.c@email.com',    partner: 'Demo Account',             product: 'med-pay',   amount: 75_000, fico: 780, lender: 'CapitalOne', status: 'Approved',  date: '01/02/2026' },
  { customer: 'Lisa Chen',       customerEmail: 'lisa.c@email.com',     partner: 'TradesPro Services',       product: 'trade-pay', amount: 45_000, fico: 755, lender: 'Prosper',    status: 'Funded',    date: '28/01/2026' },
  { customer: 'Brittany Nguyen', customerEmail: 'brittany.n@email.com', partner: 'Peak Performance Coaching',product: 'coach-pay', amount: 12_000, fico: 740, lender: 'LendFi',     status: 'Funded',    date: '25/01/2026' },
  { customer: 'Robert Kim',      customerEmail: 'robert.k@email.com',   partner: 'MedCare Clinic',           product: 'med-pay',   amount: 15_000, fico: 710, lender: 'CapitalOne', status: 'Funded',    date: '20/01/2026' },
  { customer: 'Lisa Patel',      customerEmail: 'lisa.p@email.com',     partner: 'Demo Account',             product: 'coach-pay', amount: 45_000, fico: 725, lender: 'LendFi',     status: 'Funded',    date: '18/01/2026' },
  { customer: 'Mike Henderson',  customerEmail: 'mike.h@email.com',     partner: 'TradesPro Services',       product: 'trade-pay', amount: 18_500, fico: 720, lender: 'LendFi',     status: 'Funded',    date: '15/01/2026' },
  { customer: 'Marcus Johnson',  customerEmail: 'marcus.j@email.com',   partner: 'Demo Account',             product: 'coach-pay', amount: 25_000, fico: 745, lender: 'LendFi',     status: 'Funded',    date: '12/01/2026' },
  { customer: 'David Park',      customerEmail: 'david.p@email.com',    partner: 'MedCare Clinic',           product: 'med-pay',   amount: 9_500,  fico: 730, lender: 'BlueVine',   status: 'Funded',    date: '10/01/2026' },
];

const STATUS_PILL: Record<AppRow['status'], string> = {
  Funded:    'bg-bg-inverse text-white',
  Approved:  'bg-bg-muted text-fg border border-border',
  Declined:  'bg-bg-muted text-fg-muted border border-border',
  Submitted: 'bg-bg-muted text-fg-secondary border border-border',
};

export default function ReportsPage() {
  const [status, setStatus] = useState<Status>('All');
  const rows = useMemo(() => (status === 'All' ? SEED : SEED.filter((r) => r.status === status)), [status]);

  const totals = {
    total: SEED.length,
    funded: SEED.filter((r) => r.status === 'Funded').length,
    approved: SEED.filter((r) => r.status === 'Approved').length,
    declined: SEED.filter((r) => r.status === 'Declined').length,
    submitted: SEED.filter((r) => r.status === 'Submitted').length,
    fundedVol: SEED.filter((r) => r.status === 'Funded').reduce((s, r) => s + r.amount, 0),
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Analytics' }]} title="Reports" />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select className="h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] outline-none">
            <option>All Partners</option>
          </select>
          <button className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg-secondary hover:bg-bg-muted">
            <ClockIcon size={14} />
            All Months
          </button>
          <div className="flex items-center gap-1 ml-auto bg-bg-elevated border border-border rounded-lg p-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  'px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ' +
                  (status === s ? 'bg-[#0d1530] text-white' : 'text-fg-muted hover:text-fg')
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <Kpi label="Total Apps" value={String(totals.total)} />
          <Kpi label="Funded" value={String(totals.funded)} />
          <Kpi label="Approved" value={String(totals.approved)} />
          <Kpi label="Declined" value={String(totals.declined)} />
          <Kpi label="Submitted" value={String(totals.submitted)} />
          <Kpi label="Funded Vol." value={`$${Math.round(totals.fundedVol / 1000)}K`} />
        </div>

        <Card>
          <CardBody className="p-0">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-[14px] font-semibold text-fg">Applications ({rows.length})</h2>
            </div>
            <div className="grid grid-cols-12 px-5 py-3 text-[10px] uppercase tracking-wider font-semibold text-fg-muted border-b border-border bg-bg-muted/40">
              <span className="col-span-3">Customer</span>
              <span className="col-span-2">Partner</span>
              <span className="col-span-1">Product</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1 text-right">FICO</span>
              <span className="col-span-1">Lender</span>
              <span className="col-span-1">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <li key={i} className="grid grid-cols-12 px-5 py-3 items-center text-[13px]">
                  <div className="col-span-3 min-w-0">
                    <p className="font-semibold text-fg truncate">{r.customer}</p>
                    <p className="text-[11px] text-fg-muted truncate">{r.customerEmail}</p>
                  </div>
                  <div className="col-span-2 text-fg-secondary text-[12px] truncate">{r.partner}</div>
                  <div className="col-span-1 text-fg-secondary text-[12px] font-mono">{r.product}</div>
                  <div className="col-span-2 text-right font-semibold text-fg tabular-nums">
                    ${r.amount.toLocaleString('en-US')}
                  </div>
                  <div className="col-span-1 text-right text-fg-secondary tabular-nums">{r.fico}</div>
                  <div className="col-span-1 text-fg-secondary text-[12px]">{r.lender}</div>
                  <div className="col-span-1">
                    <span className={'text-[10px] px-2 py-0.5 rounded-full font-medium ' + STATUS_PILL[r.status]}>
                      {r.status}
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-[11px] text-fg-muted">{r.date}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1.5 text-[20px] font-bold tracking-tight text-fg leading-none">{value}</p>
    </div>
  );
}
