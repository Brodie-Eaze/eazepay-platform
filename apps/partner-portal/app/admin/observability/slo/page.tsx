'use client';

/**
 * /admin/observability/slo — SLO board.
 *
 * One card per SLO with:
 *   • Target (target × 100 fmt'd as %)
 *   • Observed failure rate (or "no data yet" with reason)
 *   • Error budget remaining (in minutes; negative on over-burn)
 *   • Alert level pill (green / yellow / red)
 *   • Link to the runbook for the SLO
 *
 * Polls `/api/admin/slo` every 30s — slower than the observability tiles
 * because budget state changes on a window scale, not a real-time
 * scale. A polling fetch over WebSockets keeps the SLO board cache-
 * friendly when an operator leaves it open in a tab.
 *
 * The route is admin-gated; the page renders inside the existing
 * `/admin/*` fence so the fetch carries the session cookie.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const POLL_INTERVAL_MS = 30_000;

type AlertLevel = 'green' | 'yellow' | 'red';

interface BoardRow {
  slo: {
    id: string;
    name: string;
    service: string;
    sli: {
      category: 'availability' | 'latency' | 'correctness';
      description: string;
      source: string;
      latencyBudgetMs?: number;
    };
    target: number;
    window: '7d' | '30d';
    errorBudgetMinutes: number;
    runbookLink: string;
  };
  observation: {
    failureRate: number | null;
    window: 'since-boot' | '7d' | '30d';
    sampleSize: number;
    notObservableReason?: string;
  };
  budget: {
    remainingMinutes: number;
    percentBurned: number;
    alertLevel: AlertLevel;
  } | null;
}

interface BoardResponse {
  generatedAt: string;
  observabilityNote: string;
  rows: BoardRow[];
}

const ALERT_COLOR: Record<AlertLevel, string> = {
  green: '#86efac',
  yellow: '#fcd34d',
  red: '#fca5a5',
};

const ALERT_LABEL: Record<AlertLevel, string> = {
  green: 'GREEN',
  yellow: 'YELLOW',
  red: 'RED',
};

export default function SloBoardPage(): JSX.Element {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBoard(): Promise<void> {
      try {
        const res = await fetch('/api/admin/slo', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          if (!cancelled) setError(`SLO board request failed: ${res.status}`);
          return;
        }
        const json = (await res.json()) as BoardResponse;
        if (!cancelled) {
          setBoard(json);
          setError(null);
          setLastSuccessAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      }
    }

    void fetchBoard();
    const interval = setInterval(() => void fetchBoard(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const stale = lastSuccessAt != null && Date.now() - lastSuccessAt > POLL_INTERVAL_MS * 3;

  return (
    <div style={{ padding: 32, maxWidth: 1240, margin: '0 auto', color: '#e2e8f0' }}>
      <Link
        href="/admin/observability"
        style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}
      >
        ← Observability
      </Link>

      <header style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#7dd3fc', fontWeight: 700 }}>
          OBSERVABILITY / SLO
        </div>
        <h1 style={{ margin: '6px 0 8px', fontSize: 28, fontWeight: 700 }}>
          Service-level objectives
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 720 }}>
          Targets the platform commits to. Each card shows the SLO target, observed failure rate,
          remaining error budget, and the runbook to follow on breach. Polled every{' '}
          {POLL_INTERVAL_MS / 1000}s.
        </p>
        {board?.observabilityNote ? (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: '#1e293b',
              border: '1px solid #334155',
              fontSize: 12,
              color: '#cbd5e1',
            }}
          >
            <strong style={{ color: '#7dd3fc' }}>Note:</strong> {board.observabilityNote}
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>
            ! {error} (showing last good snapshot)
          </div>
        ) : null}
        {stale ? (
          <div style={{ marginTop: 8, color: '#fcd34d', fontSize: 12 }}>
            ! Board is stale — last update{' '}
            {lastSuccessAt ? new Date(lastSuccessAt).toLocaleTimeString() : '—'}
          </div>
        ) : null}
      </header>

      {!board ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading SLO board…</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 14,
          }}
        >
          {board.rows.map((row) => (
            <SloCard key={row.slo.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function SloCard({ row }: { row: BoardRow }): JSX.Element {
  const targetPct = (row.slo.target * 100).toFixed(row.slo.target >= 0.999 ? 3 : 2);
  const isObservable = row.observation.failureRate !== null && row.budget !== null;
  const tone: AlertLevel = row.budget?.alertLevel ?? 'green';
  const borderColor = isObservable ? ALERT_COLOR[tone] : '#334155';

  return (
    <div
      style={{
        padding: 22,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        background: '#0f172a',
        display: 'grid',
        gap: 14,
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: '0.12em',
              color: '#94a3b8',
              textTransform: 'uppercase',
            }}
          >
            {row.slo.service} · {row.slo.sli.category}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{row.slo.name}</div>
        </div>
        {isObservable ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 8px',
              borderRadius: 999,
              background: '#020617',
              color: ALERT_COLOR[tone],
              border: `1px solid ${ALERT_COLOR[tone]}`,
            }}
          >
            {ALERT_LABEL[tone]}
          </span>
        ) : (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 8px',
              borderRadius: 999,
              background: '#020617',
              color: '#94a3b8',
              border: '1px solid #334155',
            }}
          >
            NO DATA
          </span>
        )}
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Target" value={`${targetPct}%`} sub={`over ${row.slo.window}`} />
        <Field
          label="Observed failure"
          value={
            row.observation.failureRate === null
              ? '—'
              : `${(row.observation.failureRate * 100).toFixed(3)}%`
          }
          sub={
            row.observation.failureRate === null
              ? 'no data yet'
              : `n=${row.observation.sampleSize.toLocaleString()} (${row.observation.window})`
          }
        />
        <Field
          label="Budget remaining"
          value={
            row.budget === null
              ? '—'
              : `${row.budget.remainingMinutes >= 0 ? '' : '−'}${Math.abs(row.budget.remainingMinutes)} min`
          }
          sub={`of ${row.slo.errorBudgetMinutes} min total`}
          tone={tone}
        />
        <Field
          label="Burn"
          value={
            row.budget === null
              ? '—'
              : Number.isFinite(row.budget.percentBurned)
                ? `${(row.budget.percentBurned * 100).toFixed(1)}%`
                : '> 100%'
          }
          sub={row.budget === null ? '' : 'of error budget'}
          tone={tone}
        />
      </div>

      {row.observation.notObservableReason ? (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 6,
            background: '#020617',
            border: '1px dashed #334155',
            fontSize: 12,
            color: '#94a3b8',
          }}
        >
          {row.observation.notObservableReason}
        </div>
      ) : null}

      <footer style={{ display: 'flex', gap: 10, fontSize: 12 }}>
        <span style={{ color: '#64748b' }}>Runbook:</span>
        {/* External-relative path — the runbook docs live in the repo,
            not under the app. We surface the path so an operator opens
            it in their editor; the link target is the GitHub blob URL
            when REPO_URL is wired (future). */}
        <Link href={`/${row.slo.runbookLink}`} style={{ color: '#7dd3fc', textDecoration: 'none' }}>
          {row.slo.runbookLink.replace('docs/runbooks/', '')}
        </Link>
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: AlertLevel;
}): JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: '#64748b',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 4,
          color: tone ? ALERT_COLOR[tone] : '#e2e8f0',
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
