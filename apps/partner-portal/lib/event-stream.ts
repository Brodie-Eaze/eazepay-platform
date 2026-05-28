/**
 * EventSource client for the events bus.
 *
 * - Two stream URLs: master `/v1/events/stream` (admin) and per-app
 *   `/v1/applications/<id>/stream` (partner-scoped). Both speak the
 *   same SSE wire format from services/events/internal/sse-writer.ts.
 * - The browser's built-in EventSource handles reconnect + replays
 *   Last-Event-ID automatically. We just expose an idiomatic React
 *   hook on top.
 * - Caches the last-seen id in sessionStorage so a navigation that
 *   tears down the EventSource still resumes from the right place on
 *   the next mount (rather than re-replaying the entire catchup
 *   window).
 * - SSE EventSource cannot send custom headers (no Authorization),
 *   so auth flows through the same cookie the BFF already issues
 *   (`eazepay_at` / `eazepay_demo`). withCredentials: true on the
 *   constructor lets the cookie ride along on the stream connection
 *   for same-origin or properly-CORS'd targets.
 */
import { useEffect, useRef, useState } from 'react';

const API_BASE = (() => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return (
    (window as unknown as { __EAZE_API__?: string }).__EAZE_API__ ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:3000'
  );
})();

export interface EventEnvelope {
  uuid: string;
  id: string;
  kind: string;
  merchantId: string | null;
  targetType: string;
  targetId: string;
  actorId: string | null;
  actorLabel: string;
  payload: Record<string, unknown>;
  at: string;
}

type StreamUrl = { kind: 'master' } | { kind: 'application'; applicationId: string };

function urlFor(stream: StreamUrl): string {
  if (stream.kind === 'master') return `${API_BASE}/v1/events/stream`;
  return `${API_BASE}/v1/applications/${encodeURIComponent(stream.applicationId)}/stream`;
}

function cacheKeyFor(stream: StreamUrl): string {
  return stream.kind === 'master'
    ? 'eaze.sse.lastId.master'
    : `eaze.sse.lastId.app.${stream.applicationId}`;
}

export interface UseEventStreamState {
  events: EventEnvelope[];
  connected: boolean;
  /** Number of attempted reconnects this session (for surfacing in the UI). */
  reconnects: number;
}

export interface UseEventStreamOpts {
  /** Cap the in-memory event buffer (oldest dropped). Default 200. */
  bufferSize?: number;
  /** Fired once on the FIRST event matching the predicate (e.g. sound on
   *  first offer). Cleared after one call. */
  onFirstMatch?: (e: EventEnvelope) => void;
  firstMatchPredicate?: (e: EventEnvelope) => boolean;
  /** Disabled until ready (e.g. application id not yet known). */
  enabled?: boolean;
}

export function useEventStream(
  stream: StreamUrl,
  opts: UseEventStreamOpts = {},
): UseEventStreamState {
  const enabled = opts.enabled !== false;
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnects, setReconnects] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);
  const firedFirstMatch = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    // EventSource respects an `EventSource.lastEventId` cookie set by
    // the server. We additionally seed from sessionStorage so an
    // intra-app navigation doesn't lose place.
    const cacheKey = cacheKeyFor(stream);
    const cached = sessionStorage.getItem(cacheKey);
    const url = urlFor(stream);
    // EventSource has no header API. We pass a hint as a query param
    // — the controller checks both `Last-Event-ID` header (set by
    // EventSource on auto-reconnect) AND `?since=` (set by us on
    // first connect after navigation). Either resumes correctly.
    const finalUrl = cached ? `${url}?since=${encodeURIComponent(cached)}` : url;
    const es = new EventSource(finalUrl, { withCredentials: true });
    sourceRef.current = es;

    const onMessage = (msg: MessageEvent) => {
      try {
        const env = JSON.parse(msg.data) as EventEnvelope;
        setEvents((prev) => {
          const next = [...prev, env];
          const cap = opts.bufferSize ?? 200;
          return next.length > cap ? next.slice(next.length - cap) : next;
        });
        if (env.id) sessionStorage.setItem(cacheKey, env.id);
        if (!firedFirstMatch.current && opts.firstMatchPredicate && opts.firstMatchPredicate(env)) {
          firedFirstMatch.current = true;
          opts.onFirstMatch?.(env);
        }
      } catch {
        /* malformed frame — skip */
      }
    };

    es.onopen = () => setConnected(true);
    // Cap reconnects so an unreachable / misconfigured SSE endpoint
    // does not generate a setState storm. Without this cap, EventSource
    // re-fires `error` rapidly (much faster than the documented 3s
    // `retry:` when the response itself is a hard rejection — 401/403/
    // 404/CORS), and every error calls setReconnects which re-renders
    // every ancestor (incl. AppShell). Combined with a heavy mount
    // (e.g. the 1.8k-line partner-detail page), this stalls React
    // reconciliation long enough to freeze the renderer entirely —
    // observed in prod as "click partner row → blank page".
    //
    // After MAX_RECONNECTS we close the source and stop retrying.
    // The strip's `Reconnecting…` pill stays visible so ops still
    // sees the degraded state, but the runtime stops paying for it.
    const MAX_RECONNECTS = 5;
    let reconnectCount = 0;
    es.onerror = () => {
      reconnectCount += 1;
      setConnected(false);
      setReconnects(reconnectCount);
      if (reconnectCount >= MAX_RECONNECTS) {
        // eslint-disable-next-line no-console
        console.warn(
          `[event-stream] giving up after ${reconnectCount} reconnect attempts to ${finalUrl}. Verify NEXT_PUBLIC_API_URL points at a reachable SSE endpoint.`,
        );
        es.close();
        sourceRef.current = null;
      }
      // Otherwise EventSource auto-reconnects after the `retry:`
      // interval (3s default; see sse-writer.ts).
    };
    es.onmessage = onMessage;
    // Every event has `event: <kind>` per the spec — the browser fires
    // a named event on the source. We bind a catch-all by listening
    // to `message` AND all known kinds.
    const KNOWN_KINDS = [
      'application_opened',
      'application_submitted',
      'application_viewed',
      'application_abandoned',
      'offer_received',
      'offer_selected',
      'contract_signed',
      'funding_released',
      'invoice_generated',
      'invoice_sent',
      'invoice_confirmed',
      'invoice_disputed',
      'invoice_paid',
      'config_changed',
      'auth_signin_failed',
    ];
    for (const k of KNOWN_KINDS) {
      es.addEventListener(k, onMessage as EventListener);
    }

    return () => {
      es.close();
      sourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stream.kind, stream.kind === 'application' ? stream.applicationId : '']);

  return { events, connected, reconnects };
}
