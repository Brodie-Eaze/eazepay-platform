import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  CodeBlock,
  Banner,
} from '@eazepay/ui/web';
import { PublicPageShell } from '../../components/PublicPageShell';

/**
 * Public API documentation — `/api-docs`. No auth (read-only docs).
 *
 * Curated subset of the integration-relevant `/api/v1/*` endpoints.
 * The schemas mirror the Zod definitions in the corresponding route
 * handlers (`app/api/v1/...`); the page is intentionally narrative
 * rather than auto-generated so it stays scoped to the surfaces lenders
 * and partners actually call against.
 */

interface ApiSchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ApiEndpoint {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  auth: string;
  request?: ApiSchemaField[];
  response: ApiSchemaField[];
  curl: string;
}

const ENDPOINTS: ReadonlyArray<ApiEndpoint> = [
  {
    method: 'POST',
    path: '/api/v1/applications',
    summary: 'Create an application. Idempotency-Key header is required.',
    auth: 'Public (rate-limited + idempotency-keyed). Per-merchant API key recommended for production.',
    request: [
      {
        name: 'brand',
        type: 'enum',
        required: true,
        description: 'tradepay | medpay | coachpay | direct',
      },
      {
        name: 'channel.type',
        type: 'enum',
        required: false,
        description: 'merchant | direct | partner_link',
      },
      {
        name: 'applicant.first_name',
        type: 'string',
        required: true,
        description: 'Legal first name',
      },
      {
        name: 'applicant.last_name',
        type: 'string',
        required: true,
        description: 'Legal last name',
      },
      { name: 'applicant.email', type: 'string', required: true, description: 'RFC 5322 email' },
      {
        name: 'applicant.phone',
        type: 'string',
        required: true,
        description: 'E.164 phone, min 10 digits',
      },
      {
        name: 'applicant.state',
        type: 'string',
        required: false,
        description: 'Two-letter US state',
      },
      {
        name: 'request.amount_cents',
        type: 'integer',
        required: true,
        description: '$500 – $150,000 (cents)',
      },
      {
        name: 'request.term_months',
        type: 'integer',
        required: false,
        description: '6 – 144, defaults to 48',
      },
      {
        name: 'request.purpose',
        type: 'string',
        required: true,
        description: 'Free-text loan purpose',
      },
    ],
    response: [
      {
        name: 'id',
        type: 'string',
        required: true,
        description: 'Canonical application id (UUIDv4)',
      },
      {
        name: 'status',
        type: 'enum',
        required: true,
        description: 'created | submitted | accepted | rejected',
      },
      {
        name: 'snapshot_hash',
        type: 'string',
        required: true,
        description: 'Hash lenders see at quote time',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/applications \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "brand": "medpay",
    "applicant": {
      "first_name": "Alex",
      "last_name": "Rivera",
      "email": "alex@example.com",
      "phone": "+14155550100"
    },
    "request": {
      "amount_cents": 850000,
      "purpose": "Dental implants"
    }
  }'`,
  },
  {
    method: 'GET',
    path: '/api/v1/applications/{id}/offers',
    summary: 'List offers aggregated across every eligible lender adapter for an application.',
    auth: 'Partner session OR per-merchant API key. Tenant-scoped: only the owning merchant can read.',
    response: [
      {
        name: 'offers[]',
        type: 'array',
        required: true,
        description: 'Ranked, consumer-best first',
      },
      {
        name: 'offers[].lender_id',
        type: 'string',
        required: true,
        description: 'Stable lender identifier',
      },
      {
        name: 'offers[].apr_bps',
        type: 'integer',
        required: true,
        description: 'APR in basis points (integer)',
      },
      {
        name: 'offers[].term_months',
        type: 'integer',
        required: true,
        description: 'Approved term length',
      },
      {
        name: 'offers[].amount_cents',
        type: 'integer',
        required: true,
        description: 'Approved principal (cents)',
      },
      {
        name: 'offers[].monthly_payment_cents',
        type: 'integer',
        required: true,
        description: 'Monthly payment (cents)',
      },
    ],
    curl: `curl https://app.eazepay.com/api/v1/applications/app_01HXYZ/offers \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY"`,
  },
  {
    method: 'POST',
    path: '/api/v1/offers/{id}/accept',
    summary: 'Accept a specific offer on behalf of the consumer. Idempotent.',
    auth: 'Partner session OR per-merchant API key. Tenant-scoped.',
    request: [
      {
        name: 'consumer_consent_token',
        type: 'string',
        required: true,
        description: 'Token from the FCRA consent capture',
      },
    ],
    response: [
      {
        name: 'application_id',
        type: 'string',
        required: true,
        description: 'Owning application id',
      },
      { name: 'offer_id', type: 'string', required: true, description: 'Accepted offer id' },
      {
        name: 'status',
        type: 'enum',
        required: true,
        description: 'accepted | already_accepted | declined_by_lender',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/offers/ofr_01HXYZ/accept \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "consumer_consent_token": "ccn_..." }'`,
  },
  {
    method: 'POST',
    path: '/api/v1/orchestration/evaluate',
    summary:
      'Eligibility-only check. No bureau hit — returns the candidate lender set without quoting.',
    auth: 'Partner session OR per-merchant API key.',
    request: [
      {
        name: 'application_id',
        type: 'string',
        required: true,
        description: 'Application to evaluate',
      },
    ],
    response: [
      {
        name: 'candidates[]',
        type: 'array',
        required: true,
        description: 'Lenders that passed eligibility filters',
      },
      {
        name: 'candidates[].lender_id',
        type: 'string',
        required: true,
        description: 'Stable lender identifier',
      },
      {
        name: 'candidates[].tier',
        type: 'integer',
        required: true,
        description: 'Waterfall tier (1 = prime)',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/orchestration/evaluate \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "application_id": "app_01HXYZ" }'`,
  },
  {
    method: 'POST',
    path: '/api/v1/orchestration/route',
    summary: 'Run the tiered hybrid waterfall, fan-out to candidates, aggregate offers.',
    auth: 'Partner session OR per-merchant API key.',
    request: [
      {
        name: 'application_id',
        type: 'string',
        required: true,
        description: 'Application to route',
      },
      {
        name: 'max_tier',
        type: 'integer',
        required: false,
        description: 'Cap at this waterfall tier',
      },
    ],
    response: [
      { name: 'application_id', type: 'string', required: true, description: 'Echo of the input' },
      {
        name: 'offers_count',
        type: 'integer',
        required: true,
        description: 'Number of offers aggregated',
      },
      {
        name: 'tier_reached',
        type: 'integer',
        required: true,
        description: 'Deepest tier the waterfall reached',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/orchestration/route \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "application_id": "app_01HXYZ" }'`,
  },
  {
    method: 'POST',
    path: '/api/v1/decision-engine',
    summary:
      'Full decision call — eligibility, routing, ranking, and adverse-action mapping in one round-trip.',
    auth: 'Partner session OR per-merchant API key.',
    request: [
      {
        name: 'application_id',
        type: 'string',
        required: true,
        description: 'Application to decide',
      },
    ],
    response: [
      {
        name: 'decision',
        type: 'enum',
        required: true,
        description: 'approved | declined | needs_info',
      },
      {
        name: 'best_offer',
        type: 'object',
        required: false,
        description: 'Consumer-best offer (when approved)',
      },
      {
        name: 'reason_codes',
        type: 'string[]',
        required: false,
        description: 'CFPB Model Form C-1 codes when declined',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/decision-engine \\
  -H "Authorization: Bearer $EAZEPAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "application_id": "app_01HXYZ" }'`,
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks/lenders/{lender}',
    summary:
      'Lender callback surface. EazePay verifies the HMAC signature against the per-lender signing key — fail-closed in production.',
    auth: 'HMAC signature on the request body (header: X-EazePay-Signature). No cookies.',
    request: [
      {
        name: 'event_type',
        type: 'enum',
        required: true,
        description: 'offer.updated | application.funded | application.declined',
      },
      {
        name: 'lender_application_id',
        type: 'string',
        required: true,
        description: 'Lender-side identifier',
      },
      {
        name: 'eazepay_application_id',
        type: 'string',
        required: true,
        description: 'EazePay-side identifier (echo)',
      },
      {
        name: 'payload',
        type: 'object',
        required: true,
        description: 'Event-type-specific payload',
      },
    ],
    response: [
      {
        name: 'received',
        type: 'boolean',
        required: true,
        description: 'true when the signature verified and the event queued',
      },
    ],
    curl: `curl -X POST https://app.eazepay.com/api/v1/webhooks/lenders/highsale \\
  -H "X-EazePay-Signature: sha256=<hex>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "offer.updated",
    "lender_application_id": "hs_123",
    "eazepay_application_id": "app_01HXYZ",
    "payload": { "apr_bps": 1899, "amount_cents": 850000 }
  }'`,
  },
];

function methodTone(method: ApiEndpoint['method']) {
  return method === 'POST' ? 'success' : 'info';
}

export default function ApiDocsPage() {
  return (
    <PublicPageShell>
      <PageHeader
        title="API Documentation"
        description="Integration surface for lenders and merchant partners. Schemas mirror the Zod definitions enforced server-side."
        actions={
          <StatusPill tone="neutral" dot>
            v1
          </StatusPill>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-4">
          API documentation. Production access requires NDA + API key — contact{' '}
          <a href="mailto:partnerships@eazepay.com" className="underline">
            partnerships@eazepay.com
          </a>
          .
        </Banner>

        <Card className="mb-4">
          <CardHeader
            title="Conventions"
            description="Apply to every endpoint below unless noted otherwise."
          />
          <CardBody>
            <ul className="space-y-2 text-[13px] text-fg-secondary leading-relaxed">
              <li>
                <span className="font-semibold text-fg">Base URL.</span>{' '}
                <code className="font-mono text-[12px]">https://app.eazepay.com</code>
              </li>
              <li>
                <span className="font-semibold text-fg">Auth.</span> Bearer token in the{' '}
                <code className="font-mono text-[12px]">Authorization</code> header. Keys are
                per-merchant; never share across tenants.
              </li>
              <li>
                <span className="font-semibold text-fg">Idempotency.</span> State-changing endpoints
                require an <code className="font-mono text-[12px]">Idempotency-Key</code> header.
                Retries with the same key return the original response — money operations are never
                double-applied.
              </li>
              <li>
                <span className="font-semibold text-fg">Money.</span> All amounts are integer cents.
                APRs are integer basis points.
              </li>
              <li>
                <span className="font-semibold text-fg">Errors.</span> RFC 9457 problem-details
                envelope: <code className="font-mono text-[12px]">type</code>,{' '}
                <code className="font-mono text-[12px]">title</code>,{' '}
                <code className="font-mono text-[12px]">status</code>,{' '}
                <code className="font-mono text-[12px]">code</code>,{' '}
                <code className="font-mono text-[12px]">detail</code>.
              </li>
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-4">
          {ENDPOINTS.map((endpoint) => (
            <Card key={`${endpoint.method}-${endpoint.path}`}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2 font-mono text-[13px]">
                    <StatusPill tone={methodTone(endpoint.method)}>{endpoint.method}</StatusPill>
                    <span>{endpoint.path}</span>
                  </span>
                }
                description={endpoint.summary}
              />
              <CardBody className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                    Auth
                  </p>
                  <p className="text-[12px] text-fg-secondary mt-1">{endpoint.auth}</p>
                </div>

                {endpoint.request && <SchemaTable title="Request body" fields={endpoint.request} />}
                <SchemaTable title="Response body" fields={endpoint.response} />

                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
                    Example
                  </p>
                  <CodeBlock language="bash" showLineNumbers={false}>
                    {endpoint.curl}
                  </CodeBlock>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </PageBody>
    </PublicPageShell>
  );
}

function SchemaTable({ title, fields }: { title: string; fields: ReadonlyArray<ApiSchemaField> }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted mb-2">
        {title}
      </p>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-fg-muted bg-bg-muted/50 border-b border-border">
          <span className="col-span-5">Field</span>
          <span className="col-span-2">Type</span>
          <span className="col-span-1">Req</span>
          <span className="col-span-4">Description</span>
        </div>
        <ul className="divide-y divide-border">
          {fields.map((field) => (
            <li
              key={field.name}
              className="grid grid-cols-12 items-start gap-2 px-4 py-2.5 text-[12px]"
            >
              <span className="col-span-5 font-mono text-fg">{field.name}</span>
              <span className="col-span-2 text-fg-secondary">{field.type}</span>
              <span className="col-span-1 text-fg-secondary">{field.required ? 'yes' : 'no'}</span>
              <span className="col-span-4 text-fg-muted">{field.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
