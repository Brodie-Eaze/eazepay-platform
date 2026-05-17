'use client';
import { useMemo, useState } from 'react';
import { PageBody, PageHeader, Card, CardBody } from '@eazepay/ui/web';
import { useEventStream, type EventEnvelope } from '../../lib/event-stream';
import { ActivityRow } from '../../components/LiveActivityStrip';

/**
 * Full Live Activity feed — master-only.
 *
 * Streams every event in the system into a scrollable feed with
 * filter chips. Power-user view of the same SSE stream that powers
 * the top-of-page strip.
 */

const FILTERS: Array<{ id: string; label: string; match: (k: string) => boolean }> = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'applications', label: 'Applications', match: (k) => k.startsWith('application_') },
  {
    id: 'offers',
    label: 'Offers + funding',
    match: (k) => k.startsWith('offer_') || k === 'contract_signed' || k === 'funding_released',
  },
  { id: 'billing', label: 'Billing', match: (k) => k.startsWith('invoice_') },
  { id: 'auth', label: 'Auth', match: (k) => k.startsWith('auth_') },
  { id: 'config', label: 'Config', match: (k) => k === 'config_changed' },
];

export default function ActivityPage() {
  const [filter, setFilter] = useState<string>('all');
  const { events, connected, reconnects } = useEventStream({ kind: 'master' }, { bufferSize: 500 });

  const matcher = useMemo(
    () => FILTERS.find((f) => f.id === filter)?.match ?? (() => true),
    [filter],
  );

  const filtered = useMemo(
    () =>
      events
        .filter((e) => matcher(e.kind))
        .slice()
        .reverse(),
    [events, matcher],
  );

  // Per-kind counts for the chips (small badge of how many would show).
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = events.filter((e) => f.match(e.kind)).length;
    return c;
  }, [events]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Master' }]}
        title="Live Activity"
        description="Real-time feed of every event across every partner portal. SSE-backed; reconnects automatically; replays missed events on reconnect."
      />
      <PageBody>
        <Card className="mb-4">
          <CardBody className="flex items-center justify-between px-5 py-3 text-[13px]">
            <span className="inline-flex items-center gap-2">
              <span
                className={
                  'size-2 rounded-full ' +
                  (connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')
                }
                aria-hidden
              />
              <strong>{connected ? 'Connected' : 'Disconnected'}</strong>
              {!connected && reconnects > 0 && (
                <span className="text-fg-muted text-[11px]">· reconnect attempt #{reconnects}</span>
              )}
            </span>
            <span className="text-fg-muted text-[12px] tabular-nums">
              {filtered.length} of {events.length} in buffer
            </span>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-1 mb-4">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={
                  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold transition-colors ' +
                  (active
                    ? 'bg-fg text-bg-elevated'
                    : 'bg-bg-elevated border border-border text-fg-secondary hover:bg-bg-muted/60')
                }
              >
                {f.label}
                <span className="tabular-nums opacity-70">({counts[f.id] ?? 0})</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardBody className="p-0">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-fg-muted text-[13px]">
                {connected
                  ? 'No events match this filter yet. New events will appear here in real time.'
                  : 'Waiting for connection…'}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((e: EventEnvelope) => (
                  <ActivityRow key={e.uuid} event={e} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <p className="mt-4 text-[11px] text-fg-muted">
          Events are persisted to <code className="font-mono">event_log</code> for 90 days hot,
          archived to S3 after. PII never appears in the open payload — fields like dispute reasons
          are envelope-encrypted with AAD bound to the event uuid. See ADR-0019.
        </p>
      </PageBody>
    </>
  );
}
