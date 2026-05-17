'use client';
import { useParams, notFound } from 'next/navigation';
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
  WebhookIcon,
} from '@eazepay/ui/web';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';

/**
 * Per-brand API keys + webhooks.
 *
 * Each brand portal issues its own sandbox + live key pair with a
 * brand-prefixed identifier (eg. `ep_live_medpay_…`). The BFF enforces
 * that the key's brand scope matches the resource being accessed — a
 * MedPay key cannot read TradePay applications even if the issuer
 * organisation runs both portals. Webhooks similarly fire only on the
 * brand's lifecycle events.
 */

interface BrandKey {
  id: string;
  name: string;
  prefix: string;
  env: 'live' | 'sandbox';
  scopes: string[];
  lastUsedAt: string | null;
}

interface BrandWebhook {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failing';
  successRate: string;
  lastDelivery: string;
}

const keysFor = (brand: BrandCode): BrandKey[] => [
  {
    id: 'k_sand',
    name: `${BRANDS[brand].name} sandbox`,
    prefix: `ep_test_${brand}_R8mQp…`,
    env: 'sandbox',
    scopes: ['applications:read', 'applications:write', 'offers:read', 'webhooks:test'],
    lastUsedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'k_live',
    name: `${BRANDS[brand].name} live`,
    prefix: `ep_live_${brand}_••••••`,
    env: 'live',
    scopes: [
      'applications:read',
      'applications:write',
      'offers:read',
      'offers:accept',
      'documents:write',
    ],
    lastUsedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

const webhooksFor = (brand: BrandCode): BrandWebhook[] => [
  {
    id: 'w_01',
    url: `https://hooks.${BRANDS[brand].slug}-partner.example.com/eazepay`,
    events: ['application.approved', 'application.declined', 'offer.accepted', 'loan.funded'],
    status: 'active',
    successRate: '99.8%',
    lastDelivery: '12 min ago',
  },
  {
    id: 'w_02',
    url: `https://hooks.${BRANDS[brand].slug}-partner.example.com/crm-sync`,
    events: ['repayment.due', 'repayment.paid', 'repayment.failed'],
    status: 'active',
    successRate: '99.5%',
    lastDelivery: '1h 04m ago',
  },
];

const keyColumns: Column<BrandKey>[] = [
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
      <div className="flex flex-wrap gap-1">
        {k.scopes.map((s) => (
          <span key={s} className="font-mono text-[10px] bg-bg-muted rounded px-1.5 py-0.5">
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
        <span className="text-[12px] text-fg-muted tabular-nums">
          {new Date(k.lastUsedAt).toLocaleString('en-US')}
        </span>
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

export default function BrandApiKeysPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand) notFound();
  const spec = BRANDS[brand!];

  const keys = keysFor(brand!);
  const webhooks = webhooksFor(brand!);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: spec.name, href: `/v/${brandSlug}` }, { label: 'API keys' }]}
        title={`${spec.name} API keys`}
        description={`Server-to-server credentials scoped to your ${spec.name} portal only. ${spec.name} keys cannot access TradePay, MedPay, or CoachPay resources on the same parent organisation.`}
        actions={<Button leadingIcon={<KeyIcon size={16} />}>Generate {spec.name} key</Button>}
      />
      <PageBody>
        <Banner intent="warning" className="mb-4" title="Treat live keys like production secrets">
          Rotate after any team member with access leaves. We auto-expire keys with no usage in 180
          days. Every request is logged to your audit chain with IP, scope, replay-protection nonce,
          and the brand scope it touched.
        </Banner>

        <DataTable columns={keyColumns} rows={keys} rowKey={(k) => k.id} className="mb-6" />

        <Card className="mb-6">
          <CardHeader
            title={`${spec.name} webhooks`}
            description="Outbound events fire only on this brand's lifecycle. HMAC-SHA256 signed."
            action={
              <Button size="sm" leadingIcon={<WebhookIcon size={14} />}>
                Add endpoint
              </Button>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {webhooks.map((w) => (
                <li key={w.id} className="grid grid-cols-12 px-5 py-3 items-center text-[13px]">
                  <div className="col-span-5 min-w-0">
                    <p className="font-mono text-[12px] truncate text-fg">{w.url}</p>
                    <p className="text-[11px] text-fg-muted mt-0.5">{w.events.length} events</p>
                  </div>
                  <div className="col-span-3">
                    <div className="flex flex-wrap gap-1">
                      {w.events.slice(0, 2).map((e) => (
                        <span
                          key={e}
                          className="font-mono text-[10px] bg-bg-muted rounded px-1.5 py-0.5"
                        >
                          {e}
                        </span>
                      ))}
                      {w.events.length > 2 && (
                        <span className="text-[10px] text-fg-muted">+{w.events.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <StatusPill
                      tone={
                        w.status === 'active'
                          ? 'success'
                          : w.status === 'failing'
                            ? 'danger'
                            : 'warning'
                      }
                      dot
                    >
                      {w.status}
                    </StatusPill>
                  </div>
                  <div className="col-span-1 text-[12px] text-fg-secondary tabular-nums">
                    {w.successRate}
                  </div>
                  <div className="col-span-1 text-right text-[12px] text-fg-muted">
                    {w.lastDelivery}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={`${spec.name} authentication reference`}
            description="HMAC-SHA256 of the request body using your brand-scoped secret, with timestamp + nonce to prevent replay."
          />
          <CardBody>
            <CodeBlock language="bash" filename="curl">{`# All requests require the headers below.
# Signature = hex(hmac_sha256(secret, timestamp + '.' + nonce + '.' + body)).

curl -X POST https://api.eazepay.com/v1/${BRANDS[brand!].slug}/applications/app_4nqLkR2vTjW/respond \\
  -H "Authorization: Bearer ep_live_${brand}_2KvN8…" \\
  -H "X-EazePay-Brand: ${BRANDS[brand!].slug}" \\
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
