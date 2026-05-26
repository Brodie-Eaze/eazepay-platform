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
 * Server component — `notFound()` is invoked when the id is unknown.
 *
 * Refactored 2026-05: zero inline styles, `@eazepay/ui/web` primitives
 * (PageHeader/PageBody/Card/StatusPill/Button), token-class colours
 * only. HEALTH_TONE hex map replaced with semantic StatusPill tones.
 */

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardBody,
  Button,
  StatusPill,
  ArrowRightIcon,
  type StatusTone,
} from '@eazepay/ui/web';
import { formatBps } from '@eazepay/shared-utils/format-bps';
import { formatCurrencyCents } from '@eazepay/shared-utils/format-currency';
import { formatTime } from '@eazepay/shared-utils/format-time';
import { getLenderDossier, type ApiHealth } from '@/lib/lender-economics';
import { tierLabel } from '@/lib/marketplace-data';

const HEALTH_TONE: Record<ApiHealth, { label: string; tone: StatusTone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warning' },
  down: { label: 'Down', tone: 'danger' },
  unwired: { label: 'Not yet wired', tone: 'neutral' },
};

export default function LenderDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const dossier = getLenderDossier(params.id);
  if (!dossier) notFound();

  const { lender, economics, integration, notes } = dossier;
  const health = HEALTH_TONE[integration.apiHealth];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Lender marketplace', href: '/lender-marketplace' },
          { label: lender.displayName },
        ]}
        title={lender.displayName}
        description={lender.legalName}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill tone={health.tone} dot>
              {health.label}
            </StatusPill>
            <StatusPill tone={lender.globallyEnabled ? 'success' : 'neutral'} dot>
              {lender.globallyEnabled ? 'Globally enabled' : 'Paused'}
            </StatusPill>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — coverage + economics + integration health */}
          <div className="lg:col-span-2 grid gap-4">
            <Section title="Coverage">
              <Row label="Brands">
                {lender.brands.length ? lender.brands.join(', ') : 'All brands'}
              </Row>
              <Row label="Credit tiers">
                {lender.servesTiers.map((t) => tierLabel[t]).join(' · ')}
              </Row>
              <Row label="Amount envelope">
                {formatCurrencyCents(lender.minAmountCents)} –{' '}
                {formatCurrencyCents(lender.maxAmountCents)}
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
                  <em className="text-fg-muted not-italic">
                    House lender — full lender economics retained
                  </em>
                ) : (
                  formatBps(economics.kickbackBps)
                )}
              </Row>
              <Row label="Per-loan flat fee">{formatCurrencyCents(economics.perLoanFeeCents)}</Row>
              <Row label="Exclusivity">{economics.exclusivityTerms ?? 'None'}</Row>
              <Row label="Volume bonus">{economics.volumeBonus ?? 'None'}</Row>
            </Section>

            <Section title="API integration health">
              <Row label="Status">
                <StatusPill tone={health.tone} dot>
                  {health.label}
                </StatusPill>
              </Row>
              <Row label="Last sync">
                {integration.lastSyncAt
                  ? formatTime(integration.lastSyncAt, { mode: 'datetime' })
                  : '—'}
              </Row>
              <Row label="p95 latency">
                {integration.p95LatencyMs == null ? '—' : `${integration.p95LatencyMs} ms`}
              </Row>
              <Row label="Error rate (1k window)">
                {integration.errorRate == null
                  ? '—'
                  : `${(integration.errorRate * 100).toFixed(2)}%`}
              </Row>
              <Row label="Webhook URL">
                {integration.webhookUrl ? (
                  <code className="text-[12px] text-accent font-mono break-all">
                    {integration.webhookUrl}
                  </code>
                ) : (
                  '—'
                )}
              </Row>
              <Row label="Webhook secret">
                {integration.webhookSecretConfigured ? (
                  <span className="text-success">Configured</span>
                ) : (
                  <span className="text-warning">Not configured</span>
                )}
              </Row>
            </Section>
          </div>

          {/* Right column — ownership, notes, pending integration, actions */}
          <div className="grid gap-4 content-start">
            <Section title="Internal ownership">
              <Row label="Internal owner">{notes.ownerInternal}</Row>
              <Row label="External contact">{notes.ownerExternal ?? '—'}</Row>
            </Section>

            {notes.freeform && (
              <Section title="Notes">
                <div className="text-[13px] text-fg-secondary leading-relaxed">
                  {notes.freeform}
                </div>
              </Section>
            )}

            {lender.pendingIntegration && (
              <Section title="Pending integration">
                <div className="text-[12.5px] text-warning leading-relaxed">
                  {lender.pendingIntegration.note}
                </div>
                <div className="mt-2 text-[11.5px] text-fg-muted">
                  Adapter file:{' '}
                  <code className="text-accent font-mono break-all">
                    {lender.pendingIntegration.adapterFilePath}
                  </code>
                </div>
              </Section>
            )}

            <Section title="Actions">
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm">
                  {lender.globallyEnabled ? 'Pause lender' : 'Resume lender'}
                </Button>
                <Button variant="secondary" size="sm">
                  Rotate webhook secret
                </Button>
                <Button variant="secondary" size="sm">
                  Run health check
                </Button>
                <Link
                  href={`/lender-marketplace/access?focusLender=${lender.id}`}
                  className="inline-flex items-center justify-between gap-1.5 h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-accent hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  View partner overrides
                  <ArrowRightIcon size={12} />
                </Link>
              </div>
            </Section>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Card>
      <CardBody>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-fg-muted mb-3">
          {title}
        </div>
        <div className="grid gap-2.5">{children}</div>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-baseline">
      <div className="text-[12px] text-fg-muted">{label}</div>
      <div className="text-[13px] text-fg-secondary min-w-0">{children}</div>
    </div>
  );
}
