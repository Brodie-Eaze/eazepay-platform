'use client';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  DataTable,
  StatusPill,
  CodeBlock,
  Banner,
  DataRow,
  type Column,
  WebhookIcon,
  CheckIcon,
} from '@eazepay/ui/web';
import { webhookDeliveries, type WebhookDelivery } from '../../lib/mock-data';

const columns: Column<WebhookDelivery>[] = [
  {
    key: 'event',
    header: 'Event',
    cell: (d) => <span className="font-mono text-[12px]">{d.eventType}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (d) =>
      d.status === 'delivered' ? (
        <StatusPill tone="success">200 OK</StatusPill>
      ) : d.status === 'failed' ? (
        <StatusPill tone="danger">{d.httpStatus ?? 'fail'}</StatusPill>
      ) : (
        <StatusPill tone="neutral" dot>
          queued
        </StatusPill>
      ),
  },
  { key: 'attempts', header: 'Attempts', align: 'right', cell: (d) => d.attempts },
  {
    key: 'duration',
    header: 'Duration',
    align: 'right',
    cell: (d) => (d.durationMs ? <span className="tabular-nums">{d.durationMs}ms</span> : '—'),
  },
  {
    key: 'when',
    header: 'Delivered',
    align: 'right',
    cell: (d) => (
      <span className="text-[12px] text-fg-muted tabular-nums">
        {d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('en-US') : '—'}
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
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'Webhooks' }]}
        title="Webhooks"
        description="Inbound events from EazePay orchestration. Signed with HMAC-SHA256 + per-endpoint secret; replay-protected with timestamp + nonce."
        actions={<Button leadingIcon={<WebhookIcon size={16} />}>Add endpoint</Button>}
      />
      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <Card className="xl:col-span-2">
            <CardHeader title="Active endpoint" description="Edit, rotate secret, or pause." />
            <CardBody>
              <DataRow
                label="URL"
                value={
                  <span className="font-mono text-[12px]">
                    https://api.evergreen-prime.com/eazepay/webhooks
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
                value={
                  <span className="text-[12px]">
                    application.routed, application.declined, offer.accepted, loan.funded,
                    repayment.late, hardship.requested
                  </span>
                }
              />
              <DataRow label="Delivery success (30d)" value="99.94%" />
              <DataRow label="P95 receive time" value="121ms" />
              <DataRow
                label="Secret"
                value={<span className="font-mono text-[12px]">whsec_••••••••••2104</span>}
              />
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="secondary">
                  Rotate secret
                </Button>
                <Button size="sm" variant="ghost">
                  Edit endpoint
                </Button>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Signature verification" />
            <CardBody>
              <CodeBlock language="typescript" filename="verify.ts">{`import crypto from 'crypto';

export function verify(headers: Headers, raw: string, secret: string) {
  const ts = headers.get('X-EazePay-Timestamp')!;
  const sig = headers.get('X-EazePay-Signature')!;
  const nonce = headers.get('X-EazePay-Nonce')!;
  const payload = \`\${ts}.\${nonce}.\${raw}\`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(sig), Buffer.from(expected),
  );
}`}</CodeBlock>
            </CardBody>
          </Card>
        </div>

        <Banner intent="info" className="mb-4">
          We retry up to <strong>24h with exponential backoff</strong> on 5xx / network failures;
          4xx surfaces immediately so you can fix endpoint-side. Every attempt is replayable from
          this UI.
        </Banner>

        <Card>
          <CardHeader
            title="Recent deliveries"
            description="Last 100 attempts across all events."
          />
          <CardBody padded={false}>
            <DataTable columns={columns} rows={webhookDeliveries} rowKey={(d) => d.id} />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
