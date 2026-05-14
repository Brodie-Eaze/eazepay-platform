import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  DataRow,
  Button,
  StatusPill,
} from '@eazepay/ui/web';

export default function AdminSettings() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Settings' }]}
        title="Settings"
        description="Org, roles, SSO, and integrations."
      />
      <PageBody>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Authentication" action={<Button size="sm" variant="ghost">Edit</Button>} />
            <CardBody>
              <DataRow label="SSO provider" value="Okta · OIDC" />
              <DataRow label="MFA enforcement" value={<StatusPill tone="success">All roles</StatusPill>} />
              <DataRow label="Hardware key required" value="Admin · UW Sr · Compliance" />
              <DataRow label="Session length" value="8h sliding · 30d refresh" />
              <DataRow label="JIT prod access" value={<StatusPill tone="info">Enabled · 30m grants</StatusPill>} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Roles" />
            <CardBody className="space-y-2">
              {[
                ['Admin', 9, 'Full access · hardware key'],
                ['Senior UW', 7, 'Approve up to $50k · dual-control above'],
                ['UW Analyst', 12, 'Approve up to $15k · escalate above'],
                ['Compliance', 4, 'Read-most · cannot mutate financial state'],
                ['Support', 6, 'Scoped to active ticket · purpose-bound PII'],
                ['Read-only auditor', 3, 'Audit log only · 90-day window'],
              ].map(([role, count, desc]) => (
                <div key={role as string} className="flex items-start gap-3 py-1.5 border-b border-border last:border-b-0">
                  <div className="flex-1">
                    <div className="font-medium">{role}</div>
                    <div className="text-[12px] text-fg-muted">{desc}</div>
                  </div>
                  <span className="text-[12px] text-fg-muted tabular-nums">{count} members</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Integrations" />
            <CardBody>
              <DataRow label="KYC" value="Alloy → Persona + Socure" />
              <DataRow label="Bureau" value="Experian (primary) + TransUnion (fallback)" />
              <DataRow label="Bank data" value="Plaid · MX (DR)" />
              <DataRow label="Sanctions" value="ComplyAdvantage" />
              <DataRow label="E-sign" value="DocuSign · Dropbox Sign (DR)" />
              <DataRow label="Card processor" value="MiCamp · single-stack acquirer" />
              <DataRow label="EZ Check processor" value="HighSale · electronic check / RCC" />
              <DataRow label="ACH origination" value="Bank-of-record direct (Cross River) · Modern Treasury (DR)" />
              <DataRow label="Bank-of-record" value="Cross River Bank · FinWise (DR)" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="System health" />
            <CardBody>
              <DataRow label="API uptime (30d)" value="99.97%" />
              <DataRow label="Last deploy" value="2026-05-04 08:15 ET · canary 100%" />
              <DataRow label="DR drill (last)" value="2026-04-12 · RTO 2h 21m · RPO 8m" />
              <DataRow label="Pen test (last)" value="2026-03-08 · 0 H / 2 M / 5 L" />
              <DataRow label="SOC 2 evidence" value={<StatusPill tone="success">Vanta · current</StatusPill>} />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
