/**
 * SEC-207 — Upstash-Redis rate-limit stub (NOT WIRED).
 *
 * Status: TODO. This module is a deliberate placeholder so the
 * follow-up PR has a single import target instead of having to refactor
 * every call site of `enforce` from `edge-rate-limit.ts`.
 *
 * The problem
 * -----------
 * The existing in-memory `enforce()` works correctly on a single Next
 * worker, but Railway autoscales replicas under load. With N replicas
 * each holding their own counter, the effective cap is N × LIMIT —
 * the limit fails open as soon as we scale past one container. This
 * was noted inline at `edge-rate-limit.ts:23` and is now tracked here.
 *
 * The intended fix (next iteration)
 * ---------------------------------
 *   1. Provision an Upstash REST Redis (free tier is enough for the
 *      partner-portal's QPS budget). Set `UPSTASH_REDIS_REST_URL` +
 *      `UPSTASH_REDIS_REST_TOKEN` in Railway's shared env.
 *   2. Swap the body of `enforceShared` below to call the Upstash
 *      atomic INCR + EXPIRE pattern (or the `@upstash/ratelimit` SDK).
 *   3. Flip every `enforceEdgeRateLimit(ip)` call site in app/api/* to
 *      `await enforceShared(ip)`. Single-line change per site once the
 *      module signature is final.
 *   4. Keep `enforce()` (in-memory) as the LOCAL-DEV fallback when the
 *      Upstash env vars are missing — exactly what we do for STRIPE/
 *      RESEND today.
 *
 * Why this stub exists today
 * --------------------------
 * Audit finding SEC-207 wants visibility on the multi-replica gap.
 * Shipping a no-op now (a) keeps the surface auditable, (b) gives the
 * follow-up PR a 1-import-change scope, and (c) refuses to boot in
 * production if a future caller imports it without wiring — so we
 * can't accidentally ship the stub into hot path.
 */

const NOT_WIRED = 'edge-rate-limit-upstash: NOT WIRED — see module header (SEC-207)';

/**
 * Placeholder for the Upstash-backed enforcer. Currently throws if
 * called — the in-memory `enforce` from `edge-rate-limit.ts` is the
 * sole code path. When the Upstash wiring lands, replace this body and
 * flip the call sites in one PR.
 */
export async function enforceShared(
  _ip: string,
  _limit?: number,
  _windowMs?: number,
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  // Fail loud rather than silently allow — the worst outcome would be
  // a future caller importing this and getting "always allowed" in
  // prod because the stub returned `{allowed:true}` by default.
  throw new Error(NOT_WIRED);
}

/**
 * Boolean probe call sites can use to decide between the in-memory
 * fallback and the (future) Upstash path. Today always false — flip
 * to env-var driven once the wiring lands.
 */
export function sharedRateLimitWired(): boolean {
  return false;
}
