'use client';
import { useMemo, useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  ArrowRightIcon,
  ExternalIcon,
  SearchIcon,
} from '@eazepay/ui/web';

/**
 * Control Panel — direct port of Lovable's `/admin/control-panel` page.
 *
 * Layout:
 *   PageHeader: "Control Panel" · "Full partner management — profiles,
 *               applications, payouts, and access"  · [Refresh]
 *   Filters: [search] · [All Niches ▾] · [All Statuses ▾]
 *   "<n> partners found"
 *   Rows: avatar · Name · email · View Account · status pill · niche · ›
 */

type Niche = 'medical' | 'trades' | 'coaching' | 'dental';
type PartnerStatus = 'Approved' | 'Pending' | 'Suspended';

interface PartnerRow {
  initials: string;
  name: string;
  email: string;
  status: PartnerStatus;
  niche: Niche;
}

const SEED: PartnerRow[] = [
  { initials: 'ME', name: 'MedCare Clinic', email: 'medical@eaze.test', status: 'Approved', niche: 'medical' },
  { initials: 'TR', name: 'TradesPro Services', email: 'trades@eaze.test', status: 'Approved', niche: 'trades' },
  { initials: 'PE', name: 'Peak Performance Coaching', email: 'coach@eaze.test', status: 'Approved', niche: 'coaching' },
];

export default function ControlPanelPage() {
  const [search, setSearch] = useState('');
  const [niche, setNiche] = useState<Niche | ''>('');
  const [status, setStatus] = useState<PartnerStatus | ''>('');

  const filtered = useMemo(
    () =>
      SEED.filter((p) => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.email.toLowerCase().includes(search.toLowerCase())) return false;
        if (niche && p.niche !== niche) return false;
        if (status && p.status !== status) return false;
        return true;
      }),
    [search, niche, status],
  );

  return (
    <>
      <PageHeader
        title="Control Panel"
        description="Full partner management — profiles, applications, payouts, and access"
        actions={
          <Button size="sm" variant="secondary">
            ↻ Refresh
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 h-10 flex-1 min-w-[260px] max-w-md">
            <SearchIcon size={14} className="text-fg-muted" />
            <input
              placeholder="Search by partner name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-[13px] text-fg placeholder:text-fg-muted/80"
            />
          </div>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value as Niche | '')}
            className="h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg outline-none"
          >
            <option value="">All Niches</option>
            <option value="medical">Medical</option>
            <option value="trades">Trades</option>
            <option value="coaching">Coaching</option>
            <option value="dental">Dental</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PartnerStatus | '')}
            className="h-10 rounded-lg border border-border bg-bg-elevated px-3 text-[13px] text-fg outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Pending">Pending</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        <p className="text-[12px] text-fg-muted mb-3">{filtered.length} partners found</p>

        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.email} className="grid grid-cols-12 items-center gap-4 px-5 py-4">
                  <div className="col-span-7 flex items-center gap-3 min-w-0">
                    <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                      {p.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-fg truncate">{p.name}</p>
                      <p className="text-[12px] text-fg-muted truncate">{p.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="col-span-2 inline-flex items-center justify-center gap-1.5 h-9 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted"
                  >
                    <ExternalIcon size={12} />
                    View Account
                  </button>
                  <div className="col-span-1">
                    <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full font-medium bg-bg-inverse text-white">
                      {p.status}
                    </span>
                  </div>
                  <div className="col-span-1 text-[12px] text-fg-secondary capitalize">{p.niche}</div>
                  <div className="col-span-1 text-right">
                    <ArrowRightIcon size={14} className="text-fg-muted inline-block" />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
