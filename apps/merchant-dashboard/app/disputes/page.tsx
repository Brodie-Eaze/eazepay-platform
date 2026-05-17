'use client';
import { useState } from 'react';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  DataTable,
  StatusPill,
  Money,
  Button,
  Tabs,
  KpiCard,
  Banner,
  type Column,
} from '@eazepay/ui/web';

type Rail = 'card' | 'ez_check';

interface Dispute {
  id: string;
  rail: Rail;
  txnId: string;
  customer: string;
  reason: string;
  amountCents: number;
  status: 'needs_response' | 'under_review' | 'won' | 'lost' | 'expired';
  openedAt: string;
  responseDueAt?: string;
}

const disputes: Dispute[] = [
  {
    id: 'dsp_8KvR2NQp',
    rail: 'card',
    txnId: 'tx_8KvR2NQpLm',
    customer: 'Sofia P.',
    reason: 'Product not received',
    amountCents: 264_000_0,
    status: 'needs_response',
    openedAt: '2026-05-02T10:21Z',
    responseDueAt: '2026-05-09T23:59Z',
  },
  {
    id: 'dsp_R2NQp8KvL',
    rail: 'card',
    txnId: 'tx_NQpRT8mKvL',
    customer: 'Elena H.',
    reason: 'Unauthorized transaction',
    amountCents: 48_000,
    status: 'under_review',
    openedAt: '2026-04-28T14:18Z',
  },
  {
    id: 'dsp_NQp8KvR2T',
    rail: 'ez_check',
    txnId: 'tx_RT8mKvLNQp',
    customer: 'Anika R.',
    reason: 'Insufficient funds (R01)',
    amountCents: 25_00,
    status: 'lost',
    openedAt: '2026-04-22T08:00Z',
  },
  {
    id: 'dsp_p8KvR2NQT',
    rail: 'card',
    txnId: 'tx_zM3vP2NQpL',
    customer: 'Devon L.',
    reason: 'Service issue',
    amountCents: 84_500,
    status: 'won',
    openedAt: '2026-04-12T11:14Z',
  },
];

const railPill = (r: Rail) =>
  r === 'card' ? (
    <StatusPill tone="accent">MiCamp · card</StatusPill>
  ) : (
    <StatusPill tone="info">HighSale · EZ Check</StatusPill>
  );

const statusPill = (s: Dispute['status']) => {
  if (s === 'needs_response')
    return (
      <StatusPill tone="danger" dot>
        Needs response
      </StatusPill>
    );
  if (s === 'under_review')
    return (
      <StatusPill tone="warning" dot>
        Under review
      </StatusPill>
    );
  if (s === 'won') return <StatusPill tone="success">Won</StatusPill>;
  if (s === 'lost') return <StatusPill tone="danger">Lost</StatusPill>;
  return <StatusPill tone="neutral">Expired</StatusPill>;
};

const tabs = [
  { key: 'all', label: 'All', count: disputes.length },
  {
    key: 'needs_response',
    label: 'Needs response',
    count: disputes.filter((d) => d.status === 'needs_response').length,
  },
  {
    key: 'under_review',
    label: 'Under review',
    count: disputes.filter((d) => d.status === 'under_review').length,
  },
  {
    key: 'closed',
    label: 'Closed',
    count: disputes.filter(
      (d) => d.status === 'won' || d.status === 'lost' || d.status === 'expired',
    ).length,
  },
];

export default function DisputesPage() {
  const [tab, setTab] = useState('all');

  const filtered = disputes.filter((d) => {
    if (tab === 'all') return true;
    if (tab === 'closed')
      return d.status === 'won' || d.status === 'lost' || d.status === 'expired';
    return d.status === tab;
  });

  const openCount = disputes.filter(
    (d) => d.status === 'needs_response' || d.status === 'under_review',
  ).length;
  const wonRate = (() => {
    const closed = disputes.filter((d) => d.status === 'won' || d.status === 'lost');
    if (closed.length === 0) return '—';
    return `${((disputes.filter((d) => d.status === 'won').length / closed.length) * 100).toFixed(0)}%`;
  })();
  const liability = disputes
    .filter((d) => d.status === 'needs_response' || d.status === 'under_review')
    .reduce((a, d) => a + d.amountCents, 0);

  const columns: Column<Dispute>[] = [
    {
      key: 'who',
      header: 'Customer',
      cell: (d) => (
        <div>
          <div className="font-medium">{d.customer}</div>
          <div className="font-mono text-[11px] text-fg-muted">{d.txnId}</div>
        </div>
      ),
    },
    { key: 'rail', header: 'Rail', cell: (d) => railPill(d.rail) },
    {
      key: 'reason',
      header: 'Reason',
      cell: (d) => <span className="text-[13px]">{d.reason}</span>,
    },
    {
      key: 'amount',
      header: 'Disputed',
      align: 'right',
      cell: (d) => <Money cents={d.amountCents} />,
    },
    { key: 'status', header: 'Status', cell: (d) => statusPill(d.status) },
    {
      key: 'opened',
      header: 'Opened',
      align: 'right',
      cell: (d) => (
        <span className="text-[12px] text-fg-muted tabular-nums">
          {new Date(d.openedAt).toLocaleDateString('en-US')}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Response due',
      align: 'right',
      cell: (d) =>
        d.responseDueAt ? (
          <span className="text-[12px] text-warning tabular-nums">
            {new Date(d.responseDueAt).toLocaleDateString('en-US')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (d) =>
        d.status === 'needs_response' ? (
          <Button size="sm">Respond</Button>
        ) : (
          <Button size="sm" variant="ghost">
            View
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Disputes' }]}
        title="Disputes & chargebacks"
        description="Card chargebacks via MiCamp and ACH returns / unauthorized debits via HighSale, in one queue."
        actions={<Button>Download evidence pack</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Open disputes" value={openCount} hint="needs response + under review" />
          <KpiCard
            label="Liability (open)"
            value={<Money cents={liability} compact />}
            hint="amount at risk"
          />
          <KpiCard label="Win rate (90d)" value={wonRate} hint="won / (won + lost)" />
          <KpiCard
            label="Chargeback ratio"
            value="0.18%"
            delta={{ value: '-0.04pp', direction: 'down', isGood: true }}
            hint="cards · 30-day rolling"
          />
        </div>

        <Banner intent="warning" className="mb-4" title="1 dispute needs a response by 2026-05-09">
          Submit evidence (delivery confirmation, signed contract, communication log) before the
          deadline. We auto-package and submit via MiCamp on your behalf once you click Respond.
        </Banner>

        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />
        <DataTable columns={columns} rows={filtered} rowKey={(d) => d.id} />
      </PageBody>
    </>
  );
}
