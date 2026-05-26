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
 * pulls from fixture defaults.
 */

import Link from 'next/link';
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

export default function MedpayVerticalConfigPage(): JSX.Element {
  const dossiers = listAllDossiers();
  const medpayLenders = dossiers.filter(
    (d) => d.lender.brands.length === 0 || d.lender.brands.includes('medpay'),
  );

  return (
    <div style={{ padding: 32, maxWidth: 1180, margin: '0 auto', color: '#e2e8f0' }}>
      <Link href="/admin" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <header style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#5eead4', fontWeight: 700 }}>
          VERTICAL CONFIG · MEDPAY
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 30, fontWeight: 700 }}>MedPay configuration</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 720 }}>
          What MedPay is, in one screen. This is the demo's step 2 — lenders see we have a real,
          operating vertical with its own lender allowlist, routing policy, and economics.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 16 }}>
        <Section
          title="Allowed lenders"
          subtitle={`${medpayLenders.length} lender${medpayLenders.length === 1 ? '' : 's'} configured for MedPay`}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
            {medpayLenders.map(({ lender, economics, integration }) => (
              <Link
                key={lender.id}
                href={`/lender-marketplace/${lender.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    padding: 14,
                    border: '1px solid #1f2937',
                    borderRadius: 10,
                    background: '#020617',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <strong style={{ fontSize: 13.5 }}>{lender.displayName}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        color:
                          integration.apiHealth === 'healthy'
                            ? '#86efac'
                            : integration.apiHealth === 'unwired'
                              ? '#a3b8d4'
                              : '#fcd34d',
                      }}
                    >
                      ● {integration.apiHealth}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, color: '#64748b', fontSize: 11 }}>
                    Tiers: {lender.servesTiers.join(', ')}
                  </div>
                  <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11.5 }}>
                    Kickback: {(economics.kickbackBps / 100).toFixed(2)}%
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Decision-engine routing policy">
          <Row label="Mode">
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                background: '#1e3a5f',
                color: '#7dd3fc',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {MEDPAY_DEFAULTS.routingMode.toUpperCase()}
            </span>
          </Row>
          <Row label="Notes">{MEDPAY_DEFAULTS.routingNotes}</Row>
        </Section>

        <Section title="Application form schema">
          <Row label="Schema slug">
            <code style={{ color: '#a5b4fc', fontSize: 12 }}>{MEDPAY_DEFAULTS.formSchemaSlug}</code>
          </Row>
          <Row label="Captured fields">
            <ul style={{ margin: 0, paddingLeft: 16, color: '#cbd5e1' }}>
              {MEDPAY_DEFAULTS.formFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Row>
        </Section>

        <Section title="Branding defaults (consumer surface)">
          <Row label="Primary">
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: MEDPAY_DEFAULTS.branding.primary,
                  border: '1px solid #1f2937',
                }}
              />
              <code style={{ color: '#cbd5e1', fontSize: 12 }}>
                {MEDPAY_DEFAULTS.branding.primary}
              </code>
            </span>
          </Row>
          <Row label="Primary glow">
            <code style={{ color: '#cbd5e1', fontSize: 12 }}>
              {MEDPAY_DEFAULTS.branding.primaryGlow}
            </code>
          </Row>
          <Row label="Surface">
            <code style={{ color: '#cbd5e1', fontSize: 12 }}>
              {MEDPAY_DEFAULTS.branding.surface}
            </code>
          </Row>
          <Row label="Eyebrow text">
            <code style={{ color: '#cbd5e1', fontSize: 12 }}>
              {MEDPAY_DEFAULTS.branding.eyebrow}
            </code>
          </Row>
        </Section>

        <Section title="Fee economics">
          <Row label="Our cut">{(MEDPAY_DEFAULTS.economics.ourCutBps / 100).toFixed(2)}%</Row>
          <Row label="Partner cut">
            {(MEDPAY_DEFAULTS.economics.partnerCutBps / 100).toFixed(2)}%
          </Row>
          <Row label="Consumer-paid origination">
            {(MEDPAY_DEFAULTS.economics.consumerOriginationBps / 100).toFixed(2)}%
          </Row>
          <Row label="Notes">{MEDPAY_DEFAULTS.economics.notes}</Row>
        </Section>
      </div>
    </div>
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
    <div
      style={{
        padding: 22,
        border: '1px solid #1f2937',
        borderRadius: 12,
        background: '#0f172a',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
        {subtitle && <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ display: 'grid', gap: 9 }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14, alignItems: 'baseline' }}
    >
      <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontSize: 13.5 }}>{children}</div>
    </div>
  );
}
