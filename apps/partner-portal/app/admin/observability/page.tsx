'use client';

/**
 * /admin/observability — Operational health dashboard.
 *
 * Single screen for the demo step "this is enterprise-grade
 * infrastructure, not Zapier and a spreadsheet." Surfaces:
 *
 *   • Application volume + decision throughput (from in-process counters)
 *   • Webhook queued / duplicate / rejected counts (signature failures)
 *   • Provisioning + migration completion counts
 *   • BullMQ queue depths (provisioning, migrations, webhooks) when
 *     REDIS_URL is wired
 *   • Lender health summary (healthy / degraded / unwired)
 *
 * Polls `/api/admin/observability/snapshot` every 5s. The previous
 * implementation rendered a hard-coded constant — useful in a deck,
 * useless under a regulator drill-down. The snapshot route is
 * admin-gated; the page is rendered inside the existing `/admin/*`
 * auth fence, so the fetch carries the session cookie automatically.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const POLL_INTERVAL_MS = 5000;

interface QueueStats {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

interface Snapshot {
  generatedAt: string;
  metrics: Record<string, number>;
  queues: {
    provisioning: QueueStats | null;
    migrations: QueueStats | null;
    webhooks: QueueStats | null;
  } | null;
  lenderHealth: {
    healthy: number;
    degraded: number;
    down: number;
    unwired: number;
    total: number;
  };
}

export default function ObservabilityPage(): JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSnapshot(): Promise<void> {
      try {
        const res = await fetch('/api/admin/observability/snapshot', {
          // Snapshot must reflect the latest counter writes — no cache.
          cache: 'no-store',
          // Admin gate uses cookie auth; no extra credentials param
          // needed because same-origin.
          credentials: 'same-origin',
        });
        if (!res.ok) {
          if (!cancelled) setError(`Snapshot request failed: ${res.status}`);
          return;
        }
        const json = (await res.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(json);
          setError(null);
          setLastSuccessAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      }
    }

    void fetchSnapshot();
    const interval = setInterval(() => void fetchSnapshot(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const m = snapshot?.metrics ?? {};
  const lender = snapshot?.lenderHealth;
  const queues = snapshot?.queues;

  const stale = lastSuccessAt != null && Date.now() - lastSuccessAt > POLL_INTERVAL_MS * 3;

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
          Live counters + queue depth, polled every {POLL_INTERVAL_MS / 1000}s. Per-lender drill-in
          via the marketplace registry.
        </p>
        {error ? (
          <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>
            ! {error} (showing last good snapshot)
          </div>
        ) : null}
        {stale ? (
          <div style={{ marginTop: 8, color: '#fcd34d', fontSize: 12 }}>
            ! Snapshot is stale — last update{' '}
            {lastSuccessAt ? new Date(lastSuccessAt).toLocaleTimeString() : '—'}
          </div>
        ) : null}
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
          label="Applications created"
          value={(m['applications.created'] ?? 0).toLocaleString()}
          sub={`since process start (resets on deploy)`}
        />
        <KpiTile
          label="Decisions computed"
          value={(m['decisions.computed'] ?? 0).toLocaleString()}
          sub={`engine evaluations (internal / trutopia / fallback)`}
        />
        <KpiTile
          label="Webhook events queued"
          value={(m['webhook.queued'] ?? 0).toLocaleString()}
          sub={`dup ${m['webhook.duplicate'] ?? 0} · rejected ${m['webhook.rejected'] ?? 0}`}
          tone={(m['webhook.rejected'] ?? 0) > 0 ? 'warn' : 'ok'}
        />
        <KpiTile
          label="Lenders healthy"
          value={lender ? `${lender.healthy} / ${lender.total}` : '—'}
          sub={lender ? `${lender.degraded} degraded · ${lender.unwired} unwired` : 'loading …'}
          tone={lender && lender.degraded + lender.down > 0 ? 'warn' : 'ok'}
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
          <h2 style={{ margin: '0 0 14px', fontSize: 16 }}>Orchestrator throughput</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <CounterRow
              label="Provisioning runs completed"
              value={m['provisioning.completed'] ?? 0}
            />
            <CounterRow
              label="Provisioning runs failed"
              value={m['provisioning.failed'] ?? 0}
              tone={(m['provisioning.failed'] ?? 0) > 0 ? 'warn' : 'ok'}
            />
            <CounterRow
              label="Customer migrations completed"
              value={m['migration.completed'] ?? 0}
            />
            <CounterRow
              label="Customer migrations failed"
              value={m['migration.failed'] ?? 0}
              tone={(m['migration.failed'] ?? 0) > 0 ? 'warn' : 'ok'}
            />
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
          {!queues ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Queue substrate offline — REDIS_URL not configured. Workers using setImmediate
              fallback.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <QueueTile
                name="Provisioning"
                stats={queues.provisioning}
                link="/admin/provisioning"
              />
              <QueueTile
                name="Customer migrations"
                stats={queues.migrations}
                link="/admin/migrations/ai-funding"
              />
              <QueueTile name="Webhook inbox" stats={queues.webhooks} link={null} />
            </div>
          )}
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

function CounterRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn';
}): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'baseline',
        padding: '6px 0',
        borderBottom: '1px dashed #1f2937',
      }}
    >
      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
      <strong style={{ fontSize: 15, color: tone === 'warn' ? '#fcd34d' : '#e2e8f0' }}>
        {value.toLocaleString()}
      </strong>
    </div>
  );
}

function QueueTile({
  name,
  stats,
  link,
}: {
  name: string;
  stats: QueueStats | null;
  link: string | null;
}): JSX.Element {
  const body = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr repeat(4, auto)',
        gap: 12,
        alignItems: 'baseline',
      }}
    >
      <strong style={{ fontSize: 13 }}>{name}</strong>
      {stats === null ? (
        <span style={{ fontSize: 12, color: '#fca5a5' }}>stats unavailable</span>
      ) : (
        <>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>waiting {stats.waiting}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>active {stats.active}</span>
          <span
            style={{
              fontSize: 12,
              color: stats.failed > 0 ? '#fca5a5' : '#94a3b8',
            }}
          >
            failed {stats.failed}
          </span>
          <span style={{ fontSize: 12, color: '#64748b' }}>delayed {stats.delayed}</span>
        </>
      )}
    </div>
  );
  if (!link) {
    return (
      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#020617' }}>{body}</div>
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
      {body}
    </Link>
  );
}
