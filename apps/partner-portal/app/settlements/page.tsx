'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  KpiCard,
  Card,
  CardHeader,
  CardBody,
  DataTable,
  StatusPill,
  Money,
  Button,
  Banner,
  type Column,
} from '@eazepay/ui/web';

interface Settlement {
  id: string;
  period: string;
  grossCents: number;
  servicingFeeCents: number;
  netCents: number;
  status: 'paid' | 'in_flight' | 'scheduled';
  paidAt: string;
}

const settlements: Settlement[] = [
  {
    id: 'stl_2026_05_w1',
    period: 'May 1 – May 7, 2026',
    grossCents: 1_212_400_00,
    servicingFeeCents: 18_186_00,
    netCents: 1_194_214_00,
    status: 'in_flight',
    paidAt: '2026-05-09',
  },
  {
    id: 'stl_2026_04_w4',
    period: 'Apr 22 – Apr 30, 2026',
    grossCents: 1_487_120_00,
    servicingFeeCents: 22_307_00,
    netCents: 1_464_813_00,
    status: 'paid',
    paidAt: '2026-05-02',
  },
  {
    id: 'stl_2026_04_w3',
    period: 'Apr 15 – Apr 21, 2026',
    grossCents: 1_312_894_00,
    servicingFeeCents: 19_693_00,
    netCents: 1_293_201_00,
    status: 'paid',
    paidAt: '2026-04-24',
  },
  {
    id: 'stl_2026_04_w2',
    period: 'Apr 8 – Apr 14, 2026',
    grossCents: 1_104_312_00,
    servicingFeeCents: 16_565_00,
    netCents: 1_087_747_00,
    status: 'paid',
    paidAt: '2026-04-17',
  },
  {
    id: 'stl_2026_04_w1',
    period: 'Apr 1 – Apr 7, 2026',
    grossCents: 1_021_874_00,
    servicingFeeCents: 15_328_00,
    netCents: 1_006_546_00,
    status: 'paid',
    paidAt: '2026-04-10',
  },
];

const columns: Column<Settlement>[] = [
  { key: 'period', header: 'Period', cell: (s) => <span className="font-medium">{s.period}</span> },
  { key: 'gross', header: 'Gross', align: 'right', cell: (s) => <Money cents={s.grossCents} /> },
  {
    key: 'fee',
    header: 'Servicing fee',
    align: 'right',
    cell: (s) => <Money cents={s.servicingFeeCents} />,
  },
  {
    key: 'net',
    header: 'Net to partner',
    align: 'right',
    cell: (s) => <Money cents={s.netCents} className="font-semibold" />,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (s) =>
      s.status === 'paid' ? (
        <StatusPill tone="success">Paid</StatusPill>
      ) : s.status === 'in_flight' ? (
        <StatusPill tone="info" dot>
          In flight (RTP)
        </StatusPill>
      ) : (
        <StatusPill tone="neutral">Scheduled</StatusPill>
      ),
  },
  {
    key: 'paidAt',
    header: 'Settlement date',
    align: 'right',
    cell: (s) => <span className="text-fg-muted text-[12px] tabular-nums">{s.paidAt}</span>,
  },
];

export default function SettlementsPage() {
  const [toast, setToast] = useState<string | null>(null);
  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }
  function exportRecon() {
    if (typeof window !== 'undefined') {
      try {
        const tsv = [
          'period\tgross_cents\tfee_cents\tnet_cents\tstatus\tpaid_at',
          ...settlements.map(
            (s) =>
              `${s.period}\t${s.grossCents}\t${s.servicingFeeCents}\t${s.netCents}\t${s.status}\t${s.paidAt}`,
          ),
        ].join('\n');
        const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settlements-${new Date().toISOString().slice(0, 10)}.tsv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        /* fall through */
      }
    }
    flash(`Exported ${settlements.length} settlement period${settlements.length === 1 ? '' : 's'}`);
  }
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Master' },
          { label: 'Applications', href: '/applications' },
          { label: 'Settlements' },
        ]}
        title="Funding & settlements"
        description="Weekly net settlement to your operating account. Reconciled against the loan tape line-by-line; full breakdown on each row."
        actions={<Button onClick={exportRecon}>Export reconciliation</Button>}
      />
      <PageBody>
        {/* Tab strip mirrors /applications so the operator can flip
            between the two views with one click. The standalone
            "Settlements" sidebar entry was removed — both surfaces
            now hang off Applications. */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          <Link
            href="/applications"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-fg-secondary hover:text-fg transition border-b-2 border-transparent hover:border-border-strong -mb-px"
          >
            Applications
          </Link>
          <span
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-fg border-b-2 border-fg -mb-px"
            aria-current="page"
          >
            Settlements
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="Net settled (MTD)"
            value={<Money cents={2_487_120_00 + 1_487_120_00} compact />}
            delta={{ value: '+18%', direction: 'up', isGood: true }}
          />
          <KpiCard
            label="In-flight"
            value={<Money cents={1_194_214_00} compact />}
            hint="ACH delivery 2026-05-09"
          />
          <KpiCard
            label="Servicing fee (MTD)"
            value={<Money cents={37_493_00} />}
            delta={{ value: '+1.5%', direction: 'flat' }}
          />
          <KpiCard
            label="Reconciliation health"
            value="100%"
            hint="0 unresolved breaks in last 90d"
          />
        </div>

        <Banner intent="info" className="mb-4">
          Settlement uses your bank-of-record's RTP rails (Cross River) with same-day ACH fallback.
          A signed receipt is sent to your S3 bucket on each transfer and recorded in the audit
          chain.
        </Banner>

        <DataTable columns={columns} rows={settlements} rowKey={(s) => s.id} />
      </PageBody>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
