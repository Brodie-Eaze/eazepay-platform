'use client';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Banner,
  Button,
  StatusPill,
  CodeBlock,
  DataTable,
  type Column,
  KeyIcon,
} from '@eazepay/ui/web';

interface Key {
  id: string;
  name: string;
  prefix: string;
  env: 'live' | 'test';
  createdAt: string;
  lastUsed: string | null;
}

const keys: Key[] = [
  { id: 'k_live_1', name: 'Production', prefix: 'pk_live_8KvR2NQp…', env: 'live', createdAt: '2025-08-12', lastUsed: '2026-05-04T18:55Z' },
  { id: 'k_test_1', name: 'Sandbox', prefix: 'pk_test_R2NQpLm…', env: 'test', createdAt: '2025-08-12', lastUsed: '2026-05-03T11:22Z' },
];

const columns: Column<Key>[] = [
  { key: 'name', header: 'Name', cell: (k) => (
    <div>
      <div className="font-medium">{k.name}</div>
      <div className="font-mono text-[12px] text-fg-muted">{k.prefix}</div>
    </div>
  )},
  { key: 'env', header: 'Env', cell: (k) => k.env === 'live' ? <StatusPill tone="success">live</StatusPill> : <StatusPill tone="info">test</StatusPill> },
  { key: 'created', header: 'Created', cell: (k) => <span className="text-[12px] tabular-nums">{k.createdAt}</span> },
  { key: 'used', header: 'Last used', align: 'right', cell: (k) => <span className="text-[12px] text-fg-muted tabular-nums">{k.lastUsed ? new Date(k.lastUsed).toLocaleString('en-US') : 'never'}</span> },
  { key: 'actions', header: '', align: 'right', cell: () => (
    <div className="flex items-center gap-2 justify-end">
      <Button size="sm" variant="ghost">Rotate</Button>
      <Button size="sm" variant="ghost" className="text-danger">Revoke</Button>
    </div>
  )},
];

export default function ApiKeysPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Merchant', href: '/' }, { label: 'API keys' }]}
        title="API keys"
        description="Publishable keys are safe to embed in your storefront. Secret keys must live on your server."
        actions={<Button leadingIcon={<KeyIcon size={16} />}>Generate key</Button>}
      />
      <PageBody>
        <Banner intent="warning" className="mb-4" title="Keep secret keys server-side">
          Publishable keys (<code>pk_*</code>) are safe in client code. Secret keys (<code>sk_*</code>)
          must never appear in browsers, mobile apps, or version control.
        </Banner>

        <DataTable columns={columns} rows={keys} rowKey={(k) => k.id} className="mb-4" />

        <Card>
          <CardHeader title="Server-side request example" />
          <CardBody>
            <CodeBlock language="bash">{`curl -X POST https://api.eazepay.com/v1/merchants/pacificsolar/application-links \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sale_amount_cents": 1950000,
    "term_months": 60,
    "customer_email": "customer@example.com",
    "expires_in_minutes": 1440
  }'`}</CodeBlock>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
