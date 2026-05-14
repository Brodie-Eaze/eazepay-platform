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
  type Column,
  KeyIcon,
  ShieldIcon,
} from '@eazepay/ui/web';
import { apiKeys, type ApiKey } from '../../lib/mock-data';

const columns: Column<ApiKey>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (k) => (
      <div>
        <div className="font-medium">{k.name}</div>
        <div className="font-mono text-[12px] text-fg-muted">{k.prefix}</div>
      </div>
    ),
  },
  {
    key: 'env',
    header: 'Env',
    cell: (k) =>
      k.env === 'live' ? (
        <StatusPill tone="success">live</StatusPill>
      ) : (
        <StatusPill tone="info">sandbox</StatusPill>
      ),
  },
  {
    key: 'scopes',
    header: 'Scopes',
    cell: (k) => (
      <div className="flex flex-wrap gap-1.5">
        {k.scopes.map((s) => (
          <span key={s} className="font-mono text-[11px] bg-bg-muted rounded px-1.5 py-0.5">
            {s}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: 'lastUsed',
    header: 'Last used',
    align: 'right',
    cell: (k) =>
      k.lastUsedAt ? (
        <span className="text-[12px] text-fg-muted tabular-nums">{new Date(k.lastUsedAt).toLocaleString('en-US')}</span>
      ) : (
        <span className="text-fg-muted">never</span>
      ),
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: () => (
      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="ghost">
          Rotate
        </Button>
        <Button size="sm" variant="ghost" className="text-danger">
          Revoke
        </Button>
      </div>
    ),
  },
];

export default function ApiKeysPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'API keys' }]}
        title="API keys"
        description="Server-to-server credentials for EazePay's lender adapter API. Keys are HMAC-signed and bound to scopes; secrets are only shown at creation."
        actions={<Button leadingIcon={<KeyIcon size={16} />}>Generate key</Button>}
      />
      <PageBody>
        <Banner intent="warning" className="mb-4" title="Treat live keys like production secrets">
          Rotate after any team member with access leaves. We auto-expire keys with no usage in 180
          days. All requests are logged to your audit chain with IP, scope, and replay-protection nonce.
        </Banner>

        <DataTable columns={columns} rows={apiKeys} rowKey={(k) => k.id} className="mb-6" />

        <Card>
          <CardHeader title="Authentication reference" description="HMAC-SHA256 of the request body using your shared secret, with timestamp + nonce to prevent replay." />
          <CardBody>
            <CodeBlock language="bash" filename="curl">{`# All requests require the headers below.
# The signature is hex(hmac_sha256(secret, timestamp + '.' + nonce + '.' + body)).

curl -X POST https://api.eazepay.com/v1/partner/applications/app_4nqLkR2vTjW/respond \\
  -H "Authorization: Bearer ep_live_2KvN8…" \\
  -H "X-EazePay-Timestamp: 1746387721" \\
  -H "X-EazePay-Nonce: 6f1d2e6f4c9b" \\
  -H "X-EazePay-Signature: a9d3…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "decision": "approved",
    "offer": {
      "amount_cents": 1850000,
      "term_months": 60,
      "apr_bps": 1099,
      "fee_cents": 0
    },
    "reason_codes": ["approved_within_policy"]
  }'`}</CodeBlock>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
