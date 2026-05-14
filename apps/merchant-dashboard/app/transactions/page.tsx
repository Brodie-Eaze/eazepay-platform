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
  Input,
  Select,
  type Column,
  SearchIcon,
} from '@eazepay/ui/web';

type Rail = 'card' | 'ez_check' | 'financed';

interface Txn {
  id: string;
  rail: Rail;
  customer: string;
  description: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  at: string;
  ref?: string;
}

const txns: Txn[] = [
  { id: 'tx_8KvR2NQpLm', rail: 'card', customer: 'Sofia P.', description: 'Solar PV system · final invoice', grossCents: 2_640_000, feeCents: 78_180, netCents: 2_561_820, status: 'succeeded', at: '2026-05-04T19:01Z', ref: 'micamp_ch_8K…' },
  { id: 'tx_R2NQp8KvRT', rail: 'financed', customer: 'Julian M.', description: 'Solar PV · financed via TradePay', grossCents: 1_950_000, feeCents: 55_575, netCents: 1_894_425, status: 'succeeded', at: '2026-05-04T18:46Z', ref: 'app_4nqLkR2vTjW' },
  { id: 'tx_KvRT2NpQ8m', rail: 'ez_check', customer: 'Marcus T.', description: 'Down payment · 14.2 kW system', grossCents: 250_000, feeCents: 4_375, netCents: 245_625, status: 'pending', at: '2026-05-04T17:33Z', ref: 'highsale_rcc_R2…' },
  { id: 'tx_NQpRT8mKvL', rail: 'card', customer: 'Elena H.', description: 'Service maintenance · annual', grossCents: 48_000, feeCents: 1_730, netCents: 46_270, status: 'succeeded', at: '2026-05-04T15:18Z', ref: 'micamp_ch_NQ…' },
  { id: 'tx_QpRT8mKvLN', rail: 'card', customer: 'Priya S.', description: 'Solar PV partial · refund', grossCents: -150_000, feeCents: -4_500, netCents: -145_500, status: 'refunded', at: '2026-05-04T14:02Z', ref: 'micamp_rf_Qp…' },
  { id: 'tx_pRT8mKvLNQ', rail: 'ez_check', customer: 'Devon L.', description: 'Battery upgrade · 13.5 kWh', grossCents: 1_350_000, feeCents: 6_500, netCents: 1_343_500, status: 'succeeded', at: '2026-05-04T12:08Z', ref: 'highsale_web_pR…' },
  { id: 'tx_RT8mKvLNQp', rail: 'ez_check', customer: 'Anika R.', description: 'Permit fee — returned', grossCents: 0, feeCents: 25_00, netCents: -25_00, status: 'failed', at: '2026-05-04T09:51Z', ref: 'highsale_rcc_RT…' },
];

const railPill = (r: Rail) => {
  if (r === 'card') return <StatusPill tone="accent">MiCamp · card</StatusPill>;
  if (r === 'ez_check') return <StatusPill tone="info">HighSale · EZ Check</StatusPill>;
  return <StatusPill tone="success">TradePay · financed</StatusPill>;
};

const statusPill = (s: Txn['status']) => {
  if (s === 'succeeded') return <StatusPill tone="success">Succeeded</StatusPill>;
  if (s === 'pending') return <StatusPill tone="warning" dot>Pending</StatusPill>;
  if (s === 'failed') return <StatusPill tone="danger">Failed</StatusPill>;
  return <StatusPill tone="neutral">Refunded</StatusPill>;
};

const tabs = [
  { key: 'all', label: 'All rails', count: txns.length },
  { key: 'card', label: 'MiCamp · card', count: txns.filter((t) => t.rail === 'card').length },
  { key: 'ez_check', label: 'HighSale · EZ Check', count: txns.filter((t) => t.rail === 'ez_check').length },
  { key: 'financed', label: 'TradePay · financed', count: txns.filter((t) => t.rail === 'financed').length },
];

export default function TransactionsPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const filtered = txns.filter((t) => {
    if (tab !== 'all' && t.rail !== tab) return false;
    if (q) {
      const ql = q.toLowerCase();
      return (
        t.id.toLowerCase().includes(ql) ||
        t.customer.toLowerCase().includes(ql) ||
        t.description.toLowerCase().includes(ql) ||
        (t.ref ?? '').toLowerCase().includes(ql)
      );
    }
    return true;
  });

  const cardTotal = txns.filter((t) => t.rail === 'card').reduce((a, t) => a + t.grossCents, 0);
  const checkTotal = txns.filter((t) => t.rail === 'ez_check').reduce((a, t) => a + Math.max(0, t.grossCents), 0);
  const financedTotal = txns.filter((t) => t.rail === 'financed').reduce((a, t) => a + t.grossCents, 0);

  const columns: Column<Txn>[] = [
    { key: 'who', header: 'Customer', cell: (t) => (
      <div>
        <div className="font-medium">{t.customer}</div>
        <div className="text-[12px] text-fg-muted">{t.description}</div>
      </div>
    )},
    { key: 'rail', header: 'Rail', cell: (t) => railPill(t.rail) },
    { key: 'ref', header: 'Reference', cell: (t) => <span className="font-mono text-[11px] text-fg-muted">{t.ref ?? t.id}</span> },
    { key: 'gross', header: 'Gross', align: 'right', cell: (t) => <Money cents={t.grossCents} showSign={t.grossCents !== 0} /> },
    { key: 'fee', header: 'Fee', align: 'right', cell: (t) => <Money cents={t.feeCents} /> },
    { key: 'net', header: 'Net', align: 'right', cell: (t) => <Money cents={t.netCents} className="font-semibold" /> },
    { key: 'status', header: 'Status', cell: (t) => statusPill(t.status) },
    { key: 'at', header: 'When', align: 'right', cell: (t) => <span className="text-[12px] text-fg-muted tabular-nums">{new Date(t.at).toLocaleString('en-US')}</span> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Transactions' }]}
        title="Transactions"
        description="Card payments via MiCamp, EZ Check via HighSale, and EazePay-financed sales — unified in one place."
        actions={<Button>Export CSV</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Gross (today)" value={<Money cents={cardTotal + checkTotal + financedTotal} compact />} delta={{ value: '+14%', direction: 'up', isGood: true }} />
          <KpiCard label="Cards (MiCamp)" value={<Money cents={cardTotal} compact />} hint="Visa · MC · Disc · Amex" />
          <KpiCard label="EZ Check (HighSale)" value={<Money cents={checkTotal} compact />} hint="RCC + Web-debit" />
          <KpiCard label="Financed (TradePay)" value={<Money cents={financedTotal} compact />} hint="Same-day RTP" />
        </div>

        <Card padded className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Input leadingIcon={<SearchIcon size={14} />} placeholder="Search ID, customer, reference…" value={q} onChange={(e) => setQ(e.target.value)} className="lg:col-span-2" />
            <Select label="" defaultValue="" options={[
              { value: '', label: 'Any status' },
              { value: 'succeeded', label: 'Succeeded' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'refunded', label: 'Refunded' },
            ]} />
          </div>
        </Card>

        <Tabs items={tabs} active={tab} onChange={setTab} className="mb-3" />
        <DataTable columns={columns} rows={filtered} rowKey={(t) => t.id} />
      </PageBody>
    </>
  );
}
