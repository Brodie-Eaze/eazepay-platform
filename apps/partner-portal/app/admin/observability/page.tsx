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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  PageBody,
  Card,
  CardHeader,
  CardBody,
  KpiCard,
  Banner,
  StatusPill,
  GaugeIcon,
  QueueIcon,
  ChartIcon,
  WebhookIcon,
  HeartPulseIcon,
  ArrowRightIcon,
  LiveIndicator,
  TimeRangeSelector,
  TIME_RANGES,
  type StatusTone,
  type TimeRange,
} from '@eazepay/ui/web';

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

  /* Sprint H: URL-driven time range. Drives the KPI drill-in URLs so the
   * destination list page opens scoped to the same window the operator
   * was inspecting here. */
  const sp = useSearchParams();
  const router = useRouter();
  const rangeFromUrl = (sp?.get('range') as TimeRange | null) ?? null;
  const range: TimeRange =
    rangeFromUrl && (TIME_RANGES as readonly string[]).includes(rangeFromUrl) ? rangeFromUrl : '7d';
  const handleRangeChange = useCallback(
    (next: TimeRange) => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      params.set('range', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, sp],
  );
  const rangeQs = useMemo(() => `&range=${range}`, [range]);
  const pulseKey = lastSuccessAt ?? 0;

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

  const webhookRejected = m['webhook.rejected'] ?? 0;
  const lenderDegraded = (lender?.degraded ?? 0) + (lender?.down ?? 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Observability' }]}
        title="Operational health"
        description={`Live counters + queue depth, polled every ${POLL_INTERVAL_MS / 1000}s. Per-lender drill-in via the marketplace registry.`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <LiveIndicator pulseKey={pulseKey} />
            <TimeRangeSelector value={range} onChange={handleRangeChange} />
            <Link
              href="/admin/observability/slo"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              SLO board <ArrowRightIcon size={12} />
            </Link>
          </div>
        }
      />
      <PageBody>
        {error ? (
          <div className="mb-4">
            <Banner intent="danger" title="Snapshot fetch failed">
              {error} (showing last good snapshot)
            </Banner>
          </div>
        ) : null}
        {stale ? (
          <div className="mb-4">
            <Banner intent="warning" title="Snapshot is stale">
              Last update {lastSuccessAt ? new Date(lastSuccessAt).toLocaleTimeString() : '—'}
            </Banner>
          </div>
        ) : null}

        {/* Sprint H: every KPI drills into the canonical surface for that
            slice. Wrap the KpiCard primitive in a Link so the entire tile
            is the affordance — no separate "view" button to discover. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <KpiTileLink
            href={`/applications?range=24h${rangeQs}`}
            ariaLabel="Open applications submitted in the last 24 hours"
          >
            <KpiCard
              icon={<ChartIcon size={14} />}
              label="Applications 24h"
              value={(m['applications.created'] ?? 0).toLocaleString()}
              hint="since process start (resets on deploy)"
            />
          </KpiTileLink>
          <KpiTileLink href="/admin/observability/slo" ariaLabel="Open decision-latency SLO board">
            <KpiCard
              icon={<GaugeIcon size={14} />}
              label="Decisions computed"
              value={(m['decisions.computed'] ?? 0).toLocaleString()}
              hint="engine evaluations (internal / trutopia / fallback)"
            />
          </KpiTileLink>
          <KpiTileLink
            href="/admin/audit?action=webhook"
            ariaLabel="Open audit log filtered to webhook events"
          >
            <KpiCard
              icon={<WebhookIcon size={14} />}
              label="Webhook events queued"
              value={(m['webhook.queued'] ?? 0).toLocaleString()}
              hint={`dup ${m['webhook.duplicate'] ?? 0} · rejected ${webhookRejected}`}
            />
          </KpiTileLink>
          <KpiTileLink href="/lender-marketplace" ariaLabel="Open lender marketplace">
            <KpiCard
              icon={<HeartPulseIcon size={14} />}
              label="Lenders healthy"
              value={lender ? `${lender.healthy} / ${lender.total}` : '—'}
              hint={lender ? `${lender.degraded} degraded · ${lender.unwired} unwired` : 'loading…'}
            />
          </KpiTileLink>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Orchestrator throughput" />
            <CardBody>
              <div className="grid gap-2.5">
                <CounterRow
                  label="Provisioning runs completed"
                  value={m['provisioning.completed'] ?? 0}
                />
                <CounterRow
                  label="Provisioning runs failed"
                  value={m['provisioning.failed'] ?? 0}
                  tone={(m['provisioning.failed'] ?? 0) > 0 ? 'warning' : undefined}
                />
                <CounterRow
                  label="Customer migrations completed"
                  value={m['migration.completed'] ?? 0}
                />
                <CounterRow
                  label="Customer migrations failed"
                  value={m['migration.failed'] ?? 0}
                  tone={(m['migration.failed'] ?? 0) > 0 ? 'warning' : undefined}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Queue depth"
              description={
                queues
                  ? 'BullMQ queue state across orchestrator workers.'
                  : 'Queue substrate offline — REDIS_URL not configured.'
              }
            />
            <CardBody>
              {!queues ? (
                <p className="text-[13px] text-fg-muted">
                  Workers using setImmediate fallback. Connect Redis to surface queue depth.
                </p>
              ) : (
                <div className="grid gap-2">
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
            </CardBody>
          </Card>
        </div>

        {/* Surface lender health as its own card so operators see the
            tally without leaving the page. */}
        {lender && (
          <div className="mt-4">
            <Card>
              <CardHeader
                title="Lender health summary"
                description="Categorised by integration status. Drill into the marketplace for per-lender detail."
                action={
                  <Link
                    href="/lender-marketplace"
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-bg-elevated text-[12px] font-medium text-fg-secondary hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    Open marketplace <ArrowRightIcon size={12} />
                  </Link>
                }
              />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="success" dot>
                    {lender.healthy} healthy
                  </StatusPill>
                  <StatusPill tone={lender.degraded > 0 ? 'warning' : 'neutral'} dot>
                    {lender.degraded} degraded
                  </StatusPill>
                  <StatusPill tone={lender.down > 0 ? 'danger' : 'neutral'} dot>
                    {lender.down} down
                  </StatusPill>
                  <StatusPill tone="neutral" dot>
                    {lender.unwired} unwired
                  </StatusPill>
                  <StatusPill tone={lenderDegraded > 0 ? 'warning' : 'success'}>
                    {lender.total} total
                  </StatusPill>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}

/**
 * KpiTileLink — wraps a KpiCard primitive in a router Link so the entire
 * tile becomes the drill-in affordance. Reuses the shared focus/hover
 * pattern from KpiTile in /v/[brand]/page.tsx.
 */
function KpiTileLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block rounded-lg transition-colors hover:[&>div]:border-border-strong hover:[&>div]:bg-bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      {children}
    </Link>
  );
}

function CounterRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: StatusTone;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline py-1.5 border-b border-dashed border-border last:border-0">
      <span className="text-[13px] text-fg-secondary">{label}</span>
      {tone ? (
        <StatusPill tone={tone}>{value.toLocaleString()}</StatusPill>
      ) : (
        <strong className="text-[15px] text-fg tabular-nums">{value.toLocaleString()}</strong>
      )}
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
    <div className="grid grid-cols-[1.4fr_repeat(4,auto)] gap-3 items-baseline">
      <strong className="text-[13px] text-fg flex items-center gap-2">
        <QueueIcon size={13} className="text-fg-muted" />
        {name}
      </strong>
      {stats === null ? (
        <span className="text-[12px] text-danger col-span-4">stats unavailable</span>
      ) : (
        <>
          <span className="text-[12px] text-fg-secondary tabular-nums">
            waiting {stats.waiting}
          </span>
          <span className="text-[12px] text-fg-secondary tabular-nums">active {stats.active}</span>
          <span
            className={`text-[12px] tabular-nums ${stats.failed > 0 ? 'text-danger' : 'text-fg-secondary'}`}
          >
            failed {stats.failed}
          </span>
          <span className="text-[12px] text-fg-muted tabular-nums">delayed {stats.delayed}</span>
        </>
      )}
    </div>
  );
  if (!link) {
    return <div className="px-3 py-2.5 rounded-md bg-bg-muted/40 border border-border">{body}</div>;
  }
  return (
    <Link
      href={link}
      className="block px-3 py-2.5 rounded-md bg-bg-muted/40 border border-border hover:bg-bg-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      {body}
    </Link>
  );
}
