import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  KpiCard,
  Card,
  CardHeader,
  CardBody,
  StatusPill,
  Button,
  Money,
  ArrowRightIcon,
  LinkIcon,
  ChartIcon,
  DollarIcon,
} from '@eazepay/ui/web';
import { merchantOrg, applications, conversionFunnel, lenderMix } from '../lib/mock-data';

export default function MerchantOverview() {
  const recent = applications.slice(0, 5);
  const trend = [
    21, 24, 18, 22, 27, 31, 28, 24, 19, 26, 33, 38, 35, 29, 31, 36, 41, 39, 42, 38, 33, 36, 41, 45,
    48, 44, 49, 47,
  ];
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant' }, { label: 'Overview' }]}
        title={`Welcome back, ${merchantOrg.contactName.split(' ')[0]}.`}
        description={`Live across all of ${merchantOrg.displayName}'s sales channels. Real-time application status, attach rate, and settlement.`}
        meta={
          <>
            <StatusPill tone="success" dot>
              KYB verified
            </StatusPill>
            <StatusPill tone="info">MDR · 285 bps</StatusPill>
            <StatusPill tone="accent">{merchantOrg.industry}</StatusPill>
          </>
        }
        actions={
          <>
            <Link href="/links">
              <Button variant="ghost" leadingIcon={<LinkIcon size={16} />}>
                New application link
              </Button>
            </Link>
            <Link href="/analytics">
              <Button leadingIcon={<ChartIcon size={16} />}>Insights</Button>
            </Link>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            label="Funded (MTD)"
            value={<Money cents={merchantOrg.monthlyVolumeCents} compact />}
            delta={{ value: '+22%', direction: 'up', isGood: true }}
            series={trend}
            icon={<DollarIcon size={14} />}
          />
          <KpiCard
            label="Finance attach rate"
            value={`${(merchantOrg.attachRate * 100).toFixed(0)}%`}
            delta={{ value: '+3pp', direction: 'up', isGood: true }}
            hint="financed sales / total sales"
          />
          <KpiCard
            label="Applications today"
            value={applications.length}
            delta={{ value: '+2', direction: 'up', isGood: true }}
            hint="open + decisioned"
          />
          <KpiCard
            label="Avg approved"
            value={<Money cents={1_950_000} compact />}
            hint="last 7 days"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Conversion funnel — last 30 days"
              description="From link open → application → fund. Drop-off above 35% on any step is worth a look."
              action={
                <Link href="/analytics">
                  <Button variant="ghost" size="sm" trailingIcon={<ArrowRightIcon size={14} />}>
                    Analytics
                  </Button>
                </Link>
              }
            />
            <CardBody>
              <div className="space-y-3">
                {conversionFunnel.map((step, i) => {
                  const prev = i > 0 ? conversionFunnel[i - 1].value : conversionFunnel[0].value;
                  const pct = (step.value / conversionFunnel[0].value) * 100;
                  const dropPct = i > 0 ? ((prev - step.value) / prev) * 100 : 0;
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between text-[13px] mb-1">
                        <span className="font-medium">{step.label}</span>
                        <span className="tabular-nums">
                          <strong>{step.value}</strong>{' '}
                          <span className="text-fg-muted">({pct.toFixed(0)}%)</span>
                          {i > 0 && (
                            <span className="ml-2 text-danger text-[12px]">
                              -{dropPct.toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-bg-muted overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Lender mix"
              description="Where your approved volume routed in the last 30 days."
            />
            <CardBody className="space-y-3">
              {lenderMix.map((l, i) => (
                <div key={l.label}>
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="font-medium">{l.label}</span>
                    <span className="tabular-nums text-fg-muted">{l.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${l.value}%`,
                        background: `rgb(var(--chart-${(i % 8) + 1}))`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader
            title="Recent applications"
            action={
              <Link href="/applications">
                <Button variant="ghost" size="sm" trailingIcon={<ArrowRightIcon size={14} />}>
                  All applications
                </Button>
              </Link>
            }
          />
          <CardBody padded={false}>
            <div className="divide-y divide-border">
              {recent.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="size-9 rounded-full bg-bg-muted flex items-center justify-center text-[12px] font-semibold text-fg-secondary">
                    {a.customerName
                      .split(' ')
                      .map((s) => s[0])
                      .join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{a.customerName}</div>
                    <div className="text-[12px] text-fg-muted">
                      <Money cents={a.requestedCents} noFractions /> · {a.termMonths}mo · {a.state}
                    </div>
                  </div>
                  {a.status === 'funded' && <StatusPill tone="success">Funded</StatusPill>}
                  {a.status === 'approved' && <StatusPill tone="success">Approved</StatusPill>}
                  {a.status === 'in_progress' && (
                    <StatusPill tone="info" dot>
                      In progress
                    </StatusPill>
                  )}
                  {a.status === 'declined' && <StatusPill tone="danger">Declined</StatusPill>}
                  {a.status === 'expired' && <StatusPill tone="neutral">Expired</StatusPill>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
