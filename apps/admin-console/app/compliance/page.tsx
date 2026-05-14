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
  ShieldIcon,
} from '@eazepay/ui/web';

const reviews = [
  { id: 'cr_8KvR', subject: 'app_KvN2QpL8mqT', kind: 'sar_prefile', status: 'open', assignee: 'Devon L.', opened: '2026-05-04T15:14Z' },
  { id: 'cr_KvR8', subject: 'mer_bayview', kind: 'ofac_match', status: 'open', assignee: 'Devon L.', opened: '2026-05-04T13:48Z' },
  { id: 'cr_R8Kv', subject: 'app_9xQpL4mNkjT', kind: 'fair_lending_audit', status: 'closed', assignee: 'Priya V.', opened: '2026-05-03T11:30Z' },
  { id: 'cr_8RKv', subject: 'cust_8mRT2WQpKvN', kind: 'cfpb_complaint', status: 'open', assignee: 'Devon L.', opened: '2026-05-02T16:21Z' },
];

const kindLabel: Record<string, string> = {
  sar_prefile: 'SAR pre-filing intake',
  ofac_match: 'OFAC / sanctions match',
  fair_lending_audit: 'Fair-lending decision audit',
  cfpb_complaint: 'CFPB complaint workflow',
};

export default function ComplianceReviewsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Compliance reviews' }]}
        title="Compliance reviews"
        description="SAR queue, OFAC hits, fair-lending audit, CFPB complaints. Dual-control required to close."
        actions={<Button>Bulk export</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Open reviews" value={reviews.filter((r) => r.status === 'open').length} hint="all severities" />
          <KpiCard label="SAR queue" value="1" hint="30-day filing window" />
          <KpiCard label="CFPB complaints (60d)" value="3" delta={{ value: '+1', direction: 'up', isGood: false }} />
          <KpiCard label="Median time-to-close" value="2.1d" delta={{ value: '-0.6d', direction: 'down', isGood: true }} />
        </div>

        <Banner intent="info" className="mb-4">
          Closing a review requires (a) reviewer rationale, (b) second-reviewer signoff, and (c)
          attachment of any artifact filed externally (FinCEN BSA E-File ack, CFPB response). All hashed
          to the audit chain.
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader
                title={<span className="flex items-center gap-2"><ShieldIcon size={14} />{kindLabel[r.kind]}</span>}
                description={<>Review <span className="font-mono">{r.id}</span> · subject {r.subject}</>}
                action={
                  r.status === 'open'
                    ? <StatusPill tone="warning" dot>Open</StatusPill>
                    : <StatusPill tone="success">Closed</StatusPill>
                }
              />
              <CardBody>
                <DataRow label="Assignee" value={r.assignee} />
                <DataRow label="Opened" value={new Date(r.opened).toLocaleString('en-US')} />
                <DataRow label="Linked records" value="1 app · 2 events · 1 doc" />
                <DataRow label="Statutory deadline" value={r.kind === 'sar_prefile' ? '2026-05-29 (FinCEN 30d)' : r.kind === 'cfpb_complaint' ? '2026-05-07 (CFPB 15d initial)' : '—'} />
                {r.status === 'open' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="secondary">Open workspace</Button>
                    <Button size="sm">Move to closeout</Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
