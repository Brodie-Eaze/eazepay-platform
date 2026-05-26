/**
 * /admin/verticals/medpay — MedPay vertical configuration.
 *
 * The single page that defines what "MedPay" means at a system level.
 * This is what gets demoed to lenders as step 2 of the 8-stage walk:
 * "how MedPay is configured inside the admin portal."
 *
 * Sections:
 *   • Allowed lender set (the MedPay marketplace stack)
 *   • Decision-engine routing policy (waterfall / parallel / hybrid)
 *   • Application form schema reference
 *   • Branding defaults applied to consumer surfaces
 *   • Fee economics (our cut, partner cut, lender fees)
 *
 * Reads/writes to the `vertical_configs` table. Until DB seeding,
 * pulls from fixture defaults. Server component — no client
 * interactivity; data is rendered straight from in-process fixtures.
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

const MEDPAY_DEFAULTS = {
  routingMode: 'hybrid' as const,
  routingNotes:
    'Parallel fan-out to all eligible lenders simultaneously. Propensity-ranked offer page rendered as soon as 2+ responses arrive (50ms grace window for late responses).',
  formSchemaSlug: 'medpay_intake_v2',
  formFields: [
    'Identity (name, DOB, address)',
    'Contact (email, phone)',
    'SSN last 4',
    'Annual income + employment type',
    'Treatment type + requested amount',
    'FCRA soft-pull consent',
  ],
  branding: {
    primary: '#0d9488',
    primaryGlow: '#5eead4',
    surface: '#0a0a14',
    eyebrow: 'MEDPAY',
  },
  economics: {
    ourCutBps: 100,
    partnerCutBps: 0,
    consumerOriginationBps: 0,
    notes:
      '$10k setup fee per partner at activation. HighSale wholesale margin separate. MiCamp 50/50 split on processing rev share.',
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

export default function MedpayVerticalConfigPage(): JSX.Element {
  const dossiers = listAllDossiers();
  const medpayLenders = dossiers.filter(
    (d) => d.lender.brands.length === 0 || d.lender.brands.includes('medpay'),
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Verticals', href: '/admin' },
          { label: 'MedPay' },
        ]}
        title="MedPay configuration"
        description="What MedPay is, in one screen. The demo's step 2 — lenders see we have a real, operating vertical with its own lender allowlist, routing policy, and economics."
        meta={
          <StatusPill tone="accent" dot>
            VERTICAL · MEDPAY
          </StatusPill>
        }
      />
      <PageBody>
        <div className="grid gap-4">
          <Section
            title="Allowed lenders"
            subtitle={`${pluralize(medpayLenders.length, 'lender')} configured for MedPay`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {medpayLenders.map(({ lender, economics, integration }) => (
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
              <StatusPill tone="info">{MEDPAY_DEFAULTS.routingMode.toUpperCase()}</StatusPill>
            </Row>
            <Row label="Notes">{MEDPAY_DEFAULTS.routingNotes}</Row>
          </Section>

          <Section title="Application form schema">
            <Row label="Schema slug">
              <InlineCode>{MEDPAY_DEFAULTS.formSchemaSlug}</InlineCode>
            </Row>
            <Row label="Captured fields">
              <ul className="m-0 pl-4 text-fg-secondary list-disc space-y-0.5">
                {MEDPAY_DEFAULTS.formFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Row>
          </Section>

          <Section title="Branding defaults (consumer surface)">
            <Row label="Primary">
              <span className="inline-flex items-center gap-2">
                {/* Color swatch — visualising configured brand colour
                    from data. Per spec, inline style on the swatch
                    element only is acceptable here because the colour
                    is the data being rendered. */}
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: MEDPAY_DEFAULTS.branding.primary }}
                />
                <InlineCode>{MEDPAY_DEFAULTS.branding.primary}</InlineCode>
              </span>
            </Row>
            <Row label="Primary glow">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: MEDPAY_DEFAULTS.branding.primaryGlow }}
                />
                <InlineCode>{MEDPAY_DEFAULTS.branding.primaryGlow}</InlineCode>
              </span>
            </Row>
            <Row label="Surface">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: MEDPAY_DEFAULTS.branding.surface }}
                />
                <InlineCode>{MEDPAY_DEFAULTS.branding.surface}</InlineCode>
              </span>
            </Row>
            <Row label="Eyebrow text">
              <InlineCode>{MEDPAY_DEFAULTS.branding.eyebrow}</InlineCode>
            </Row>
          </Section>

          <Section title="Fee economics">
            <Row label="Our cut">
              <StatusPill tone="accent">
                {(MEDPAY_DEFAULTS.economics.ourCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Partner cut">
              <StatusPill tone="neutral">
                {(MEDPAY_DEFAULTS.economics.partnerCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Consumer-paid origination">
              <StatusPill tone="neutral">
                {(MEDPAY_DEFAULTS.economics.consumerOriginationBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Notes">{MEDPAY_DEFAULTS.economics.notes}</Row>
          </Section>
        </div>
      </PageBody>
    </>
  );
}

/**
 * Collapsible section helper — kept (rather than inlining `<Card>`
 * per call site) because the page has 5 near-identical sections and
 * the helper compresses the repetitive Card + Header + grid scaffold
 * into a single declarative call.
 */
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
