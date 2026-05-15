import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  StatusPill,
  Banner,
  CodeBlock,
  DataRow,
  ExternalIcon,
  DocIcon,
  ShieldIcon,
  ArrowRightIcon,
  Button,
} from '@eazepay/ui/web';

export default function DocsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'Documentation' }]}
        title="Lender adapter documentation"
        description="The full contract: schemas, signing, error model, replay, SLAs, audit-trail handoff, and the bank-partner-of-record handshake."
        actions={
          <>
            <Link href="/lenders">
              <Button variant="secondary">View the marketplace</Button>
            </Link>
            <Button trailingIcon={<ExternalIcon size={14} />}>Open developer portal</Button>
          </>
        }
      />
      <PageBody>
        <Banner intent="info" className="mb-5">
          <strong>Six endpoints to integrate.</strong> Every lender adapter on the rail talks to the
          same six routes under <code className="font-mono">https://api.eazepay.com</code>.
          Sandbox traffic is unsigned-friendly so you can curl the endpoints before key exchange,
          then flip on HMAC verification for staging + prod.
        </Banner>

        <Card className="mb-5">
          <CardHeader title="API endpoint reference" description="Click any row to jump to its sample payload." />
          <CardBody className="p-0">
            <div className="divide-y divide-border">
              {[
                ['POST', '/api/v1/applications', 'Create a normalised application + Idempotency-Key.'],
                ['POST', '/api/v1/applications/{id}/submit', 'Consent + commit to orchestration. Returns evaluation_id.'],
                ['GET', '/api/v1/applications/{id}/offers', 'Consumer-best ranked offers, aggregated across eligible adapters.'],
                ['POST', '/api/v1/orchestration/evaluate', 'Eligibility-only check, no bureau hit.'],
                ['POST', '/api/v1/orchestration/route', 'Run the tiered hybrid waterfall, aggregate offers.'],
                ['POST', '/api/v1/offers/{id}/accept', 'Bind chosen offer, start TILA + e-sign flow.'],
                ['POST', '/api/v1/lenders/{lender_id}/quote', "Reference of the request EazePay POSTs to your adapter."],
                ['POST', '/api/v1/webhooks/lenders/{lender}', 'Inbound webhook from your adapter to EazePay.'],
                ['GET', '/api/v1/lenders', 'Marketplace registry: every active adapter + envelope.'],
                ['GET', '/api/v1/sample', 'Canonical sample payloads for every shape — drop into your QA suite.'],
              ].map(([method, path, summary]) => (
                <div key={path as string} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-muted/40">
                  <span
                    className={
                      'text-[10px] font-bold uppercase tracking-wider rounded px-2 py-1 shrink-0 ' +
                      (method === 'GET'
                        ? 'bg-info-bg text-info'
                        : 'bg-success-bg text-success')
                    }
                  >
                    {method}
                  </span>
                  <code className="font-mono text-[12px] text-fg shrink-0">{path}</code>
                  <span className="flex-1 text-[12px] text-fg-muted hidden md:inline">{summary}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="mb-5">
          <CardHeader
            title="Try it from your terminal"
            description="No auth required in demo mode — these endpoints are mounted on this hostname."
          />
          <CardBody>
            <CodeBlock language="bash" filename="curl">{`# 1. List every lender on the rail
curl -s $HOSTNAME/api/v1/lenders | jq

# 2. Filter to MedPay lenders
curl -s "$HOSTNAME/api/v1/lenders?brand=medpay" | jq

# 3. Eligibility check (no bureau hit)
curl -s $HOSTNAME/api/v1/orchestration/evaluate \\
  -X POST -H "Content-Type: application/json" \\
  -d '{
    "application_id":"app_demo_001",
    "brand":"tradepay",
    "amount_cents":1850000,
    "tier":"prime"
  }' | jq

# 4. Full waterfall — returns ranked offers
curl -s $HOSTNAME/api/v1/orchestration/route \\
  -X POST -H "Content-Type: application/json" \\
  -d '{
    "application_id":"app_demo_001",
    "brand":"tradepay",
    "amount_cents":1850000,
    "term_months":60,
    "tier":"prime"
  }' | jq

# 5. Sample payload bundle (application + offer + webhook events)
curl -s $HOSTNAME/api/v1/sample | jq`}</CodeBlock>
          </CardBody>
        </Card>

        <Card className="mb-5">
          <CardHeader
            title="HMAC-SHA256 signing"
            description="Required on prod traffic; optional on sandbox. Body is the raw JSON bytes EazePay sent."
          />
          <CardBody>
            <CodeBlock language="js" filename="signing.js">{`// Outbound (we → you) and inbound (you → us) use the same scheme.
// signature = hex(hmac_sha256(secret, timestamp + '.' + nonce + '.' + body))

import crypto from 'node:crypto';

const timestamp = String(Math.floor(Date.now() / 1000));
const nonce     = crypto.randomBytes(8).toString('hex');
const body      = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', LENDER_SECRET)
  .update(\`\${timestamp}.\${nonce}.\${body}\`)
  .digest('hex');

await fetch('https://api.eazepay.com/api/v1/lenders/lp_buzzpay_prime/quote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-EazePay-Timestamp': timestamp,
    'X-EazePay-Nonce': nonce,
    'X-EazePay-Signature': signature,
  },
  body,
});`}</CodeBlock>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Lifecycle (server-to-server)" description="EazePay drives the orchestration; you respond on quote, accept on bind, and disburse via the partner-bank rail." />
              <CardBody>
                <ol className="space-y-3 text-[13px]">
                  {[
                    ['1. /v1/partner/applications', 'EazePay POSTs a normalized applicant + bureau + bank snapshot. Respond with offer / decline / ineligible / counter within your SLA.'],
                    ['2. /v1/partner/offers/:id/bind', 'Applicant accepted your offer. Confirm + return contract metadata (lender of record, servicer, disclosures).'],
                    ['3. /v1/partner/loans/:id/fund', 'EazePay signals the bank-of-record disbursement window. Confirm rail (RTP / ACH same-day / wire) and amount.'],
                    ['4. Webhook (you → us)', 'Status changes (servicing, default, hardship, payoff) flow back via your webhook URL. Same HMAC scheme as inbound.'],
                  ].map(([title, body]) => (
                    <li key={title}>
                      <div className="font-mono text-[12px] font-semibold mb-0.5">{title}</div>
                      <div className="text-fg-secondary leading-relaxed">{body}</div>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Request schema · POST /v1/partner/applications" />
              <CardBody>
                <CodeBlock language="json" filename="application.request.json">{`{
  "application_id": "app_4nqLkR2vTjW",
  "policy_version": "orch_v_2026_05_a",
  "applicant": {
    "state": "TX",
    "fico_band": "740-779",
    "income_monthly_cents": 684000,
    "stability": { "residence_years": 4.2, "employer_years": 5.1 },
    "cashflow_score": 0.84,
    "dti_pct": 28.4,
    "mla_covered": false,
    "scra_active": false
  },
  "request": {
    "amount_cents": 1850000,
    "term_months": 60,
    "category": "home_improvement",
    "purpose_detail": "Solar PV + battery (Pacific Solar Co.)"
  },
  "channel": {
    "type": "merchant",
    "merchant_ref": "mer_pacificsolar_001"
  },
  "snapshot_hash": "sha256:f4e9…",
  "permissible_purpose": "604(a)(3)(A)"
}`}</CodeBlock>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Response schema · 200 OK" />
              <CardBody>
                <CodeBlock language="json" filename="application.response.json">{`{
  "decision": "approved",
  "offer": {
    "amount_cents": 1850000,
    "term_months": 60,
    "apr_bps": 1099,
    "fee_cents": 0,
    "monthly_payment_cents": 40142,
    "lender_of_record": "Cross River Bank"
  },
  "reason_codes": ["approved_within_policy"],
  "valid_until": "2026-05-11T18:42:00Z"
}`}</CodeBlock>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Error model" description="RFC 7807 problem details. Stable codes. Never leak internal errors." />
              <CardBody>
                <CodeBlock language="json">{`{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "code": "snapshot_hash_mismatch",
  "detail": "snapshot_hash does not match the inputs the orchestrator captured at submit-time",
  "instance": "/v1/partner/applications"
}`}</CodeBlock>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="SLA targets" />
              <CardBody className="space-y-2">
                <DataRow label="P50 response" value="≤ 400 ms" />
                <DataRow label="P95 response" value="≤ 1.2 s" />
                <DataRow label="P99 response" value="≤ 3 s" />
                <DataRow label="Error rate" value="≤ 0.5%" />
                <DataRow label="Circuit-breaker window" value="50% errors / 1 min over ≥20 calls" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Bank-partner handshake" />
              <CardBody className="space-y-2 text-[13px]">
                <p className="text-fg-secondary leading-relaxed">
                  Loans you originate via EazePay are <strong>made by the chartered bank-of-record</strong>{' '}
                  and either serviced by us or purchased by you under your warehouse / forward-flow.
                </p>
                <p className="text-fg-secondary leading-relaxed">
                  EazePay carries the true-lender attribute structurally on every Loan record. The bank
                  retains credit-policy ownership in form and substance, and we surface that in disclosures
                  + audit artifacts.
                </p>
                <Link href="/legal/licenses" className="flex items-center gap-1.5 text-accent text-[13px] mt-2">
                  Read the bank-partner whitepaper <ArrowRightIcon size={12} />
                </Link>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Compliance docs" />
              <CardBody className="space-y-2 text-[13px]">
                {[
                  ['SOC 2 Type II report (Q1 2026)', 'Available under NDA', '/legal/compliance'],
                  ['ECOA fair-lending policy', 'PDF · v2026.05', '/legal/compliance'],
                  ['SR 11-7 model risk policy', 'PDF · v2026.04', '/legal/compliance'],
                  ['Incident response runbook', 'PDF · v2026.03', '/legal/compliance'],
                  ['BSA/AML program', 'PDF · v2026.04', '/legal/compliance'],
                  ['Adverse Action notice templates', 'EN + ES', '/legal/disclosures'],
                ].map(([k, v, href]) => (
                  <Link key={k} href={href} className="flex items-start gap-2 hover:bg-bg-muted/40 -mx-1 px-1 py-1 rounded">
                    <ShieldIcon size={14} className="text-fg-muted mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{k}</div>
                      <div className="text-fg-muted text-[12px]">{v}</div>
                    </div>
                    <ExternalIcon size={12} className="text-fg-muted shrink-0 mt-1" />
                  </Link>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
