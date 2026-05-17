'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useEventStream, type EventEnvelope } from '../lib/event-stream';

/**
 * Master Live Activity strip — top-of-page band that streams every
 * event in the fleet.
 *
 * Behaviour:
 *   - Collapses by default to a one-line "Live · <count> events" pill
 *     with a pulsing dot. Click expands to the most recent 5 events
 *     inline. Click "Open full feed" → /activity.
 *   - Hidden on naked routes (sign-in, landing, etc.) so it doesn't
 *     leak from authenticated to public surfaces.
 *   - Auto-reconnects via the browser's EventSource.
 *   - Only mounts when the caller is master (no activeBrand) — the
 *     per-brand portal renders the per-application ticker instead.
 *
 * Hardening (mirrors the SSE handler's contract):
 *   - withCredentials forwards the existing session cookie; the
 *     handler enforces AdminGuard. A non-admin connecting gets 403
 *     before the SSE upgrade, which surfaces here as connected:false.
 */
export function LiveActivityStrip() {
  const [open, setOpen] = useState(false);
  const { events, connected, reconnects } = useEventStream({ kind: 'master' }, { bufferSize: 100 });

  const recent = events.slice(-5).reverse();

  return (
    <div
      role="region"
      aria-label="Live platform activity"
      className="border-b border-border bg-bg-elevated"
    >
      <div className="flex items-center justify-between px-5 h-9 text-[12px]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-fg-secondary hover:text-fg transition"
        >
          <span
            className={
              'size-2 rounded-full ' + (connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')
            }
            aria-hidden
          />
          <span className="font-semibold">
            {connected ? 'Live' : reconnects > 0 ? 'Reconnecting…' : 'Connecting…'}
          </span>
          <span className="text-fg-muted">·</span>
          <span className="tabular-nums">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
          {recent.length > 0 && !open && (
            <span className="text-fg-muted ml-2 truncate max-w-md">
              latest: <strong className="text-fg-secondary">{recent[0]!.kind}</strong> ·{' '}
              {formatRelativeTime(recent[0]!.at)}
            </span>
          )}
          <span className="text-fg-muted ml-1">{open ? '▾' : '▸'}</span>
        </button>
        <Link
          href="/activity"
          className="text-fg-muted hover:text-fg text-[11px] underline-offset-2 hover:underline"
        >
          Open full feed →
        </Link>
      </div>
      {open && (
        <ul className="border-t border-border divide-y divide-border max-h-64 overflow-y-auto">
          {recent.length === 0 ? (
            <li className="px-5 py-3 text-[12px] text-fg-muted">
              No events yet this session. Anything that happens in any partner portal will appear
              here in real time.
            </li>
          ) : (
            recent.map((e) => <ActivityRow key={e.uuid} event={e} />)
          )}
        </ul>
      )}
    </div>
  );
}

export function ActivityRow({ event }: { event: EventEnvelope }) {
  return (
    <li className="grid grid-cols-12 gap-3 items-center px-5 py-2 text-[12px]">
      <span className="col-span-2 font-mono text-[10px] text-fg-muted">
        {formatRelativeTime(event.at)}
      </span>
      <span className="col-span-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-bg-muted text-fg-secondary font-semibold text-[10px] uppercase tracking-wider">
          {event.kind.replace(/_/g, ' ')}
        </span>
      </span>
      <span className="col-span-3 text-fg-secondary truncate">{event.actorLabel}</span>
      <span className="col-span-3 text-fg truncate">
        {event.targetType} ·{' '}
        <span className="font-mono text-[11px] text-fg-muted">{event.targetId.slice(0, 12)}…</span>
      </span>
      <span className="col-span-2 text-fg-muted truncate">
        {Object.entries(event.payload)
          .slice(0, 2)
          .map(([k, v]) => `${k}=${v}`)
          .join(' · ')}
      </span>
    </li>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
