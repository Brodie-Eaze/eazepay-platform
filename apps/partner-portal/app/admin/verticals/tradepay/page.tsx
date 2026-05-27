/**
 * /admin/verticals/tradepay — TradePay vertical configuration.
 *
 * Sister page to /admin/verticals/medpay. Single screen that defines
 * what "TradePay" means at a system level — what gets demoed to lenders
 * when we walk them through the platform.
 *
 * Sections:
 *   • Allowed lender set (the TradePay marketplace stack)
 *   • Decision-engine routing policy (waterfall / parallel / hybrid)
 *   • Application form schema reference
 *   • Branding defaults applied to consumer surfaces
 *   • Fee economics (our cut, partner cut, lender fees)
 *
 * Reads/writes to the `vertical_configs` table. Until DB seeding,
 * pulls from fixture defaults.
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

const TRADEPAY_DEFAULTS = {
  routingMode: 'waterfall' as const,
  routingNotes:
    'Sequential waterfall through prime → near-prime → subprime lenders. Trades vertical typically has thinner credit files; the waterfall preserves prime-pricing for qualified applicants before stepping down.',
  formSchemaSlug: 'tradepay_intake_v2',
  formFields: [
    'Identity (name, DOB, address)',
    'Contact (email, phone)',
    'SSN last 4',
    'Annual income + trade specialty (HVAC / roofing / solar / etc.)',
    'Job scope + project amount',
    'Property type + project address',
    'FCRA soft-pull consent',
  ],
  branding: {
    primary: '#ea580c',
    primaryGlow: '#fdba74',
    surface: '#0a0a14',
    eyebrow: 'TRADEPAY',
  },
  economics: {
    ourCutBps: 100,
    partnerCutBps: 0,
    consumerOriginationBps: 0,
    notes:
      '$10k setup fee per partner at activation. HighSale wholesale margin separate. Higher AOV than MedPay (roofing / solar jobs run $20k–$60k) — same bps yields better $/loan economics.',
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

export default function TradepayVerticalConfigPage(): JSX.Element {
  const dossiers = listAllDossiers();
  const tradepayLenders = dossiers.filter(
    (d) => d.lender.brands.length === 0 || d.lender.brands.includes('tradepay'),
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Verticals', href: '/admin' },
          { label: 'TradePay' },
        ]}
        title="TradePay settings"
        description="What TradePay is, in one screen. Lenders see this when we walk them through the platform."
        meta={
          <StatusPill tone="accent" dot>
            VERTICAL · TRADEPAY
          </StatusPill>
        }
      />
      <PageBody>
        <div className="grid gap-4">
          <Section
            title="Allowed lenders"
            subtitle={`${pluralize(tradepayLenders.length, 'lender')} configured for TradePay`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {tradepayLenders.map(({ lender, economics, integration }) => (
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
              <StatusPill tone="info">{TRADEPAY_DEFAULTS.routingMode.toUpperCase()}</StatusPill>
            </Row>
            <Row label="Notes">{TRADEPAY_DEFAULTS.routingNotes}</Row>
          </Section>

          <Section title="Application form schema">
            <Row label="Schema slug">
              <InlineCode>{TRADEPAY_DEFAULTS.formSchemaSlug}</InlineCode>
            </Row>
            <Row label="Captured fields">
              <ul className="m-0 pl-4 text-fg-secondary list-disc space-y-0.5">
                {TRADEPAY_DEFAULTS.formFields.map((f) => (
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
                  style={{ background: TRADEPAY_DEFAULTS.branding.primary }}
                />
                <InlineCode>{TRADEPAY_DEFAULTS.branding.primary}</InlineCode>
              </span>
            </Row>
            <Row label="Primary glow">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: TRADEPAY_DEFAULTS.branding.primaryGlow }}
                />
                <InlineCode>{TRADEPAY_DEFAULTS.branding.primaryGlow}</InlineCode>
              </span>
            </Row>
            <Row label="Surface">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3.5 rounded border border-border"
                  style={{ background: TRADEPAY_DEFAULTS.branding.surface }}
                />
                <InlineCode>{TRADEPAY_DEFAULTS.branding.surface}</InlineCode>
              </span>
            </Row>
            <Row label="Eyebrow text">
              <InlineCode>{TRADEPAY_DEFAULTS.branding.eyebrow}</InlineCode>
            </Row>
          </Section>

          <Section title="Fee economics">
            <Row label="Our cut">
              <StatusPill tone="accent">
                {(TRADEPAY_DEFAULTS.economics.ourCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Partner cut">
              <StatusPill tone="neutral">
                {(TRADEPAY_DEFAULTS.economics.partnerCutBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Consumer-paid origination">
              <StatusPill tone="neutral">
                {(TRADEPAY_DEFAULTS.economics.consumerOriginationBps / 100).toFixed(2)}%
              </StatusPill>
            </Row>
            <Row label="Notes">{TRADEPAY_DEFAULTS.economics.notes}</Row>
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
