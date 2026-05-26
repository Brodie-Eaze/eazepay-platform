import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  CardHeader,
  StatusPill,
  type StatusTone,
} from '@eazepay/ui/web';
import { PublicPageShell } from '../../components/PublicPageShell';

/**
 * Public security & compliance overview — `/security-overview`. No auth.
 *
 * Deviation from the spec's `/security` path: the authenticated 2FA
 * page already owns `/security` and a master operator's user-menu links
 * to it. This page lives at `/security-overview` so the existing
 * account-security surface stays intact; the footer + naked-header link
 * point here.
 *
 * Copy rule: every line is true today. "In progress" never says
 * "certified". The page exists to set expectations honestly, not to
 * pad the compliance section with logos we haven't earned.
 */

interface ComplianceRow {
  name: string;
  status: string;
  tone: StatusTone;
  detail: string;
}

const COMPLIANCE_ROWS: ReadonlyArray<ComplianceRow> = [
  {
    name: 'SOC 2 Type I',
    status: 'In progress',
    tone: 'warning',
    detail: 'Readiness underway with an external auditor. Target report: Q3 2026.',
  },
  {
    name: 'SOC 2 Type II',
    status: 'Scheduled',
    tone: 'neutral',
    detail: 'Observation window opens after Type I. Target report: Q1 2027.',
  },
  {
    name: 'PCI DSS',
    status: 'Scope minimized',
    tone: 'success',
    detail:
      'No PAN or CVV touches the platform — card data is tokenized at the MiCamp processor, ' +
      'we hold only the resulting tokens. SAQ-A boundary.',
  },
  {
    name: 'FCRA',
    status: 'Enforced',
    tone: 'success',
    detail:
      'Soft-pull consent is verified at every credit decision boundary. The consent ledger is ' +
      'append-only and audit-replayable.',
  },
  {
    name: 'Reg B (ECOA)',
    status: 'Enforced',
    tone: 'success',
    detail:
      'Adverse-action reason codes are mapped to the CFPB Model Form C-1 codes. Adverse-action ' +
      'notices are generated from the decision trace, not the UI.',
  },
  {
    name: 'GDPR / CCPA',
    status: 'Runbook documented',
    tone: 'success',
    detail:
      'Right-to-erasure is executed via a documented operator runbook with a per-tenant export ' +
      'and a cryptographic shred of consent + PII columns.',
  },
];

const SECURITY_PRACTICES: ReadonlyArray<{ title: string; detail: string }> = [
  {
    title: 'HMAC-verified webhooks',
    detail:
      'Every inbound lender / partner webhook is HMAC-verified against a per-source signing key ' +
      'before the handler runs. Fail-closed in production — unsigned or wrong-signed payloads are ' +
      'rejected at the edge.',
  },
  {
    title: '256-bit TLS in transit',
    detail:
      'Every request to the platform terminates on TLS 1.2+ with modern cipher suites. HSTS is ' +
      'set on every response from the edge.',
  },
  {
    title: 'At-rest encryption',
    detail:
      'Managed Postgres on Railway with disk-level AES-256 encryption. PII columns are additionally ' +
      'column-encrypted with envelope keys held in a separate KMS-equivalent secret store.',
  },
  {
    title: 'Audit log of every privileged action',
    detail:
      'Every admin / operator action lands in an append-only audit log keyed by actor, tenant, ' +
      'action, and request id (SOC 2 CC8.1 control). The log is queryable by the operator and ' +
      'exported nightly to cold storage.',
  },
  {
    title: 'Penetration testing',
    detail:
      'External pen test engagement on the platform boundary. Cadence + provider details under ' +
      'NDA — request via security@eazepay.com.',
  },
];

const SUBPROCESSORS: ReadonlyArray<{ name: string; purpose: string }> = [
  { name: 'HighSale', purpose: 'Pre-qualification + soft-pull bureau routing' },
  { name: 'MiCamp', purpose: 'Card processing, ACH origination' },
  { name: 'Pusher', purpose: 'Realtime event fan-out to portal clients' },
  { name: 'Resend', purpose: 'Transactional email (decisions, invoices, notifications)' },
  { name: 'Railway', purpose: 'Application + managed Postgres infrastructure' },
];

export default function SecurityOverviewPage() {
  return (
    <PublicPageShell>
      <PageHeader
        title="Security & Compliance"
        description="Architecture, certifications, and security practices for the EazePay platform. Last reviewed 2026-05-26."
        actions={
          <StatusPill tone="success" dot>
            Production live
          </StatusPill>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Architecture overview"
              description="High-level data flow across the platform boundary."
            />
            <CardBody>
              <p className="text-[13px] text-fg-secondary leading-relaxed">
                EazePay is a multi-tenant orchestration platform sitting between merchant brands
                (MedPay, TradePay, CoachPay) and a marketplace of lender adapters. Consumer PII
                lives only inside the application service; credit decisions are computed against a
                normalized applicant context and a per-tenant policy bundle. Card data never touches
                the platform — it is tokenized at the MiCamp processor.
              </p>
              <p className="text-[12px] text-fg-muted mt-3">
                Architecture diagram available under NDA — request via{' '}
                <a href="mailto:security@eazepay.com" className="text-accent hover:underline">
                  security@eazepay.com
                </a>
                .
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Responsible disclosure"
              description="We work with security researchers on a 90-day disclosure window."
            />
            <CardBody>
              <ul className="space-y-2 text-[13px] text-fg-secondary">
                <li>
                  Report:{' '}
                  <a href="mailto:security@eazepay.com" className="text-accent hover:underline">
                    security@eazepay.com
                  </a>
                </li>
                <li>Disclosure window: 90 days from acknowledgment, by default</li>
                <li>PGP key: published at /.well-known/security.txt (placeholder)</li>
                <li>Safe-harbor: good-faith research is protected; no legal action</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card className="mt-4">
          <CardHeader
            title="Compliance posture"
            description="Every line is current as of the review date. We do not list certifications we have not earned."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {COMPLIANCE_ROWS.map((row) => (
                <li
                  key={row.name}
                  className="grid grid-cols-12 items-start gap-3 px-5 py-4 text-[13px]"
                >
                  <div className="col-span-12 sm:col-span-3">
                    <p className="font-semibold text-fg">{row.name}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <StatusPill tone={row.tone} dot>
                      {row.status}
                    </StatusPill>
                  </div>
                  <div className="col-span-12 sm:col-span-7 text-fg-secondary leading-relaxed">
                    {row.detail}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader
            title="Security practices"
            description="The controls behind the posture above."
          />
          <CardBody>
            <ul className="space-y-4">
              {SECURITY_PRACTICES.map((practice) => (
                <li key={practice.title}>
                  <p className="text-[13px] font-semibold text-fg">{practice.title}</p>
                  <p className="text-[12px] text-fg-muted mt-1 leading-relaxed">
                    {practice.detail}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="mt-4">
          <CardHeader
            title="Subprocessors"
            description="The third parties that process tenant data on our behalf. Notice of material change goes out 30 days before activation."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-border">
              {SUBPROCESSORS.map((sub) => (
                <li
                  key={sub.name}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-[13px]"
                >
                  <div className="col-span-4 sm:col-span-3 font-semibold text-fg">{sub.name}</div>
                  <div className="col-span-8 sm:col-span-9 text-fg-secondary">{sub.purpose}</div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </PageBody>
    </PublicPageShell>
  );
}
