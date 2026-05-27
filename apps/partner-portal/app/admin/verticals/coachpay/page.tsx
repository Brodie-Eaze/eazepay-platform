/**
 * /admin/verticals/coachpay — CoachPay vertical configuration.
 *
 * Sister page to /admin/verticals/medpay + tradepay. Defines what
 * "CoachPay" means at a system level — coaching, certifications,
 * courses (lower AOV, higher volume than the other two verticals).
 *
 * Sections mirror the other vertical pages so lenders walking the
 * platform see a consistent shape regardless of which vertical we
 * demo.
 */

import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  StatusPill,
  InlineCode,
  type StatusTone,
} from '@eazepay/ui/web';
import { pluralize } from '@eazepay/shared-utils/pluralize';
import { listAllDossiers } from '@/lib/lender-economics';

const COACHPAY_DEFAULTS = {
  routingMode: 'parallel' as const,
  routingNotes:
    'Parallel fan-out across coaching-friendly lenders. Lower-ticket AOV ($1k–$10k) + repeat-purchase model means the offer engine prioritises lenders with the lightest declines on thin-file applicants.',
  formSchemaSlug: 'coachpay_intake_v2',
  formFields: [
    'Identity (name, DOB, address)',
    'Contact (email, phone)',
    'SSN last 4',
    'Annual income + occupation',
    'Course/certification + tuition amount',
    'Provider (coach business) + start date',
    'FCRA soft-pull consent',
  ],
  branding: {
    primary: '#7c3aed',
    primaryGlow: '#c4b5fd',
    surface: '#0a0a14',
    eyebrow: 'COACHPAY',
  },
  economics: {
    ourCutBps: 100,
    partnerCutBps: 0,
    consumerOriginationBps: 0,
    notes:
      '$10k setup fee per partner at activation. HighSale wholesale margin separate. Highest application volume of the three verticals (coaching has continuous intake) — bps cut compounds via volume rather than per-loan ticket size.',
  },
};

function healthTone(h: 'healthy' | 'degraded' | 'down' | 'unwired'): StatusTone {
  switch (h) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'down':
      return 'danger';
    case 'unwired':
    default:
      return 'neutral';
  }
}

export default function CoachpayVerticalConfigPage(): JSX.Element {
  const dossiers = listAllDossiers();
  const coachpayLenders = dossiers.filter(
    (d) => d.lender.brands.length === 0 || d.lender.brands.includes('coachpay'),
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Verticals', href: '/admin' },
          { label: 'CoachPay' },
        ]}
        title="CoachPay settings"
        description="What CoachPay is, in one screen. Lenders see this when we walk them through the platform."
        meta={
          <StatusPill tone="accent" dot>
            VERTICAL · COACHPAY
          </StatusPill>
        }
      />
      <PageBody>
        <div className="grid gap-4">
          <Section
            title="Allowed lenders"
            subtitle={`${pluralize(coachpayLenders.length, 'lender')} configured for CoachPay`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {coachpayLenders.map(({ lender, economics, integration }) => (
                <Link
                  key={lender.id}
                  href={`/lender-marketplace/${lender.id}`}
                  className="block rounded-lg border border-border bg-bg-muted/40 hover:bg-bg-muted hover:border-border-strong p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-[13.5px] text-fg">{lender.displayName}</strong>
                    <StatusPill tone={healthTone(integration.apiHealth)} dot>
                      {integration.apiHealth}
                    </StatusPill>
                  </div>
                  <div className="mt-1.5 text-[11px] text-fg-muted">
                    Tiers: {lender.servesTiers.join(', ')}
                  </div>
                  <div className="mt-1 text-[11.5px] text-fg-secondary">
                    Kickback: {(economics.kickbackBps / 100).toFixed(2)}%
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Decision-engine routing policy">
            <Row label="Mode">
              <StatusPill tone="info">{COACHPAY_DEFAULTS.routingMode.toUpperCase()}</StatusPill>
            </Row>
            <Row label="Notes">{COACHPAY_DEFAULTS.routingNotes}</Row>
          </Section>

          <Section title="Application form schema">
            <Row label="Schema slug">
              <InlineCode>{COACHPAY_DEFAULTS.formSchemaSlug}</InlineCode>
            </Row>
            <Row label="Captured fields">
              <ul className="m-0 pl-4 text-fg-secondary list-disc space-y-0.5">
                {COACHPAY_DEFAULTS.formFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Row>
          </Section>

          <Section title="Branding defaults (consumer surface)">
            <Row label="Primary">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: COACHPAY_DEFAULTS.branding.primary }}
                />
                <InlineCode>{COACHPAY_DEFAULTS.branding.primary}</InlineCode>
              </span>
            </Row>
            <Row label="Primary glow">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: COACHPAY_DEFAULTS.branding.primaryGlow }}
                />
                <InlineCode>{COACHPAY_DEFAULTS.branding.primaryGlow}</InlineCode>
              </span>
            </Row>
            <Row label="Surface">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: COACHPAY_DEFAULTS.branding.surface }}
                />
                <InlineCode>{COACHPAY_DEFAULTS.branding.surface}</InlineCode>
              </span>
            </Row>
            <Row label="Eyebrow text">
              <InlineCode>{COACHPAY_DEFAULTS.branding.eyebrow}</InlineCode>
            </Row>
          </Section>

          <Section title="Fee economics">
            <Row label="Our cut">
              <StatusPill tone="accent">
                {(COACHPAY_DEFAULTS.economics.ourCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Partner cut">
              <StatusPill tone="neutral">
                {(COACHPAY_DEFAULTS.economics.partnerCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Consumer-paid origination">
              <StatusPill tone="neutral">
                {(COACHPAY_DEFAULTS.economics.consumerOriginationBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Notes">{COACHPAY_DEFAULTS.economics.notes}</Row>
          </Section>
        </div>
      </PageBody>
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <CardBody>
        <div className="grid gap-2.5">{children}</div>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1.5 sm:gap-4 sm:items-baseline">
      <div className="text-[12px] text-fg-muted font-medium">{label}</div>
      <div className="text-[13.5px] text-fg-secondary">{children}</div>
    </div>
  );
}
