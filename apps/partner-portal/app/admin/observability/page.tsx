/**
 * /admin/observability — Operational health dashboard.
 *
 * Single screen for the demo step "this is enterprise-grade
 * infrastructure, not Zapier and a spreadsheet." Surfaces:
 *
 *   • Application volume across the platform (last 24h, last 7d)
 *   • Decision engine latency (p50, p95, p99)
 *   • Lender health summary (healthy / degraded / unwired)
 *   • Webhook delivery success rate
 *   • Queue depth (provisioning, migrations, outcome notifications)
 *
 * Demo data for now. Wire to real metrics via the api-v1 layer once
 * Prometheus is plumbed.
 */

import Link from 'next/link';
import { listAllDossiers } from '@/lib/lender-economics';

const METRICS = {
  applications: { last24h: 312, last7d: 1842, mom: '+18%' },
  decisionLatency: { p50: 84, p95: 412, p99: 1180 },
  webhookDelivery: { success: 0.9947, attempts24h: 21_847 },
  queues: {
    provisioning: { depth: 3, oldestAgeS: 142 },
    migrations: { depth: 0, oldestAgeS: null },
    outcomeNotifications: { depth: 12, oldestAgeS: 38 },
  },
};

export default function ObservabilityPage(): JSX.Element {
  const dossiers = listAllDossiers();
  const healthBuckets = {
    healthy: dossiers.filter((d) => d.integration.apiHealth === 'healthy').length,
    degraded: dossiers.filter((d) => d.integration.apiHealth === 'degraded').length,
    down: dossiers.filter((d) => d.integration.apiHealth === 'down').length,
    unwired: dossiers.filter((d) => d.integration.apiHealth === 'unwired').length,
  };

  return (
    <div style={{ padding: 32, maxWidth: 1240, margin: '0 auto', color: '#e2e8f0' }}>
      <Link href="/admin" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>
        ← Admin
      </Link>

      <header style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
          OBSERVABILITY
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>Operational health</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 660 }}>
          Platform-wide health at a glance. Per-lender drill-in via the marketplace registry.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <KpiTile
          label="Applications (24h)"
          value={METRICS.applications.last24h.toLocaleString()}
          sub={`7d: ${METRICS.applications.last7d.toLocaleString()} · MoM ${METRICS.applications.mom}`}
        />
        <KpiTile
          label="Decision p95"
          value={`${METRICS.decisionLatency.p95}ms`}
          sub={`p50 ${METRICS.decisionLatency.p50}ms · p99 ${METRICS.decisionLatency.p99}ms`}
        />
        <KpiTile
          label="Webhook success"
          value={`${(METRICS.webhookDelivery.success * 100).toFixed(2)}%`}
          sub={`${METRICS.webhookDelivery.attempts24h.toLocaleString()} attempts (24h)`}
        />
        <KpiTile
          label="Lenders healthy"
          value={`${healthBuckets.healthy} / ${dossiers.length}`}
          sub={`${healthBuckets.degraded} degraded · ${healthBuckets.unwired} unwired`}
          tone={healthBuckets.degraded + healthBuckets.down > 0 ? 'warn' : 'ok'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div
          style={{
            padding: 22,
            border: '1px solid #1f2937',
            borderRadius: 12,
            background: '#0f172a',
          }}
        >
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Lender health summary</h2>
          <div style={{ display: 'grid', gap: 9 }}>
            {dossiers.map((d) => {
              const tone =
                d.integration.apiHealth === 'healthy'
                  ? '#86efac'
                  : d.integration.apiHealth === 'degraded'
                    ? '#fcd34d'
                    : d.integration.apiHealth === 'down'
                      ? '#fca5a5'
                      : '#a3b8d4';
              return (
                <Link
                  key={d.lender.id}
                  href={`/lender-marketplace/${d.lender.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr auto auto auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: '#020617',
                    border: '1px solid transparent',
                    color: 'inherit',
                    textDecoration: 'none',
                    fontSize: 12.5,
                  }}
                >
                  <strong style={{ color: '#e2e8f0' }}>{d.lender.displayName}</strong>
                  <span style={{ color: tone, fontWeight: 700 }}>● {d.integration.apiHealth}</span>
                  <span style={{ color: '#94a3b8' }}>
                    p95{' '}
                    {d.integration.p95LatencyMs == null ? '—' : `${d.integration.p95LatencyMs}ms`}
                  </span>
                  <span style={{ color: '#94a3b8' }}>
                    err{' '}
                    {d.integration.errorRate == null
                      ? '—'
                      : `${(d.integration.errorRate * 100).toFixed(2)}%`}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: 22,
            border: '1px solid #1f2937',
            borderRadius: 12,
            background: '#0f172a',
          }}
        >
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Queue depth</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <QueueTile
              name="Provisioning"
              depth={METRICS.queues.provisioning.depth}
              oldestAgeS={METRICS.queues.provisioning.oldestAgeS}
              link="/admin/provisioning"
            />
            <QueueTile
              name="Customer migrations"
              depth={METRICS.queues.migrations.depth}
              oldestAgeS={METRICS.queues.migrations.oldestAgeS}
              link="/admin/migrations/ai-funding"
            />
            <QueueTile
              name="Outcome notifications"
              depth={METRICS.queues.outcomeNotifications.depth}
              oldestAgeS={METRICS.queues.outcomeNotifications.oldestAgeS}
              link={null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'ok' | 'warn';
}): JSX.Element {
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
          fontSize: 11.5,
          color: '#94a3b8',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          marginTop: 6,
          color: tone === 'warn' ? '#fcd34d' : '#e2e8f0',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function QueueTile({
  name,
  depth,
  oldestAgeS,
  link,
}: {
  name: string;
  depth: number;
  oldestAgeS: number | null;
  link: string | null;
}): JSX.Element {
  const ageDisplay =
    oldestAgeS == null
      ? '—'
      : oldestAgeS < 60
        ? `${oldestAgeS}s`
        : `${Math.round(oldestAgeS / 60)}m`;
  const content = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 12,
        alignItems: 'baseline',
      }}
    >
      <strong style={{ fontSize: 13 }}>{name}</strong>
      <span style={{ fontSize: 13, color: '#94a3b8' }}>depth {depth}</span>
      <span style={{ fontSize: 12, color: '#64748b' }}>oldest {ageDisplay}</span>
    </div>
  );
  if (!link) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#020617' }}>{content}</div>
    );
  }
  return (
    <Link
      href={link}
      style={{
        display: 'block',
        padding: '10px 12px',
        borderRadius: 8,
        background: '#020617',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      {content}
    </Link>
  );
}
