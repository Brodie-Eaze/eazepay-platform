'use client';
import { useState } from 'react';
import { PageHeader, PageBody, Card, CardBody, Button } from '@eazepay/ui/web';

/**
 * Marketplace Approvals — direct port of Lovable's `/admin/marketplace`
 * (separate from `/marketplace`, which is the public Service browse).
 */

type Status = 'Pending' | 'Live';
interface Listing {
  initials: string;
  name: string;
  category: string;
  email: string;
  status: Status;
  appliedAt: string;
}

const SEED: Listing[] = [
  { initials: 'BR', name: 'BrightPath Consulting',   category: 'Consulting',          email: 'info@brightpathconsulting.com', status: 'Pending', appliedAt: '08/03/2026' },
  { initials: 'PI', name: 'PixelForge Design',       category: 'Branding & Design',   email: 'team@pixelforge.co',            status: 'Pending', appliedAt: '08/03/2026' },
  { initials: 'SE', name: 'SecureVault Compliance',  category: 'Legal & Compliance',  email: 'hello@securevault.io',          status: 'Pending', appliedAt: '08/03/2026' },
  { initials: 'AP', name: 'Apex Tax Solutions',      category: 'Accounting & Tax',    email: 'hello@apextax.example',         status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'PE', name: 'PeakCover Insurance',     category: 'Insurance',           email: 'hello@peakcover.example',       status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'EL', name: 'EliteHire Sales',         category: 'HR & Staffing',       email: 'hello@elitehire.example',       status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'GR', name: 'GrowthPulse Marketing',   category: 'Marketing',           email: 'hello@growthpulse.example',     status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'FO', name: 'Forge Studio',            category: 'Branding & Design',   email: 'hello@forgestudio.example',     status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'NE', name: 'NeuralEdge AI',           category: 'Consulting',          email: 'hello@neuraledge.example',      status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'SH', name: 'ShieldGuard Insurance',   category: 'Insurance',           email: 'hello@shieldguard.example',     status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'TA', name: 'TaxPro Advisors',         category: 'Accounting & Tax',    email: 'hello@taxpro.example',          status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'CO', name: 'ComplianceFirst',         category: 'Legal & Compliance',  email: 'hello@compliancefirst.example', status: 'Live',    appliedAt: '01/03/2026' },
  { initials: 'BR', name: 'BrandForge Creative',     category: 'Branding & Design',   email: 'hello@brandforge.example',      status: 'Live',    appliedAt: '01/03/2026' },
];

export default function MarketplaceApprovalsPage() {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const rows = filter === 'all' ? SEED : SEED.filter((r) => r.status === filter);
  const pendingCount = SEED.filter((r) => r.status === 'Pending').length;
  const liveCount = SEED.filter((r) => r.status === 'Live').length;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Marketplace Approvals"
        description="Review and approve businesses requesting to list on the Marketplace"
      />
      <PageBody>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={
              'text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ' +
              (filter === 'all' ? 'bg-[#0d1530] text-white' : 'bg-bg-muted text-fg-secondary')
            }
          >
            {SEED.length} Total
          </button>
          <button
            type="button"
            onClick={() => setFilter('Pending')}
            className={
              'text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ' +
              (filter === 'Pending' ? 'bg-[#0d1530] text-white' : 'bg-bg-muted text-fg-secondary')
            }
          >
            {pendingCount} Pending
          </button>
          <button
            type="button"
            onClick={() => setFilter('Live')}
            className={
              'text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ' +
              (filter === 'Live' ? 'bg-[#0d1530] text-white' : 'bg-bg-muted text-fg-secondary')
            }
          >
            {liveCount} Live
          </button>
        </div>

        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((m, i) => (
                <li key={i} className="grid grid-cols-12 items-center gap-4 px-5 py-4 hover:bg-bg-muted/40">
                  <div className="col-span-8 flex items-center gap-3 min-w-0">
                    <span className="size-10 rounded-full bg-bg-muted text-fg-secondary flex items-center justify-center font-semibold text-[12px] shrink-0">
                      {m.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-fg truncate flex items-center gap-2">
                        {m.name}
                        <span
                          className={
                            'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ' +
                            (m.status === 'Pending'
                              ? 'bg-bg-muted text-fg-secondary border border-border'
                              : 'bg-bg-inverse text-white')
                          }
                        >
                          {m.status}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg-muted text-fg-secondary shrink-0">
                          {m.category}
                        </span>
                      </p>
                      <p className="text-[12px] text-fg-muted truncate mt-0.5">{m.email}</p>
                    </div>
                  </div>
                  <div className="col-span-2 text-[12px] text-fg-muted">{m.appliedAt}</div>
                  <div className="col-span-2 text-right">
                    {m.status === 'Pending' ? (
                      <Button size="sm">Review</Button>
                    ) : (
                      <Button size="sm" variant="secondary">
                        View
                      </Button>
                    )}
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
