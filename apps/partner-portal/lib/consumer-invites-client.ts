/**
 * Browser-side adapter for the consumer-invite BFF endpoints.
 *
 * Intentionally small + dependency-free so the consumer apply page
 * (Wave 2C — currently read-only for the live-tracker feature) can
 * import it without dragging the server-only store into the client
 * bundle. The store itself reads `node:fs`; this file does not.
 *
 * Usage from the consumer apply page once Wave 2C is ready:
 *
 *   import { notifyConsumerInvite } from '@/lib/consumer-invites-client';
 *
 *   // When the apply page mounts under `?invite=<token>`:
 *   await notifyConsumerInvite({ brand: 'medpay', token, event: 'started' });
 *
 *   // After the client mints / receives an applicationId:
 *   await notifyConsumerInvite({
 *     brand: 'medpay',
 *     token,
 *     event: 'step_completed',
 *     applicationId,
 *   });
 *
 *   // When the consumer accepts an offer (terminal):
 *   await notifyConsumerInvite({
 *     brand: 'medpay',
 *     token,
 *     event: 'redeemed',
 *     applicationId,
 *   });
 *
 * The PATCH endpoint is idempotent — retrying after a transient
 * network failure is safe. We swallow errors here so a tracking miss
 * never blocks the consumer's primary flow.
 */

export type NotifyEvent = 'started' | 'step_completed' | 'redeemed';

export interface NotifyInput {
  brand: 'medpay' | 'tradepay' | 'coachpay';
  token: string;
  event: NotifyEvent;
  applicationId?: string;
}

/**
 * Best-effort notify. Returns `true` on a 2xx response, `false`
 * otherwise. Errors are swallowed so the call site can use this in a
 * `void` context inside `useEffect`.
 */
export async function notifyConsumerInvite(input: NotifyInput): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/v/${input.brand}/consumer-invites/${encodeURIComponent(input.token)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event: input.event,
          applicationId: input.applicationId,
        }),
      },
    );
    if (!res.ok) {
      // SILENT-FAIL FIX: a non-2xx PATCH means the tracking event was
      // dropped server-side. Emit a structured log so the consumer apply
      // funnel's drop-off rate is debuggable (previously it was silent).
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'consumer_invite.notify_non_ok',
          brand: input.brand,
          notifyEvent: input.event,
          status: res.status,
        }),
      );
    }
    return res.ok;
  } catch (err) {
    // SILENT-FAIL FIX: network failure — log + still return false so
    // callers in useEffect / fire-and-forget contexts keep working.
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'consumer_invite.notify_failed',
        brand: input.brand,
        notifyEvent: input.event,
        msg: err instanceof Error ? err.message : 'unknown',
      }),
    );
    return false;
  }
}
