'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  ArrowRightIcon,
  ClockIcon,
  SearchIcon,
} from '@eazepay/ui/web';

/**
 * Finance Applications — direct port of Lovable's `/admin/applications`.
 *
 *   Eyebrow MASTER
 *   Title  "Finance Applications"
 *   Sub    "View each referral partner's client finance applications and outcomes"
 *
 *   4 KPI cards in a row:
 *     TOTAL APPS · FUNDED · APPROVED · DECLINED
 *   Filters: [Search partners…] · [📅 All Months]
 *   Rows: avatar · Partner name · apps-count chip · email · • niche · ›
 */

interface PartnerAppsRow {
  partnerId: string;
  initials: string;
  name: string;
  apps: number;
  email: string;
  niche: string;
}

const SEED: PartnerAppsRow[] = [
  { partnerId: 'premier',    initials: 'PR', name: 'Premier Coaching Group', apps: 12, email: 'sarah@premiercoaching.com',  niche: 'Coaching' },
  { partnerId: 'medfirst',   initials: 'ME', name: 'MedFirst Solutions',     apps: 8,  email: 'james@medfirst.com',         niche: 'Medical' },
  { partnerId: 'tradeforce', initials: 'TR', name: 'TradeForce Pro',         apps: 6,  email: 'mike@tradeforce.com',        niche: 'Trades' },
  { partnerId: 'dental',     initials: 'DE', name: 'Dental Care Partners',   apps: 4,  email: 'amy@dentalcarepartners.com', niche: 'Dental' },
];

export default function FinanceApplicationsPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      SEED.filter((p) =>
        search
          ? p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [search],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Finance Applications"
        description="View each referral partner's client finance applications and outcomes"
      />
      <PageBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi label="Total Apps" value="30" />
          <Kpi label="Funded" value="11" />
          <Kpi label="Approved" value="7" />
          <Kpi label="Declined" value="3" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search partners…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <button className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg-secondary hover:bg-bg-muted">
            <ClockIcon size={14} />
            All Months
          </button>
        </div>

        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.email}>
                  <Link
                    href={`/applications/${p.partnerId}`}
                    className="grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-bg-muted/40 cursor-pointer"
                  >
                    <div className="col-span-11 flex items-center gap-3 min-w-0">
                      <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                        {p.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                          {p.name}
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted px-2 py-0.5 rounded-full shrink-0">
                            {p.apps} apps
                          </span>
                        </p>
                        <p className="text-[12px] text-fg-muted truncate mt-0.5">
                          {p.email} · {p.niche}
                        </p>
                      </div>
                    </div>
                    <ArrowRightIcon size={14} className="text-fg-muted col-span-1 justify-self-end" />
                  </Link>
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
    <div className="rounded-lg border border-border bg-bg-elevated px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-fg-muted">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-tight text-fg leading-none">{value}</p>
    </div>
  );
}
