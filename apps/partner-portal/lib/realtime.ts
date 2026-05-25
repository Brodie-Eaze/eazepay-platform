/**
 * Realtime publisher · partner portal application lifecycle channel.
 *
 * Wraps the `pusher` Node SDK so route handlers can publish status
 * change notifications to the practice owner's open browser tab. The
 * client subscribes via `pusher-js` to the same channel and triggers
 * an immediate refetch of the status endpoint instead of waiting for
 * the 5s poll.
 *
 * Graceful degradation:
 *   - If any of the 4 PUSHER_* env vars is missing, the publisher
 *     becomes a no-op. The poll-based UI keeps working. Production
 *     gets the keys; local dev doesn't need them.
 *   - All publish calls are fire-and-forget — they never throw, and
 *     a network failure to Pusher logs but doesn't propagate to the
 *     webhook handler (we don't want a Pusher outage to cause lender
 *     webhook 500s).
 *
 * Required env vars:
 *   PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
 *
 * Client-side env vars (also required if you want subscription to work):
 *   NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER
 *
 * Channel naming:
 *   app-<applicationId>   per-application bus. Anyone with the app id
 *                         can subscribe. Acceptable for now because
 *                         the status endpoint itself is session-gated.
 *
 * Event names:
 *   status-changed        application status moved (submitted →
 *                         in_review → approved/declined → funded)
 *   offer-received        a lender returned a new offer or updated
 *                         an existing one
 *   offer-accepted        consumer (or admin) bound an offer
 */

type PusherClient = {
  trigger: (channel: string, event: string, data: unknown) => Promise<unknown>;
};

let cached: PusherClient | null | undefined;
let envWarned = false;

async function loadClient(): Promise<PusherClient | null> {
  if (cached !== undefined) return cached;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) {
    /* Log once at startup so ops sees the no-op state, but don't spam
     * on every webhook. */
    if (!envWarned) {
      envWarned = true;

      console.info(
        '[realtime] Pusher env vars unset (PUSHER_APP_ID / PUSHER_KEY / PUSHER_SECRET / PUSHER_CLUSTER) — realtime publishes are a no-op. Set them to enable live push.',
      );
    }
    cached = null;
    return null;
  }
  /* Dynamic import so the package can be optional. If `pusher` isn't
   * installed (e.g. devDep stripped in a slim image), we degrade to
   * no-op instead of crashing the route handler. */
  try {
    const mod = await import('pusher');
    const Pusher = mod.default as unknown as new (config: Record<string, unknown>) => PusherClient;
    cached = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
    return cached;
  } catch (err) {
    console.warn(
      '[realtime] `pusher` package not available — realtime publishes are a no-op. Install pusher in apps/partner-portal to enable.',
      err,
    );
    cached = null;
    return null;
  }
}

export type ApplicationLifecycleEvent =
  | 'status-changed'
  | 'offer-received'
  | 'offer-accepted'
  | 'funded';

/**
 * Publish a lifecycle event to the per-application channel. Safe to
 * call from any route handler — failures are swallowed + logged so
 * Pusher being down never poisons the lender webhook contract.
 *
 * Returns true if the publish was attempted (i.e. Pusher is wired),
 * false if the publisher is a no-op for this deployment.
 */
export async function publishApplicationEvent(
  applicationId: string,
  event: ApplicationLifecycleEvent,
  payload: Record<string, unknown> = {},
): Promise<boolean> {
  const client = await loadClient();
  if (!client) return false;
  const channel = `app-${applicationId}`;
  try {
    await client.trigger(channel, event, {
      applicationId,
      event,
      ts: new Date().toISOString(),
      ...payload,
    });
    return true;
  } catch (err) {
    console.warn(`[realtime] publish failed (${channel} / ${event}):`, err);
    return false;
  }
}
