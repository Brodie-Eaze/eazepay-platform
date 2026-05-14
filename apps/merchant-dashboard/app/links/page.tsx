'use client';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Input,
  Select,
  StatusPill,
  DataTable,
  Money,
  CodeBlock,
  type Column,
  CopyIcon,
  LinkIcon,
} from '@eazepay/ui/web';
import { applicationLinks, type ApplicationLink, fmtDate } from '../../lib/mock-data';

const columns: Column<ApplicationLink>[] = [
  { key: 'url', header: 'Link', cell: (l) => (
    <div>
      <div className="font-mono text-[12px] text-fg">{l.url}</div>
      <div className="text-[12px] text-fg-muted mt-0.5">{l.productNote ?? '—'}</div>
    </div>
  )},
  { key: 'amount', header: 'Sale', align: 'right', cell: (l) => l.saleAmountCents ? <Money cents={l.saleAmountCents} noFractions /> : <span className="text-fg-muted">Any</span> },
  { key: 'customer', header: 'Customer', cell: (l) => <span className="text-[12px]">{l.customerEmail ?? '—'}</span> },
  { key: 'metrics', header: 'Funnel', align: 'right', cell: (l) => (
    <span className="text-[12px] tabular-nums text-fg-muted">{l.views} · {l.starts} · {l.submitted} · {l.funded}</span>
  )},
  { key: 'status', header: 'Status', cell: (l) =>
    l.status === 'active' ? <StatusPill tone="success" dot>Active</StatusPill> :
    l.status === 'used' ? <StatusPill tone="info">Used</StatusPill> :
    <StatusPill tone="neutral">Expired</StatusPill>
  },
  { key: 'expires', header: 'Expires', align: 'right', cell: (l) => <span className="text-[12px] text-fg-muted tabular-nums">{fmtDate(l.expiresAt)}</span> },
  { key: 'actions', header: '', align: 'right', cell: () => (
    <div className="flex items-center gap-1 justify-end">
      <Button size="sm" variant="ghost" leadingIcon={<CopyIcon size={12} />}>Copy</Button>
      <Button size="sm" variant="ghost">QR</Button>
    </div>
  )},
];

export default function LinksPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Application links' }]}
        title="Application links"
        description="Single-use, signed URLs your customer opens on their phone. We carry your brand, run the full KYC + application + e-sign, then notify you the moment funds disburse."
        actions={<Button leadingIcon={<LinkIcon size={16} />}>Generate link</Button>}
      />
      <PageBody>
        <Card className="mb-4">
          <CardHeader title="Generate a new link" description="Pre-fill the sale to remove friction. The link is signed, expiring, and merchant-scoped." />
          <CardBody>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <Input label="Sale amount" placeholder="$19,500" leadingIcon={<span className="text-fg-muted">$</span>} />
              <Select label="Term preference" defaultValue="60" options={[
                { value: '24', label: '24 months' },
                { value: '36', label: '36 months' },
                { value: '60', label: '60 months' },
                { value: '84', label: '84 months' },
                { value: '120', label: '120 months' },
              ]} />
              <Input label="Customer email (optional)" placeholder="customer@example.com" type="email" />
              <Input label="Quote / job ref" placeholder="Q-2841" />
            </div>
            <div className="mt-3">
              <Input label="Product / job note" placeholder="11.6 kW system · 13.5 kWh battery · permit included" />
            </div>
          </CardBody>
          <CardFooter>
            <Button variant="ghost">Reset</Button>
            <Button leadingIcon={<LinkIcon size={16} />}>Generate link</Button>
          </CardFooter>
        </Card>

        <DataTable columns={columns} rows={applicationLinks} rowKey={(l) => l.id} />

        <Card className="mt-4">
          <CardHeader title="Embed at checkout" description="Drop the EazePay widget into your checkout to offer financing without redirecting customers." />
          <CardBody>
            <CodeBlock language="html" filename="checkout.html">{`<!-- One-line drop-in -->
<script src="https://js.eazepay.com/v1/widget.js"></script>

<button
  data-eazepay
  data-merchant="pacificsolar"
  data-amount="195000"
  data-term="60"
  data-customer-email="customer@example.com"
>
  Apply for financing
</button>`}</CodeBlock>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
