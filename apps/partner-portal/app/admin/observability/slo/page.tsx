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
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  Banner,
  StatusPill,
  Skeleton,
  type StatusTone,
} from '@eazepay/ui/web';

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

const ALERT_TONE: Record<AlertLevel, StatusTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
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
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Observability', href: '/admin/observability' },
          { label: 'SLO' },
        ]}
        title="Service Level Objectives"
        description={`Targets the platform commits to. Each card shows target, observed failure rate, remaining error budget, and runbook link. Polled every ${POLL_INTERVAL_MS / 1000}s.`}
      />
      <PageBody>
        {board?.observabilityNote ? (
          <div className="mb-4">
            <Banner intent="info" title="Note">
              {board.observabilityNote}
            </Banner>
          </div>
        ) : null}
        {error ? (
          <div className="mb-4">
            <Banner intent="danger" title="SLO fetch failed">
              {error} (showing last good snapshot)
            </Banner>
          </div>
        ) : null}
        {stale ? (
          <div className="mb-4">
            <Banner intent="warning" title="Board is stale">
              Last update {lastSuccessAt ? new Date(lastSuccessAt).toLocaleTimeString() : '—'}
            </Banner>
          </div>
        ) : null}

        {!board ? (
          <Card>
            <CardBody>
              <Skeleton rows={4} label="Loading SLO board" />
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {board.rows.map((row) => (
              <SloCard key={row.slo.id} row={row} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

function SloCard({ row }: { row: BoardRow }): JSX.Element {
  const targetPct = (row.slo.target * 100).toFixed(row.slo.target >= 0.999 ? 3 : 2);
  const isObservable = row.observation.failureRate !== null && row.budget !== null;
  const alertLevel: AlertLevel = row.budget?.alertLevel ?? 'green';
  const tone: StatusTone = isObservable ? ALERT_TONE[alertLevel] : 'neutral';

  return (
    <Card>
      <CardHeader
        title={row.slo.name}
        description={`${row.slo.service} · ${row.slo.sli.category}`}
        action={
          <StatusPill tone={tone} dot>
            {isObservable ? ALERT_LABEL[alertLevel] : 'NO DATA'}
          </StatusPill>
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 gap-3">
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
            tone={isObservable ? tone : undefined}
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
            tone={isObservable ? tone : undefined}
          />
        </div>

        {row.observation.notObservableReason ? (
          <div className="mt-3 px-3 py-2 rounded-md border border-dashed border-border bg-bg-muted/30 text-[12px] text-fg-muted">
            {row.observation.notObservableReason}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2 text-[12px] pt-3 border-t border-border">
          <span className="text-fg-muted">Runbook:</span>
          {/* External-relative path — the runbook docs live in the repo,
              not under the app. We surface the path so an operator opens
              it in their editor; the link target is the GitHub blob URL
              when REPO_URL is wired (future). */}
          <Link
            href={`/${row.slo.runbookLink}`}
            className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm"
          >
            {row.slo.runbookLink.replace('docs/runbooks/', '')}
          </Link>
        </div>
      </CardBody>
    </Card>
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
  tone?: StatusTone;
}): JSX.Element {
  // Tone-coloured value uses the same token classes the StatusPill uses
  // (text-success / text-warning / text-danger) so the SLO numbers
  // pop without inventing palette.
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-fg';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-fg-muted font-semibold">
        {label}
      </div>
      <div className={`mt-1 text-[18px] font-bold tabular-nums leading-tight ${valueColor}`}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-fg-muted mt-0.5">{sub}</div> : null}
    </div>
  );
}
