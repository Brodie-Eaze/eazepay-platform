/**
 * useApplicationRealtime — subscribes to the per-application Pusher
 * channel and fires `onEvent` whenever a lifecycle event lands. Drops
 * silently to a no-op if NEXT_PUBLIC_PUSHER_KEY / _CLUSTER aren't set
 * so local dev (poll-only) keeps working.
 *
 * Pair with the existing 5s poll: the poll stays as a backstop (in
 * case Pusher disconnects), the realtime event triggers an immediate
 * refetch when it lands. Together you get sub-second updates with
 * 5s worst-case latency on Pusher outage.
 */
'use client';

import { useEffect } from 'react';

export type RealtimeEventName = 'status-changed' | 'offer-received' | 'offer-accepted' | 'funded';

const SUBSCRIBED_EVENTS: readonly RealtimeEventName[] = [
  'status-changed',
  'offer-received',
  'offer-accepted',
  'funded',
];

let cachedPusherClient: unknown = undefined;

async function getPusherClient(): Promise<unknown> {
  if (cachedPusherClient !== undefined) return cachedPusherClient;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    cachedPusherClient = null;
    return null;
  }
  try {
    /* Dynamic import so SSR + the no-Pusher-keys path don't pull the
     * client lib into the bundle unless we actually need it. */
    const mod = await import('pusher-js');
    const Pusher = mod.default as unknown as new (
      key: string,
      opts: Record<string, unknown>,
    ) => unknown;
    cachedPusherClient = new Pusher(key, { cluster });
    return cachedPusherClient;
  } catch (err) {
    console.warn('[useApplicationRealtime] pusher-js failed to load:', err);
    cachedPusherClient = null;
    return null;
  }
}

interface PusherChannel {
  bind: (event: string, cb: (data: unknown) => void) => void;
  unbind_all: () => void;
}

interface PusherClient {
  subscribe: (channel: string) => PusherChannel;
  unsubscribe: (channel: string) => void;
}

export function useApplicationRealtime(
  applicationId: string | null,
  onEvent: (event: RealtimeEventName, payload: Record<string, unknown>) => void,
) {
  useEffect(() => {
    if (!applicationId) return;
    let channel: PusherChannel | null = null;
    let pusher: PusherClient | null = null;
    let cancelled = false;

    void (async () => {
      const client = (await getPusherClient()) as PusherClient | null;
      if (!client || cancelled) return;
      pusher = client;
      const channelName = `app-${applicationId}`;
      channel = client.subscribe(channelName);
      for (const ev of SUBSCRIBED_EVENTS) {
        channel.bind(ev, (data: unknown) => {
          onEvent(ev, (data ?? {}) as Record<string, unknown>);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (channel) channel.unbind_all();
      if (pusher) pusher.unsubscribe(`app-${applicationId}`);
    };
    /* onEvent intentionally omitted from deps — callers should pass a
     * stable callback (useCallback / ref) so the subscription doesn't
     * tear down on every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);
}
