'use client';
import { notFound } from 'next/navigation';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  StatusPill,
  RouteTimeline,
  DataRow,
  MaskedField,
  Money,
  Apr,
  Banner,
  Tabs,
  AlertIcon,
  CheckIcon,
  ShieldIcon,
  ArrowRightIcon,
  BankIcon,
} from '@eazepay/ui/web';
import { queueApplications, exampleRouteStepsAdmin, fmtDate } from '../../../lib/mock-data';

export default function ApplicationWorkspace({ params }: { params: { id: string } }) {
  const app = queueApplications.find((a) => a.id === params.id);
  if (!app) notFound();

  const decisionAllowed = app.status === 'manual_review' || app.status === 'offers_presented' || app.status === 'docs_required';

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/' }, { label: 'Queue', href: '/queue' }, { label: app.id }]}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono text-[18px]">{app.id}</span>
            <StatusPill tone="info">{app.status.replace('_', ' ')}</StatusPill>
            {app.hold && <StatusPill tone="danger" icon={<AlertIcon size={11} />}>{app.hold.toUpperCase()} hold</StatusPill>}
          </span>
        }
        description={`Submitted ${fmtDate(app.submittedAt)} · ${app.channel === 'merchant' ? `via ${app.merchantName}` : 'Consumer direct'} · Risk ${app.riskScore} · ${app.routedLenderCount} lenders evaluated`}
        meta={
          <>
            <StatusPill tone="accent">{app.category.replace('_', ' ')}</StatusPill>
            <StatusPill tone="info">Permissible purpose 604(a)(3)(A)</StatusPill>
            {decisionAllowed && <StatusPill tone="warning" dot>Awaiting decision</StatusPill>}
          </>
        }
        actions={
          <>
            <Button variant="ghost">Send to compliance</Button>
            <Button variant="ghost">Request docs</Button>
            <Button>Open in partner view</Button>
          </>
        }
      />
      <PageBody>
        {app.hold && (
          <Banner intent="danger" className="mb-5" title="Compliance hold — SAR pre-filing">
            This application is paused pending dual-control review. PII unmask requires approver. All
            actions from here on are written to the audit chain with reason codes.
          </Banner>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left column: workspace */}
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader title="Lender route inspector" description="Cross-tier evaluation order with full visibility. Reasoning, latency, policy version." />
              <CardBody>
                <RouteTimeline steps={exampleRouteStepsAdmin} />
                <div className="mt-4 grid grid-cols-4 gap-3 pt-4 border-t border-border">
                  <Stat label="Tiers evaluated" value="3" />
                  <Stat label="Lenders evaluated" value={app.routedLenderCount} />
                  <Stat label="Total latency" value="2.7s" />
                  <Stat label="Policy version" value={<span className="font-mono text-[12px]">orch_v_2026_05_a</span>} />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Underwriting inputs" description="Snapshot at decision-time. Reproducible from policy version + snapshot hash." />
              <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                <div>
                  <DataRow label="Requested" value={<Money cents={app.requestedCents} noFractions />} />
                  <DataRow label="Term" value={`${app.termMonths} months`} />
                  <DataRow label="Purpose" value={app.category.replace('_', ' ')} />
                  <DataRow label="Channel" value={app.channel === 'merchant' ? `Merchant · ${app.merchantName}` : 'Consumer direct'} />
                  <DataRow label="State" value={app.state} />
                </div>
                <div>
                  <DataRow label="FICO band" value="740–779" />
                  <DataRow label="DTI" value="28.4%" />
                  <DataRow label="Cashflow score" value="0.84" />
                  <DataRow label="Stability" value="4.2 yr residence · 5.1 yr employer" />
                  <DataRow label="Income (verified)" value={<Money cents={684_00 * 10} noFractions />} />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Decision" description="Approve, decline, counter-offer, or escalate. Decline requires two Reg B reason codes from the taxonomy." />
              <CardBody>
                <Tabs
                  active="approve"
                  onChange={() => {}}
                  items={[
                    { key: 'approve', label: 'Approve' },
                    { key: 'counter', label: 'Counter-offer' },
                    { key: 'decline', label: 'Decline' },
                    { key: 'escalate', label: 'Escalate' },
                  ]}
                  className="mb-4"
                />
                <div className="grid grid-cols-2 gap-4">
                  <DataRow label="Recommended offer" value="Evergreen Prime · 60mo · 10.99% APR · $40,142/mo" />
                  <DataRow label="Lender of record" value="Cross River Bank" />
                  <DataRow label="Estimated funded" value={<Money cents={app.requestedCents} noFractions />} />
                  <DataRow label="EazePay fee" value={<Money cents={app.requestedCents * 0.012} />} />
                </div>
              </CardBody>
              <CardFooter>
                <Button variant="ghost">Save draft decision</Button>
                <Button disabled={!decisionAllowed}>Approve & present offer</Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Card>
              <CardHeader title="Applicant" description="JIT unmask required for PII." action={<StatusPill tone="info" icon={<ShieldIcon size={12} />}>PII masked</StatusPill>} />
              <CardBody className="space-y-3">
                <MaskedField label="Legal name" masked="J••••• M••••••" />
                <MaskedField label="DOB" masked="••/••/19••" />
                <MaskedField label="SSN" masked="•••-••-1284" />
                <MaskedField label="Address" masked="••• ••••• St · Houston, TX ••••5" />
                <MaskedField label="Email" masked="j••@••••mail.com" />
                <MaskedField label="Phone" masked="(•••) •••-2104" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Risk & compliance signals" />
              <CardBody className="space-y-3 text-[13px]">
                {[
                  ['OFAC SDN screen', 'Clear · 18:41Z', true],
                  ['PEP screen', 'Clear', true],
                  ['MLA covered borrower', 'Not covered', true],
                  ['SCRA status', 'Civilian', true],
                  ['Identity theft red flags', 'No discrepancies', true],
                  ['Velocity (24h)', '1 application', true],
                  ['Device fingerprint', 'Trusted (412d)', true],
                  ['Plaid Signal score', '0.93 — low risk', true],
                ].map(([k, v, ok]) => (
                  <div key={k as string} className="flex items-start gap-3">
                    {ok ? <CheckIcon size={14} className="text-success mt-0.5 shrink-0" /> : <AlertIcon size={14} className="text-warning mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{k}</div>
                      <div className="text-fg-muted text-[12px]">{v}</div>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Bank cashflow (Plaid)" />
              <CardBody className="space-y-1">
                <DataRow label="Avg monthly inflow" value={<Money cents={8_412_00} noFractions />} />
                <DataRow label="Avg monthly outflow" value={<Money cents={6_104_00} noFractions />} />
                <DataRow label="NSF events (90d)" value="0" />
                <DataRow label="Min balance (30d)" value={<Money cents={1_287_00} noFractions />} />
                <a href="#" className="flex items-center gap-1.5 text-[12px] text-accent mt-2">
                  <BankIcon size={12} /> View full transaction set <ArrowRightIcon size={12} />
                </a>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Activity" />
              <CardBody className="space-y-2 text-[12px]">
                {[
                  ['Application submitted', fmtDate(app.submittedAt), 'system'],
                  ['Soft pull consent', fmtDate(app.submittedAt), 'applicant'],
                  ['Bureau soft pull', fmtDate(app.submittedAt), 'system'],
                  ['Orchestration evaluated', '+1s', 'system'],
                  ['Offers presented', '+3s', 'system'],
                ].map(([what, when, who]) => (
                  <div key={what} className="flex items-center justify-between gap-2 border-b border-border last:border-b-0 py-1.5">
                    <span className="text-fg">{what}</span>
                    <span className="text-fg-muted tabular-nums">{when} · {who}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-fg-muted font-semibold">{label}</div>
    <div className="text-[14px] mt-0.5 font-medium tabular-nums">{value}</div>
  </div>
);
