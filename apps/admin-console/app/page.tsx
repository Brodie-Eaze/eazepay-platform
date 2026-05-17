import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  KpiCard,
  Card,
  CardHeader,
  CardBody,
  Banner,
  Button,
  StatusPill,
  DataRow,
  Sparkline,
  Money,
  ArrowRightIcon,
  AlertIcon,
  ChartIcon,
  FlagIcon,
  ShieldIcon,
  BoltIcon,
  CheckIcon,
} from '@eazepay/ui/web';
import { queueKpis, queueApplications, lenderHealth, riskFlags } from '../lib/mock-data';

export default function AdminHome() {
  const newest = queueApplications.slice(0, 4);
  const trend = [
    21, 24, 18, 22, 27, 31, 28, 24, 19, 26, 33, 38, 35, 29, 31, 36, 41, 39, 42, 38, 33, 36, 41, 45,
    48, 44, 49, 47,
  ];
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin' }, { label: 'Overview' }]}
        title="Operations overview"
        description="Live state of the orchestration engine, underwriting queue, and compliance posture. Read-only by default; mutations require role + ticket reason."
        meta={
          <>
            <StatusPill tone="success" dot>
              All systems normal
            </StatusPill>
            <StatusPill tone="warning" dot>
              Sterling Direct degraded
            </StatusPill>
            <StatusPill tone="info">Policy orch_v_2026_05_a</StatusPill>
          </>
        }
        actions={
          <>
            <Link href="/queue">
              <Button variant="ghost" leadingIcon={<ChartIcon size={16} />}>
                Open queue
              </Button>
            </Link>
            <Button leadingIcon={<BoltIcon size={16} />}>Open lender inspector</Button>
          </>
        }
      />
      <PageBody>
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="In queue"
            value={queueKpis.inQueue}
            delta={queueKpis.inQueueDelta}
            series={trend}
            hint="vs. prior 4-hour rolling"
          />
          <KpiCard
            label="UW time p95"
            value={queueKpis.underwritingP95}
            delta={queueKpis.underwritingP95Delta}
            hint="submit → decision"
          />
          <KpiCard
            label="Funded today"
            value={queueKpis.fundedToday}
            delta={queueKpis.fundedTodayDelta}
            hint="net of partner-bank fees"
          />
          <KpiCard
            label="Fraud rate (7d)"
            value={queueKpis.fraudRate7d}
            delta={queueKpis.fraudRateDelta}
            hint="raised flag / applications"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Newest applications"
              description="Latest 4 from the queue. Click to open the underwriting workspace."
              action={
                <Link href="/queue">
                  <Button variant="ghost" size="sm" trailingIcon={<ArrowRightIcon size={14} />}>
                    View queue
                  </Button>
                </Link>
              }
            />
            <CardBody padded={false}>
              <div className="divide-y divide-border">
                {newest.map((a) => (
                  <Link
                    key={a.id}
                    href={`/queue/${a.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-bg-muted/40 transition-colors"
                  >
                    <div className="size-9 rounded-full bg-bg-muted flex items-center justify-center text-[12px] font-semibold text-fg-secondary">
                      {a.applicantInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium">
                        <Money cents={a.requestedCents} noFractions /> · {a.termMonths}mo ·{' '}
                        {a.category.replace('_', ' ')}
                      </div>
                      <div className="text-[12px] text-fg-muted">
                        {a.state} · {a.channel === 'merchant' ? a.merchantName : 'Direct'} · risk{' '}
                        {a.riskScore}
                      </div>
                    </div>
                    {a.hold && (
                      <StatusPill tone="danger" icon={<AlertIcon size={11} />}>
                        {a.hold.toUpperCase()} hold
                      </StatusPill>
                    )}
                    {a.status === 'manual_review' && (
                      <StatusPill tone="warning">Manual review</StatusPill>
                    )}
                    {a.status === 'offers_presented' && (
                      <StatusPill tone="info">Offers presented</StatusPill>
                    )}
                    {a.status === 'funded' && <StatusPill tone="success">Funded</StatusPill>}
                    {a.status === 'declined' && <StatusPill tone="danger">Declined</StatusPill>}
                    {a.status === 'approved' && <StatusPill tone="success">Approved</StatusPill>}
                    {a.status === 'docs_required' && (
                      <StatusPill tone="warning">Docs required</StatusPill>
                    )}
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Lender adapters"
              description="Live health from the orchestration engine."
            />
            <CardBody className="space-y-3">
              {lenderHealth.map((l) => (
                <div key={l.name} className="flex items-center gap-3">
                  <div
                    className="size-2 rounded-full shrink-0"
                    style={{
                      background:
                        l.status === 'ok'
                          ? 'rgb(var(--success))'
                          : l.status === 'degraded'
                            ? 'rgb(var(--warning))'
                            : 'rgb(var(--fg-muted))',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{l.name}</div>
                    <div className="text-[11px] text-fg-muted">
                      Tier {l.tier} · p95 {l.p95Ms}ms · err {(l.errorRate * 100).toFixed(2)}%
                    </div>
                  </div>
                  <span className="text-[11px] text-fg-muted tabular-nums">
                    {(l.approvalRate * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <Card>
            <CardHeader
              title="Open risk flags"
              description="Velocity, fraud signals, and sanctions-related events worth a second look."
              action={
                <Link href="/risk">
                  <Button variant="ghost" size="sm" trailingIcon={<ArrowRightIcon size={14} />}>
                    All flags
                  </Button>
                </Link>
              }
            />
            <CardBody className="space-y-3">
              {riskFlags.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-3 bg-bg-muted/30">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[12px]">{r.flagType}</span>
                    <StatusPill
                      tone={
                        r.severity === 'high'
                          ? 'danger'
                          : r.severity === 'medium'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {r.severity}
                    </StatusPill>
                  </div>
                  <div className="text-[12px] text-fg-secondary">{r.detail}</div>
                  <div className="text-[11px] text-fg-muted mt-1.5">{r.subject}</div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Compliance posture"
              description="Continuous controls that gate live origination."
            />
            <CardBody className="space-y-3">
              {[
                ['Bank-partner agreement', 'Cross River Bank · in force'],
                ['BSA Officer designation', 'Devon Lin · countersigned'],
                ['MLA covered-borrower check', 'Real-time gate · 0 evasions in 30d'],
                ['Adverse Action notices', 'Auto-generated within 30d · 100%'],
                ['OFAC daily rescreen', 'Last run 2026-05-04 06:00Z'],
                ['SR 11-7 model risk', '3 models in scope · all current'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-3">
                  <CheckIcon size={14} className="text-success mt-0.5 shrink-0" />
                  <div className="text-[13px] flex-1">
                    <div className="font-medium">{k}</div>
                    <div className="text-fg-muted text-[12px]">{v}</div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
