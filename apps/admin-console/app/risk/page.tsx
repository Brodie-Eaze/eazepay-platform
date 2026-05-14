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
  DataRow,
  FlagIcon,
  AlertIcon,
} from '@eazepay/ui/web';
import { riskFlags, fmtDate } from '../../lib/mock-data';

export default function RiskFlagsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Risk flags' }]}
        title="Risk flags"
        description="Velocity, fraud, identity, and sanctions signals raised by the rules + adapters. Open ones gate origination."
        actions={<Button>Configure rules</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Open flags" value={riskFlags.length} delta={{ value: '+1', direction: 'up', isGood: false }} />
          <KpiCard label="High severity" value={riskFlags.filter((r) => r.severity === 'high').length} hint="Compliance review opens automatically" />
          <KpiCard label="Mean time to close" value="38m" delta={{ value: '-12m', direction: 'down', isGood: true }} />
          <KpiCard label="Fraud net loss (30d)" value="$2,140" delta={{ value: '-31%', direction: 'down', isGood: true }} />
        </div>

        <Banner intent="warning" className="mb-4" title="Sterling Direct circuit breaker tripped">
          50.4% error rate over the last 60s window. Adapter excluded from routing automatically. Page
          sent to on-call SRE. Sterling support contacted.
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {riskFlags.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <FlagIcon size={14} />
                    <span className="font-mono text-[13px]">{r.flagType}</span>
                  </span>
                }
                description={`Subject: ${r.subject} · raised ${fmtDate(r.raisedAt)}`}
                action={
                  <StatusPill tone={r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warning' : 'neutral'}>
                    {r.severity}
                  </StatusPill>
                }
              />
              <CardBody>
                <p className="text-[13px] text-fg-secondary leading-relaxed">{r.detail}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" variant="secondary">
                    Resolve as benign
                  </Button>
                  <Button size="sm" variant="danger" leadingIcon={<AlertIcon size={14} />}>
                    Open compliance review
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
