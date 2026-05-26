/**
 * /lender-marketplace/[id] — Single lender deep-dive.
 *
 * The admin "I need to see everything about this lender" page. Surfaces:
 *   • Brand allowlist + credit tier coverage + amount envelope
 *   • Commercial economics (kickback bps, per-loan fee, exclusivity)
 *   • API integration health (last sync, p95 latency, error rate)
 *   • Webhook config status
 *   • Internal owner + free-form notes
 *   • Connection state (live / pending / unwired)
 *
 * Edits route through `/api/lenders/[id]` (scaffolded; wired to the
 * `lenders` DB table once seeding lands).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLenderDossier, type ApiHealth } from '@/lib/lender-economics';
import { tierLabel } from '@/lib/marketplace-data';

const HEALTH_TONE: Record<ApiHealth, { label: string; color: string; bg: string }> = {
  healthy: { label: 'Healthy', color: '#86efac', bg: '#14532d' },
  degraded: { label: 'Degraded', color: '#fcd34d', bg: '#5b3e1e' },
  down: { label: 'Down', color: '#fca5a5', bg: '#5b1e1e' },
  unwired: { label: 'Not yet wired', color: '#a3b8d4', bg: '#1f2937' },
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default function LenderDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const dossier = getLenderDossier(params.id);
  if (!dossier) notFound();

  const { lender, economics, integration, notes } = dossier;
  const health = HEALTH_TONE[integration.apiHealth];

  return (
    <div style={{ padding: 32, maxWidth: 1180, margin: '0 auto', color: '#e2e8f0' }}>
      <Link
        href="/lender-marketplace"
        style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}
      >
        ← Lender marketplace
      </Link>

      <header
        style={{
          marginTop: 16,
          marginBottom: 24,
          display: 'flex',
          gap: 18,
          alignItems: 'baseline',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
            LENDER DOSSIER
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700 }}>{lender.displayName}</h1>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{lender.legalName}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: health.bg,
              color: health.color,
            }}
          >
            ● {health.label}
          </span>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: lender.globallyEnabled ? '#14532d' : '#1f2937',
              color: lender.globallyEnabled ? '#86efac' : '#a3b8d4',
            }}
          >
            {lender.globallyEnabled ? 'Globally enabled' : 'Paused'}
          </span>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        {/* Left column */}
        <div style={{ display: 'grid', gap: 14 }}>
          <Section title="Coverage">
            <Row label="Brands">
              {lender.brands.length ? lender.brands.join(', ') : 'All brands'}
            </Row>
            <Row label="Credit tiers">
              {lender.servesTiers.map((t) => tierLabel[t]).join(' · ')}
            </Row>
            <Row label="Amount envelope">
              {formatCents(lender.minAmountCents)} – {formatCents(lender.maxAmountCents)}
            </Row>
            <Row label="Min FICO">{lender.minScore ?? '—'}</Row>
            <Row label="Permitted states">
              {lender.permittedStates.length === 0
                ? 'All US states'
                : lender.permittedStates.join(', ')}
            </Row>
          </Section>

          <Section title="Commercial economics">
            <Row label="Kickback (per funded loan)">
              {economics.kickbackBps === 0 ? (
                <em style={{ color: '#94a3b8' }}>House lender — full lender economics retained</em>
              ) : (
                formatBps(economics.kickbackBps)
              )}
            </Row>
            <Row label="Per-loan flat fee">{formatCents(economics.perLoanFeeCents)}</Row>
            <Row label="Exclusivity">{economics.exclusivityTerms ?? 'None'}</Row>
            <Row label="Volume bonus">{economics.volumeBonus ?? 'None'}</Row>
          </Section>

          <Section title="API integration health">
            <Row label="Status">
              <span style={{ color: health.color, fontWeight: 600 }}>{health.label}</span>
            </Row>
            <Row label="Last sync">
              {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : '—'}
            </Row>
            <Row label="p95 latency">
              {integration.p95LatencyMs == null ? '—' : `${integration.p95LatencyMs} ms`}
            </Row>
            <Row label="Error rate (1k window)">
              {integration.errorRate == null ? '—' : `${(integration.errorRate * 100).toFixed(2)}%`}
            </Row>
            <Row label="Webhook URL">
              {integration.webhookUrl ? (
                <code style={{ color: '#a5b4fc', fontSize: 12 }}>{integration.webhookUrl}</code>
              ) : (
                '—'
              )}
            </Row>
            <Row label="Webhook secret">
              {integration.webhookSecretConfigured ? '✓ Configured' : '⚠ Not configured'}
            </Row>
          </Section>
        </div>

        {/* Right column */}
        <div style={{ display: 'grid', gap: 14 }}>
          <Section title="Internal ownership">
            <Row label="Internal owner">{notes.ownerInternal}</Row>
            <Row label="External contact">{notes.ownerExternal ?? '—'}</Row>
          </Section>

          {notes.freeform && (
            <Section title="Notes">
              <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.55 }}>
                {notes.freeform}
              </div>
            </Section>
          )}

          {lender.pendingIntegration && (
            <Section title="Pending integration">
              <div style={{ color: '#fcd34d', fontSize: 12.5, lineHeight: 1.55 }}>
                {lender.pendingIntegration.note}
              </div>
              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 11.5 }}>
                Adapter file:{' '}
                <code style={{ color: '#a5b4fc' }}>
                  {lender.pendingIntegration.adapterFilePath}
                </code>
              </div>
            </Section>
          )}

          <Section title="Actions">
            <button style={actionBtn}>Pause lender</button>
            <button style={actionBtn}>Rotate webhook secret</button>
            <button style={actionBtn}>Run integration health check</button>
            <Link
              href={`/lender-marketplace/access?focusLender=${lender.id}`}
              style={{ ...actionBtnAnchor, textDecoration: 'none', display: 'block' }}
            >
              View partner-level overrides →
            </Link>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        padding: 18,
        border: '1px solid #1f2937',
        borderRadius: 12,
        background: '#0f172a',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#94a3b8',
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'grid', gap: 9 }}>{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'baseline' }}
    >
      <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e2e8f0', fontSize: 13.5 }}>{children}</div>
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '9px 12px',
  marginBottom: 8,
  border: '1px solid #334155',
  borderRadius: 8,
  background: 'transparent',
  color: '#cbd5e1',
  fontSize: 13,
  cursor: 'pointer',
};
const actionBtnAnchor: React.CSSProperties = {
  ...actionBtn,
  color: '#7dd3fc',
};
