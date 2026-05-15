'use client';
import { useState } from 'react';
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

const buildColumns = (
  onRotate: (id: string) => void,
  onRevoke: (id: string) => void,
): Column<ApiKey>[] => [
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
    cell: (k) => (
      <div className="flex items-center gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => onRotate(k.id)}>
          Rotate
        </Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => onRevoke(k.id)}>
          Revoke
        </Button>
      </div>
    ),
  },
];

export default function ApiKeysPage() {
  const [rows, setRows] = useState<ApiKey[]>(apiKeys);
  const [toast, setToast] = useState<string | null>(null);
  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }
  function rotate(id: string) {
    setRows((prev) => prev.map((k) => (k.id === id ? { ...k, prefix: k.prefix.replace(/_[a-zA-Z0-9]+/, '_' + Math.random().toString(36).slice(2, 7)), lastUsedAt: null } : k)));
    flash('Key rotated — old key disabled in 60s grace window');
  }
  function revoke(id: string) {
    setRows((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    flash('Key revoked — immediate effect, audit logged');
  }
  function generate() {
    const env: ApiKey['env'] = 'sandbox';
    const id = 'key_new_' + Date.now().toString(36);
    setRows((prev) => [
      { id, name: 'New sandbox key', prefix: `ep_test_${id.slice(-6)}...`, env, scopes: ['applications:read'], createdAt: new Date().toISOString(), lastUsedAt: null, revoked: false },
      ...prev,
    ]);
    flash('New sandbox key created — copy secret immediately, only shown once');
  }
  const columns = buildColumns(rotate, revoke);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'API keys' }]}
        title="API keys"
        description="Server-to-server credentials for EazePay's lender adapter API. Keys are HMAC-signed and bound to scopes; secrets are only shown at creation."
        actions={<Button leadingIcon={<KeyIcon size={16} />} onClick={generate}>Generate key</Button>}
      />
      <PageBody>
        <Banner intent="warning" className="mb-4" title="Treat live keys like production secrets">
          Rotate after any team member with access leaves. We auto-expire keys with no usage in 180
          days. All requests are logged to your audit chain with IP, scope, and replay-protection nonce.
        </Banner>

        <DataTable columns={columns} rows={rows} rowKey={(k) => k.id} className="mb-6" />

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
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-border bg-fg text-white px-4 py-2 text-[12px] shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
