'use client';
import { useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  KpiCard,
  Button,
  StatusPill,
  Input,
  Select,
  DataTable,
  Money,
  Tabs,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import { applications, type ApplicationRow } from '../../../../lib/master-data';

const slugToBrand = (slug: string): BrandCode | null => BRAND_ORDER.find((c) => BRANDS[c].slug === slug) ?? null;

const productCodeForBrand = (b: BrandCode): 'med-pay' | 'trade-pay' | 'coach-pay' | null => {
  if (b === 'medpay') return 'med-pay';
  if (b === 'tradepay') return 'trade-pay';
  if (b === 'coachpay') return 'coach-pay';
  return null;
};

const statusPill = (s: ApplicationRow['status']) => {
  if (s === 'funded') return <StatusPill tone="success">Funded</StatusPill>;
  if (s === 'approved') return <StatusPill tone="success">Approved</StatusPill>;
  if (s === 'declined') return <StatusPill tone="danger">Declined</StatusPill>;
  if (s === 'in_review') return <StatusPill tone="warning" dot>In review</StatusPill>;
  return <StatusPill tone="info" dot>Submitted</StatusPill>;
};

export default function VerticalApplicationsPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const router = useRouter();
  const brand = slugToBrand(brandSlug);
  if (!brand) notFound();
  const spec = BRANDS[brand];

  const code = productCodeForBrand(brand);
  const rows = code ? applications.filter((a) => a.product === code) : [];

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');

  const filtered = rows.filter((a) => {
    if (tab !== 'all' && a.status !== tab) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        a.customer.toLowerCase().includes(q) ||
        a.partner.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.lender.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tabs = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'funded', label: 'Funded', count: rows.filter((a) => a.status === 'funded').length },
    { key: 'approved', label: 'Approved', count: rows.filter((a) => a.status === 'approved').length },
    { key: 'submitted', label: 'Submitted', count: rows.filter((a) => a.status === 'submitted').length },
    { key: 'declined', label: 'Declined', count: rows.filter((a) => a.status === 'declined').length },
  ];

  const columns: Column<ApplicationRow>[] = [
    { key: 'customer', header: 'Customer', cell: (a) => (
      <div>
        <div className="font-medium">{a.customer}</div>
        <div className="text-[12px] text-fg-muted">{a.customerEmail}</div>
      </div>
    )},
    { key: 'partner', header: 'Partner', cell: (a) => <span className="text-[13px]">{a.partner}</span> },
    { key: 'amount', header: 'Amount', align: 'right', cell: (a) => <Money cents={a.amountCents} noFractions /> },
    { key: 'fico', header: 'Credit', align: 'right', cell: (a) => <span className="tabular-nums">{a.fico}</span> },
    { key: 'lender', header: 'Lender', cell: (a) => <span className="text-[13px]">{a.lender}</span> },
    { key: 'status', header: 'Status', cell: (a) => statusPill(a.status) },
    { key: 'date', header: 'Date', align: 'right', cell: (a) => <span className="text-[12px] text-fg-muted tabular-nums">{a.date}</span> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master', href: '/' }, { label: spec.name, href: `/v/${spec.slug}` }, { label: 'Applications' }]}
        title={`${spec.name} applications`}
        description={`Every consumer application routed to or originated from ${spec.name} this month.`}
        actions={<Button>Export CSV</Button>}
        meta={<><StatusPill tone="accent">{spec.name}</StatusPill><StatusPill tone="neutral">{rows.length} total</StatusPill></>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Funded" value={rows.filter((a) => a.status === 'funded').length} />
          <KpiCard label="Approved" value={rows.filter((a) => a.status === 'approved').length} />
          <KpiCard label="Submitted" value={rows.filter((a) => a.status === 'submitted').length} />
          <KpiCard label="Funded vol" value={<Money cents={rows.filter((a) => a.status === 'funded').reduce((a, b) => a + b.amountCents, 0)} compact />} />
        </div>

        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Input
              leadingIcon={<SearchIcon size={14} />}
              placeholder="Search by customer, partner, lender…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="lg:col-span-2"
            />
            <Select
              label=""
              defaultValue=""
              options={[
                { value: '', label: 'All Months' },
                { value: '2026-05', label: 'May 2026' },
                { value: '2026-04', label: 'April 2026' },
                { value: '2026-03', label: 'March 2026' },
              ]}
            />
          </div>
        </Card>

        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />
        <Card>
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(a) => a.id}
            dense
            empty={`No ${spec.name} applications match.`}
            onRowClick={(a) => router.push(`/v/${spec.slug}/applications/${a.id}`)}
          />
        </Card>
      </PageBody>
    </>
  );
}
