'use client';
import {
  PageHeader,
  PageBody,
  KpiCard,
  DataTable,
  StatusPill,
  Money,
  Banner,
  Button,
  type Column,
} from '@eazepay/ui/web';
import { settlements, type Settlement } from '../../lib/mock-data';

const columns: Column<Settlement>[] = [
  { key: 'period', header: 'Period', cell: (s) => <span className="font-medium">{s.period}</span> },
  { key: 'apps', header: 'Applications', align: 'right', cell: (s) => s.applications },
  { key: 'gross', header: 'Gross', align: 'right', cell: (s) => <Money cents={s.grossCents} /> },
  { key: 'mdr', header: 'MDR (2.85%)', align: 'right', cell: (s) => <Money cents={s.mdrCents} /> },
  { key: 'net', header: 'Net payout', align: 'right', cell: (s) => <Money cents={s.netCents} className="font-semibold" /> },
  { key: 'status', header: 'Status', cell: (s) =>
    s.status === 'paid' ? <StatusPill tone="success">Paid</StatusPill> :
    s.status === 'in_flight' ? <StatusPill tone="info" dot>RTP in flight</StatusPill> :
    <StatusPill tone="neutral">Scheduled</StatusPill>
  },
  { key: 'paid', header: 'Paid at', align: 'right', cell: (s) => s.paidAt ? <span className="text-[12px] text-fg-muted tabular-nums">{new Date(s.paidAt).toLocaleString('en-US')}</span> : '—' },
];

export default function SettlementsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Settlements' }]}
        title="Settlements"
        description="Daily net payout to your operating account. Reconciled against application records and webhook deliveries."
        actions={<Button>Export reconciliation</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Net paid (MTD)" value={<Money cents={settlements.filter(s => s.status==='paid').reduce((a,s)=>a+s.netCents,0)} compact />} delta={{ value: '+22%', direction: 'up', isGood: true }} />
          <KpiCard label="In flight (RTP)" value={<Money cents={settlements.find(s => s.status==='in_flight')?.netCents ?? 0} compact />} hint="settled to your bank today" />
          <KpiCard label="MDR paid (MTD)" value={<Money cents={settlements.filter(s => s.status==='paid').reduce((a,s)=>a+s.mdrCents,0)} />} hint="285 bps · effective" />
          <KpiCard label="Reconciliation health" value="100%" hint="0 breaks" />
        </div>

        <Banner intent="info" className="mb-4">
          Payouts use RTP same-day when available, with same-day ACH fallback. A signed receipt for each
          transfer is delivered via webhook and stored in your settlements log for 7 years.
        </Banner>

        <DataTable columns={columns} rows={settlements} rowKey={(s) => s.id} />
      </PageBody>
    </>
  );
}
