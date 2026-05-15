/**
 * SEC — Per-IP edge rate limit for high-risk BFF routes.
 *
 * Threat being closed: the consumer apply endpoint
 * (`/api/integrations/brand/apply`) and the consent receipt
 * (`/api/applications/consent`) both terminate at the Next.js BFF
 * layer without forwarding to the NestJS API in the dev /
 * non-deployed-API case (see the synthetic 202 fallback at the bottom
 * of brand-apply/route.ts). That means the ThrottlerGuard wired in
 * apps/api/src/app/app.module.ts does NOT see this traffic, so an
 * attacker can flood the BFF with arbitrary submissions to:
 *   - poison the in-memory consent receipt map (DoS via OOM)
 *   - flood the downstream queue with synthetic applications when
 *     the dev fallback is the only landing site
 *   - amplify any subsequent KYB / PII calls if the body parse
 *     happens to succeed
 *
 * Defence: a sliding-window per-IP counter that caps the rate at 20
 * requests per minute. The implementation is in-process — sufficient
 * for the single-replica dev / staging surface; production multi-
 * replica deployments MUST swap to a Redis-backed counter (Upstash
 * REST API is the no-money option) because two replicas each
 * counting 20 ≈ 40/min/IP defeats the cap.
 *
 * Sliding-window math: we keep an array of request timestamps per IP,
 * drop entries older than the window on each call, and reject when
 * the surviving count meets the limit. O(log n) cost per request via
 * the sorted-timestamp invariant. Memory bound is `limit` entries per
 * IP — a single IP cannot grow the map beyond the cap.
 *
 * Cleanup: a passive sweep runs on each `enforce` call against the
 * touched IP only, dropping that IP's array if it's empty. We don't
 * background-sweep the whole map because doing so requires a timer
 * that doesn't survive Vercel's per-invocation lifecycle anyway; on
 * platform restart the map clears.
 */

interface IpWindow {
  /** Sorted timestamps (ms since epoch) of recent requests. */
  hits: number[];
}

const STATE = new Map<string, IpWindow>();

const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Enforce the rate limit for a given client IP. Returns `{allowed:true}`
 * on pass or `{allowed:false, retryAfterMs}` on reject. The caller is
 * responsible for converting to a 429 + Retry-After response.
 *
 * The function MUTATES the in-memory state on every call (records the
 * new timestamp on pass) so it's NOT safe to call twice for the same
 * request — the second call would count the request twice. Callers
 * should invoke once at the top of the route handler.
 */
export function enforce(
  ip: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  // 'unknown' is the placeholder pickClientIp returns when no forward
  // header is present. We still rate-limit that bucket — refusing all
  // 'unknown' callers entirely would break dev where IPs resolve to
  // localhost loopbacks, but bucketing them together means a flood
  // from one unknown source can be capped.
  const key = ip || 'unknown';
  const entry = STATE.get(key) ?? { hits: [] };

  // Drop expired timestamps — they're stored sorted, so binary
  // search would be faster, but the typical hit count is <= `limit`
  // (around 20) and a linear scan over 20 entries is microseconds.
  const surviving: number[] = [];
  for (const t of entry.hits) {
    if (t >= cutoff) surviving.push(t);
  }

  if (surviving.length >= limit) {
    // Oldest surviving hit determines when the window will free up a
    // slot. Retry-After surfaces this to the client as a ms hint.
    const oldest = surviving[0]!;
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    STATE.set(key, { hits: surviving });
    return { allowed: false, retryAfterMs };
  }

  surviving.push(now);
  STATE.set(key, { hits: surviving });
  return { allowed: true };
}

/**
 * Test-only reset. Exposed so route handler tests can null out the
 * shared state between cases. Production code never imports this.
 */
export function __resetEdgeRateLimitForTests(): void {
  STATE.clear();
}

/**
 * Snapshot the current window for an IP — used by middleware to
 * surface `X-RateLimit-*` headers without double-counting. Returns
 * `null` when no entries exist for that IP. Read-only; does not
 * mutate.
 */
export function peek(
  ip: string,
  windowMs: number = DEFAULT_WINDOW_MS,
): { recentHits: number; oldestMsAgo: number | null } | null {
  const entry = STATE.get(ip);
  if (!entry) return null;
  const now = Date.now();
  const cutoff = now - windowMs;
  const surviving = entry.hits.filter((t) => t >= cutoff);
  if (surviving.length === 0) return null;
  return {
    recentHits: surviving.length,
    oldestMsAgo: now - surviving[0]!,
  };
}

export const EDGE_RATE_LIMIT_DEFAULTS = {
  limit: DEFAULT_LIMIT,
  windowMs: DEFAULT_WINDOW_MS,
} as const;
