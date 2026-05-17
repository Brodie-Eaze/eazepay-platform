'use client';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  StatusPill,
  Banner,
  Button,
  DataTable,
  DataRow,
  Sparkline,
  type Column,
} from '@eazepay/ui/web';
import { lenderHealth } from '../../lib/mock-data';

type Lender = (typeof lenderHealth)[number];

const columns: Column<Lender>[] = [
  {
    key: 'name',
    header: 'Lender / product',
    cell: (l) => (
      <div className="flex items-center gap-3">
        <div
          className="size-2.5 rounded-full"
          style={{
            background:
              l.status === 'ok'
                ? 'rgb(var(--success))'
                : l.status === 'degraded'
                  ? 'rgb(var(--warning))'
                  : 'rgb(var(--fg-muted))',
          }}
        />
        <div>
          <div className="font-medium">{l.name}</div>
          <div className="text-[12px] text-fg-muted">Tier {l.tier}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (l) =>
      l.status === 'ok' ? (
        <StatusPill tone="success">Healthy</StatusPill>
      ) : l.status === 'degraded' ? (
        <StatusPill tone="warning">Degraded</StatusPill>
      ) : (
        <StatusPill tone="neutral">Paused</StatusPill>
      ),
  },
  {
    key: 'p95',
    header: 'p95',
    align: 'right',
    cell: (l) => <span className="tabular-nums">{l.p95Ms} ms</span>,
  },
  {
    key: 'err',
    header: 'Error rate',
    align: 'right',
    cell: (l) => <span className="tabular-nums">{(l.errorRate * 100).toFixed(2)}%</span>,
  },
  {
    key: 'approval',
    header: 'Approval',
    align: 'right',
    cell: (l) => <span className="tabular-nums">{(l.approvalRate * 100).toFixed(0)}%</span>,
  },
  {
    key: 'trend',
    header: 'Trend (24h)',
    cell: () => (
      <div className="text-accent w-24">
        <Sparkline
          data={[612, 580, 620, 590, 540, 580, 612, 660, 700, 680, 612]}
          height={24}
          width={120}
        />
      </div>
    ),
  },
  {
    key: 'action',
    header: '',
    align: 'right',
    cell: () => (
      <Button size="sm" variant="ghost">
        Inspect
      </Button>
    ),
  },
];

export default function LendersPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Lender performance' }]}
        title="Lender performance"
        description="Live adapter health, decision latency, error rates, and approval distributions. Drill into any lender for vintage cuts and circuit breaker history."
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Adapters live" value="5 of 6" hint="Bluemark Subprime paused" />
          <KpiCard
            label="Avg p95 (all)"
            value="528ms"
            delta={{ value: '-43ms', direction: 'down', isGood: true }}
          />
          <KpiCard label="Routing fairness" value="0.92" hint="Gini · lower is fairer" />
          <KpiCard
            label="BuzzPay book usage"
            value="96%"
            delta={{ value: '+4pp', direction: 'up', isGood: false }}
            hint="Q2 vintage"
          />
        </div>

        <Banner intent="warning" className="mb-4" title="Sterling Direct circuit breaker open">
          Auto-excluded from routing while in degraded state. Half-open probe scheduled in 30s. PD
          page sent.
        </Banner>

        <DataTable columns={columns} rows={lenderHealth} rowKey={(l) => l.name} />
      </PageBody>
    </>
  );
}
