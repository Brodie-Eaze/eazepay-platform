import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Button,
  CodeBlock,
  Banner,
  DataRow,
  StatusPill,
  BoltIcon,
  ArrowRightIcon,
} from '@eazepay/ui/web';

export default function SandboxPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Portal', href: '/' }, { label: 'Sandbox' }]}
        title="Sandbox"
        description="A fully isolated, no-cost environment that mirrors EazePay's production orchestration end-to-end. Synthetic applicants, deterministic outcomes, full webhook + audit trail."
        meta={
          <>
            <StatusPill tone="info">https://sandbox.eazepay.com</StatusPill>
            <StatusPill tone="accent">parity 100% with production</StatusPill>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Generate a test application" description="Use these IDs to drive deterministic outcomes." />
            <CardBody className="space-y-3">
              <DataRow label="Approve, prime profile" value={<span className="font-mono text-[12px]">applicant_test_prime_001</span>} />
              <DataRow label="Approve with counter-offer" value={<span className="font-mono text-[12px]">applicant_test_counter_002</span>} />
              <DataRow label="Decline — DTI" value={<span className="font-mono text-[12px]">applicant_test_decline_dti_003</span>} />
              <DataRow label="Decline — FICO floor" value={<span className="font-mono text-[12px]">applicant_test_decline_fico_004</span>} />
              <DataRow label="Ineligible — state coverage" value={<span className="font-mono text-[12px]">applicant_test_ineligible_state_005</span>} />
              <DataRow label="Timeout — circuit breaker" value={<span className="font-mono text-[12px]">applicant_test_timeout_006</span>} />
              <div className="pt-2 flex gap-2">
                <Button leadingIcon={<BoltIcon size={14} />}>Run all 6 scenarios</Button>
                <Button variant="ghost">Generate webhook traffic</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="curl quick start" />
            <CardBody>
              <CodeBlock language="bash">{`# 1. Create a sandbox application
curl -X POST https://sandbox.eazepay.com/v1/partner/applications \\
  -H "Authorization: Bearer ep_test_R8mQp…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicant_ref": "applicant_test_prime_001",
    "amount_cents": 1500000,
    "term_months": 60,
    "category": "home_improvement",
    "state": "TX"
  }'

# 2. Respond with your offer
curl -X POST https://sandbox.eazepay.com/v1/partner/applications/{id}/respond \\
  -H "Authorization: Bearer ep_test_R8mQp…" \\
  -d '{
    "decision": "approved",
    "offer": { "amount_cents": 1500000, "term_months": 60, "apr_bps": 999 }
  }'

# 3. EazePay calls back to your webhook endpoint with the
#    applicant's accept/decline and the contract artifacts.`}</CodeBlock>
            </CardBody>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title="Replay any production decision in sandbox" description="Mirror your audit chain without touching real data. Useful for postmortem + regression tests." />
            <CardBody className="space-y-2">
              <Banner intent="success">
                When you replay a production decision into sandbox, EazePay seeds the synthetic applicant
                with the same masked inputs that fed the original decision and routes through the same
                policy version. You get a bit-for-bit reproducible decision pack.
              </Banner>
              <div className="flex gap-2 pt-1">
                <Button trailingIcon={<ArrowRightIcon size={14} />}>Replay a recent decision</Button>
                <Button variant="ghost">Read the replay guide</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
