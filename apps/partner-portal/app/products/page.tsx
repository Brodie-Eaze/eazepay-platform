import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusPill,
  Money,
  Apr,
  DataRow,
  Banner,
  PackageIcon,
  ChartIcon,
} from '@eazepay/ui/web';
import { products } from '../../lib/mock-data';

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'Products & eligibility' }]}
        title="Products & eligibility"
        description="Configure each lending product EazePay can route to. Changes go through a 24h shadow window before live routing picks them up."
        actions={
          <>
            <Button variant="ghost" leadingIcon={<ChartIcon size={16} />}>
              Capacity inspector
            </Button>
            <Button leadingIcon={<PackageIcon size={16} />}>New product</Button>
          </>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          Eligibility rules execute in EazePay's deterministic rules engine before any external
          lender call. This protects your stack from ineligible traffic and gives us a defensible
          record of why a particular applicant did or did not surface to you.
        </Banner>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {products.map((p) => (
            <Card key={p.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {p.name}{' '}
                    {p.status === 'active' && (
                      <StatusPill tone="success" dot>
                        Active
                      </StatusPill>
                    )}
                    {p.status === 'paused' && <StatusPill tone="warning">Paused</StatusPill>}
                    {p.status === 'draft' && <StatusPill tone="neutral">Draft</StatusPill>}
                  </span>
                }
                description={`${p.liveStates} live states · ${p.approvalsToday} approvals today · funded MTD `}
                action={
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
              <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <DataRow
                    label="Loan size"
                    value={
                      <>
                        <Money cents={p.minAmountCents} noFractions /> –{' '}
                        <Money cents={p.maxAmountCents} noFractions />
                      </>
                    }
                  />
                  <DataRow label="Term" value={`${p.minTerm}–${p.maxTerm} months`} />
                  <DataRow
                    label="APR window"
                    value={
                      <>
                        <Apr bps={p.aprFloorBps} /> – <Apr bps={p.aprCeilingBps} />
                      </>
                    }
                  />
                  <DataRow label="Funded MTD" value={<Money cents={p.fundedMtdCents} compact />} />
                </div>
                <div>
                  <DataRow label="Min FICO" value={p.minFico} />
                  <DataRow label="Max DTI" value={`${p.maxDtiPct}%`} />
                  <DataRow label="Live states" value={p.liveStates} />
                  <DataRow label="Approvals today" value={p.approvalsToday} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
