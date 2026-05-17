'use client';
import { useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  DataTable,
  Button,
  StatusPill,
  Input,
  Select,
  Tabs,
  Money,
  Apr,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';
import { applications, type MerchantApplication, fmtDate } from '../../lib/mock-data';

const tabs = [
  { key: 'all', label: 'All', count: applications.length },
  {
    key: 'funded',
    label: 'Funded',
    count: applications.filter((a) => a.status === 'funded').length,
  },
  {
    key: 'approved',
    label: 'Approved',
    count: applications.filter((a) => a.status === 'approved').length,
  },
  {
    key: 'in_progress',
    label: 'In progress',
    count: applications.filter((a) => a.status === 'in_progress').length,
  },
  {
    key: 'declined',
    label: 'Declined',
    count: applications.filter((a) => a.status === 'declined').length,
  },
];

const status = (s: MerchantApplication['status']) => {
  if (s === 'funded') return <StatusPill tone="success">Funded</StatusPill>;
  if (s === 'approved') return <StatusPill tone="success">Approved</StatusPill>;
  if (s === 'declined') return <StatusPill tone="danger">Declined</StatusPill>;
  if (s === 'expired') return <StatusPill tone="neutral">Expired</StatusPill>;
  return (
    <StatusPill tone="info" dot>
      In progress
    </StatusPill>
  );
};

export default function ApplicationsPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const filtered = applications.filter((a) => {
    if (tab !== 'all' && a.status !== tab) return false;
    if (q) {
      const ql = q.toLowerCase();
      return a.id.toLowerCase().includes(ql) || a.customerName.toLowerCase().includes(ql);
    }
    return true;
  });

  const columns: Column<MerchantApplication>[] = [
    {
      key: 'app',
      header: 'Customer',
      width: '24%',
      cell: (a) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-bg-muted flex items-center justify-center text-[11px] font-semibold text-fg-secondary">
            {a.customerName
              .split(' ')
              .map((s) => s[0])
              .join('')}
          </div>
          <div>
            <div className="font-medium">{a.customerName}</div>
            <div className="font-mono text-[11px] text-fg-muted">{a.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact',
      cell: (a) => (
        <div>
          <div className="text-[13px]">{a.customerEmail}</div>
          <div className="text-[12px] text-fg-muted">{a.state}</div>
        </div>
      ),
    },
    {
      key: 'sale',
      header: 'Sale',
      align: 'right',
      cell: (a) => <Money cents={a.saleAmountCents} noFractions />,
    },
    {
      key: 'financed',
      header: 'Financed',
      align: 'right',
      cell: (a) =>
        a.approvedCents ? (
          <Money cents={a.approvedCents} noFractions />
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: 'apr',
      header: 'APR',
      align: 'right',
      cell: (a) => (a.aprBps ? <Apr bps={a.aprBps} /> : <span className="text-fg-muted">—</span>),
    },
    {
      key: 'lender',
      header: 'Lender',
      cell: (a) => <span className="text-[12px]">{a.lenderOfRecord ?? '—'}</span>,
    },
    { key: 'status', header: 'Status', cell: (a) => status(a.status) },
    {
      key: 'when',
      header: 'When',
      align: 'right',
      cell: (a) => (
        <span className="text-[12px] text-fg-muted tabular-nums">
          {fmtDate(a.decisionAt ?? a.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Applications' }]}
        title="Applications"
        description="Everyone who started an application from your links. Click to see status, lender, and settlement linkage."
        actions={<Button>Export CSV</Button>}
      />
      <PageBody>
        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Input
              leadingIcon={<SearchIcon size={14} />}
              placeholder="Search by customer or app ID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="lg:col-span-2"
            />
            <Select
              label=""
              defaultValue=""
              options={[
                { value: '', label: 'All states' },
                ...['TX', 'CA', 'GA', 'WA', 'AZ'].map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>
        </Card>
        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />
        <DataTable columns={columns} rows={filtered} rowKey={(a) => a.id} />
      </PageBody>
    </>
  );
}
