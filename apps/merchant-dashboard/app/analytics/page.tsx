import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  BarChart,
  Sparkline,
  Money,
  Banner,
  StatusPill,
  ChartIcon,
} from '@eazepay/ui/web';
import { conversionFunnel, lenderMix } from '../../lib/mock-data';

export default function AnalyticsPage() {
  const trend = [
    21, 24, 18, 22, 27, 31, 28, 24, 19, 26, 33, 38, 35, 29, 31, 36, 41, 39, 42, 38, 33, 36, 41, 45,
    48, 44, 49, 47,
  ];
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Analytics' }]}
        title="Analytics"
        description="Pipeline, attach rate, and cohort performance. Filterable by date range, channel, and sales rep."
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="Approval rate (30d)"
            value="64%"
            delta={{ value: '+5pp', direction: 'up', isGood: true }}
            hint="approved / submitted"
          />
          <KpiCard
            label="Attach rate (30d)"
            value="42%"
            delta={{ value: '+3pp', direction: 'up', isGood: true }}
            hint="financed / total sales"
          />
          <KpiCard
            label="Avg sale (financed)"
            value={<Money cents={2_240_000} compact />}
            delta={{ value: '+8%', direction: 'up', isGood: true }}
          />
          <KpiCard
            label="Median time-to-fund"
            value="2h 14m"
            delta={{ value: '-18m', direction: 'down', isGood: true }}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Applications — 30-day" />
            <CardBody>
              <div className="text-accent">
                <BarChart
                  data={trend.map((v, i) => ({ label: i % 5 === 0 ? `${i + 1}d` : '', value: v }))}
                  height={160}
                />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Conversion funnel" />
            <CardBody>
              <div className="space-y-2">
                {conversionFunnel.map((s, i) => {
                  const pct = (s.value / conversionFunnel[0].value) * 100;
                  return (
                    <div key={s.label}>
                      <div className="flex items-center justify-between text-[13px] mb-1">
                        <span>{s.label}</span>
                        <span className="tabular-nums">
                          {s.value} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-bg-muted overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Approval rate by ticket size" />
            <CardBody>
              <div className="text-chart-2">
                <BarChart
                  data={[
                    { label: '<$5k', value: 88 },
                    { label: '$5–10k', value: 79 },
                    { label: '$10–20k', value: 68 },
                    { label: '$20–35k', value: 58 },
                    { label: '$35k+', value: 42 },
                  ]}
                  height={140}
                />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Lender mix" />
            <CardBody className="space-y-2">
              {lenderMix.map((l, i) => (
                <div key={l.label}>
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span>{l.label}</span>
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
      </PageBody>
    </>
  );
}
