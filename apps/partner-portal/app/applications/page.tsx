'use client';
import { useEffect, useMemo, useState } from 'react';
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
import { partners as MASTER_PARTNERS, applicationsForPartner } from '../../lib/master-data';
import { readSubmittedApps, type SubmittedApp } from '../../lib/submitted-applications';

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

// Build the partner list off the canonical master roster so any link
// out of /control-panel lands here on a matching id.
const SEED: PartnerAppsRow[] = MASTER_PARTNERS.map((p) => {
  const apps = applicationsForPartner(p.id);
  // synthesise a plausible apps count when the master fixture is light
  const count =
    apps.length > 0
      ? apps.length + Math.floor(p.fundedCount / 2)
      : Math.max(2, Math.floor(p.fundedCount * 1.4));
  return {
    partnerId: p.id,
    initials: p.initials,
    name: p.legalName,
    apps: count,
    email: p.email,
    niche: p.niche.charAt(0).toUpperCase() + p.niche.slice(1),
  };
});

const MONTH_OPTIONS = [
  'All Months',
  'May 2026',
  'Apr 2026',
  'Mar 2026',
  'Feb 2026',
  'Jan 2026',
  'Dec 2025',
] as const;

export default function FinanceApplicationsPage() {
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState<(typeof MONTH_OPTIONS)[number]>('All Months');
  const [monthOpen, setMonthOpen] = useState(false);

  /**
   * Roll the consumer-submitted-app store into the per-partner counts
   * the admin sees. Read once on mount; admin role implies "see every
   * partner's submitted count" so we don't scope by partnerId here.
   */
  const [submittedAll, setSubmittedAll] = useState<SubmittedApp[]>([]);
  useEffect(() => {
    setSubmittedAll(readSubmittedApps());
  }, []);

  const liveRows: PartnerAppsRow[] = useMemo(() => {
    if (submittedAll.length === 0) return SEED;
    const byPartner = new Map<string, number>();
    for (const s of submittedAll) {
      byPartner.set(s.partnerId, (byPartner.get(s.partnerId) ?? 0) + 1);
    }
    return SEED.map((row) => {
      const bump = byPartner.get(row.partnerId) ?? 0;
      return bump > 0 ? { ...row, apps: row.apps + bump } : row;
    });
  }, [submittedAll]);

  const filtered = useMemo(
    () =>
      liveRows.filter((p) =>
        search
          ? p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [search, liveRows],
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Finance Applications"
        description="View each referral partner's client finance applications and outcomes"
      />
      <PageBody>
        {/* Tab strip — Settlements lives under here instead of its own
            top-level nav entry. Both views read the same underlying
            application set; "Settlements" filters to funded rows + adds
            payout-tracking columns. */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          <span
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-fg border-b-2 border-fg -mb-px"
            aria-current="page"
          >
            Applications
          </span>
          <Link
            href="/settlements"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-fg-secondary hover:text-fg transition border-b-2 border-transparent hover:border-border-strong -mb-px"
          >
            Settlements
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <Kpi label="Total Apps" value={String(liveRows.reduce((s, p) => s + p.apps, 0))} />
          <Kpi
            label="Funded"
            value={String(Math.round(liveRows.reduce((s, p) => s + p.apps, 0) * 0.38))}
          />
          <Kpi
            label="Approved"
            value={String(Math.round(liveRows.reduce((s, p) => s + p.apps, 0) * 0.21))}
          />
          <Kpi
            label="Declined"
            value={String(Math.round(liveRows.reduce((s, p) => s + p.apps, 0) * 0.09))}
          />
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setMonthOpen((v) => !v)}
              className="h-10 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg-secondary hover:bg-bg-muted"
            >
              <ClockIcon size={14} />
              {month}
            </button>
            {monthOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close"
                  onClick={() => setMonthOpen(false)}
                />
                <div className="absolute right-0 top-11 z-20 w-44 rounded-lg border border-border bg-bg-elevated shadow-lg overflow-hidden">
                  {MONTH_OPTIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => {
                        setMonth(o);
                        setMonthOpen(false);
                      }}
                      className={
                        'block w-full text-left px-3 py-2 text-[12px] hover:bg-bg-muted ' +
                        (o === month ? 'bg-bg-muted text-fg font-semibold' : 'text-fg-secondary')
                      }
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
                    <ArrowRightIcon
                      size={14}
                      className="text-fg-muted col-span-1 justify-self-end"
                    />
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
