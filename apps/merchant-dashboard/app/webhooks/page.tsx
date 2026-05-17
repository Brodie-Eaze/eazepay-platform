'use client';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  DataTable,
  StatusPill,
  CodeBlock,
  DataRow,
  type Column,
  WebhookIcon,
  CheckIcon,
} from '@eazepay/ui/web';
import { webhookDeliveries } from '../../lib/mock-data';

type Delivery = (typeof webhookDeliveries)[number];

const columns: Column<Delivery>[] = [
  {
    key: 'event',
    header: 'Event',
    cell: (d) => <span className="font-mono text-[12px]">{d.event}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (d) =>
      d.status === 'delivered' ? (
        <StatusPill tone="success">200 OK</StatusPill>
      ) : (
        <StatusPill tone="danger">{d.http}</StatusPill>
      ),
  },
  { key: 'attempts', header: 'Attempts', align: 'right', cell: (d) => d.attempts },
  {
    key: 'when',
    header: 'When',
    align: 'right',
    cell: (d) => (
      <span className="text-[12px] text-fg-muted tabular-nums">
        {new Date(d.when).toLocaleString('en-US')}
      </span>
    ),
  },
  {
    key: 'replay',
    header: '',
    align: 'right',
    cell: () => (
      <Button size="sm" variant="ghost">
        Replay
      </Button>
    ),
  },
];

export default function WebhooksPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'Webhooks' }]}
        title="Webhooks"
        description="Real-time notifications for application state changes, funding, and repayments."
        actions={<Button leadingIcon={<WebhookIcon size={16} />}>Add endpoint</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <Card className="xl:col-span-2">
            <CardHeader title="Active endpoint" />
            <CardBody>
              <DataRow
                label="URL"
                value={
                  <span className="font-mono text-[12px]">
                    https://pacificsolar.com/eazepay/webhooks
                  </span>
                }
              />
              <DataRow
                label="Status"
                value={
                  <StatusPill tone="success" dot icon={<CheckIcon size={11} />}>
                    Healthy
                  </StatusPill>
                }
              />
              <DataRow
                label="Events"
                value={<span className="text-[12px]">application.* · loan.* · settlement.*</span>}
              />
              <DataRow label="Delivery success (30d)" value="100%" />
              <DataRow
                label="Secret"
                value={<span className="font-mono text-[12px]">whsec_••••••••••2104</span>}
              />
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="secondary">
                  Rotate secret
                </Button>
                <Button size="sm" variant="ghost">
                  Edit
                </Button>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Verify signature" />
            <CardBody>
              <CodeBlock language="typescript">{`crypto
  .createHmac('sha256', secret)
  .update(\`\${ts}.\${nonce}.\${rawBody}\`)
  .digest('hex')`}</CodeBlock>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent deliveries" />
          <CardBody padded={false}>
            <DataTable columns={columns} rows={webhookDeliveries} rowKey={(d) => d.id} />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
