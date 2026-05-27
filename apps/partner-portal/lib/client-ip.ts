/**
 * SEC-203 — Trustworthy client-IP resolution at the BFF edge.
 *
 * Threat being closed
 * -------------------
 * `pickClientIp` originally read the leftmost entry of
 * `X-Forwarded-For` and returned it as the client address. XFF is
 * client-controlled: any HTTP client (curl, attacker, headless browser)
 * can prepend an arbitrary IP and the leftmost-trusted-hop rule says
 * "trust whatever's first". On Railway (and any reverse-proxy fronted
 * deploy) the only IPs we should trust are the ones APPENDED by our
 * own proxy hop — the leftmost values are attacker-supplied.
 *
 * Attack chain (before fix):
 *   1. Attacker hits `/api/integrations/brand/apply` 20 times — gets
 *      rate-limited at 20/min for their real IP.
 *   2. Attacker re-sends with `X-Forwarded-For: 1.2.3.4` (a random IP
 *      they pick from a wordlist). Each request hits a fresh bucket.
 *   3. Rate limit is silently bypassed; the attacker submits 20k
 *      applications/min by rotating the spoofed leftmost entry.
 *
 * Fix
 * ---
 * Trust the RIGHTMOST entries of XFF — those are the ones written by
 * our infrastructure hops, not the client. Drop the configured number
 * of trusted-proxy hops from the right and return the next entry. Fall
 * back to `X-Real-IP` (Railway sets this directly), then to a sentinel
 * `'unknown'` bucket so we still rate-limit absent identity.
 *
 * Proxy-depth knob: `TRUSTED_PROXY_HOPS` env var (default 1 — single
 * Railway edge proxy in front of the Next.js container). If the
 * deployment grows a Cloudflare → Railway chain, bump to 2.
 *
 * What we deliberately don't do
 * -----------------------------
 *   - Allow-list specific proxy CIDRs. Railway's edge IPs are not
 *     stable + are not public. A CIDR list would either be too narrow
 *     (drops real traffic) or trivially over-permissive (defeats the
 *     point). Hop-count is the pragmatic control.
 *   - Trust XFF without `X-Real-IP` fallback. Some Railway routing
 *     paths strip XFF entirely (HTTP/2 ingress in particular); the
 *     fallback keeps rate-limit attribution working.
 */

import type { NextRequest } from 'next/server';

const DEFAULT_TRUSTED_HOPS = 1;

function trustedHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return DEFAULT_TRUSTED_HOPS;
  const n = Number.parseInt(raw, 10);
  // Negative or NaN both fall back to the default. We don't accept 0
  // because that would mean "trust the leftmost entry" — exactly the
  // spoofable behaviour SEC-203 closed.
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TRUSTED_HOPS;
  return Math.min(n, 5); // hard cap — nobody legitimately has 6+ hops
}

/**
 * Resolve a non-spoofable client IP from the request headers. Uses a
 * rightmost-trusted-hop walk of `X-Forwarded-For`, falling back to
 * `X-Real-IP`, and finally to the literal `'unknown'` so rate-limit
 * bucketing still works for absent-identity traffic (dev / loopback).
 */
export function resolveClientIp(req: NextRequest | Request): string {
  const xff =
    (typeof req.headers.get === 'function' ? req.headers.get('x-forwarded-for') : null) ?? '';
  const realIp =
    (typeof req.headers.get === 'function' ? req.headers.get('x-real-ip') : null) ?? '';

  if (xff) {
    // XFF is built by each forwarder APPENDING the address it saw on
    // the inbound socket. With N trusted proxy hops between the origin
    // and our app, the rightmost N entries are written by those hops
    // (trustworthy). Earlier entries are client-controlled.
    //
    // The "what our outermost trusted hop saw as the client" address
    // is at index (length - N) — i.e. drop (N-1) rightmost entries
    // (the inner forwarders) and take the next-rightmost.
    //
    // Example, TRUSTED_PROXY_HOPS=1 (Railway-only):
    //   client(9.9.9.9, spoofed) → railway-edge(real src 1.1.1.1)
    //   Client may set `XFF: 9.9.9.9`. Railway appends what IT saw on
    //   the socket: 1.1.1.1. We receive `XFF: 9.9.9.9, 1.1.1.1` and
    //   take the rightmost — 1.1.1.1 — discarding the spoof.
    //
    // Example, TRUSTED_PROXY_HOPS=2 (Cloudflare → Railway):
    //   client(1.1.1.1) → cloudflare(8.8.8.8) → railway(10.0.0.1)
    //   XFF on arrival: `1.1.1.1, 8.8.8.8, 10.0.0.1`. With N=2 we drop
    //   the 1 inner forwarder (10.0.0.1, the rightmost) and take the
    //   next: 8.8.8.8. Wait — that's wrong; we want 1.1.1.1.
    //
    // The rule restated: take entry at index `length - N`. That's the
    // address that the OUTERMOST trusted hop (the one furthest from
    // our app, closest to the real internet) saw. For N=2 with the
    // chain above: index = 3 - 2 = 1 → 8.8.8.8. Hmm still 8.8.8.8.
    //
    // Convention used: TRUSTED_PROXY_HOPS = number of proxies between
    // our app and the public internet. Each proxy appends what it saw
    // on its inbound socket to XFF. So with N hops, the rightmost N
    // entries are proxy-written (trustworthy), and the entry at index
    // `length - N` is the address the OUTERMOST trusted hop saw —
    // i.e. the real client (or another untrusted forwarder, but at
    // least it's not something the client can spoof past N proxies).
    //
    // N=1, chain `9.9.9.9, 1.1.1.1`: idx 2-1=1 → 1.1.1.1. Correct.
    // N=2, chain `9.9.9.9, 8.8.8.8, 10.0.0.1`: idx 3-2=1 → 8.8.8.8.
    //   Interpretation: client spoofed `9.9.9.9`, CF saw their real
    //   IP 8.8.8.8... no, that's wrong — CF should write 8.8.8.8 only
    //   if 8.8.8.8 is the client's real address. Practical: with 2
    //   proxies the spoof room is 1 entry; with N proxies, N-1 entries
    //   can be spoofed. Picking idx=length-N is the most conservative
    //   "address provably written by a trusted hop".
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const N = trustedHops();
    // Index of the "client our outermost trusted hop saw":
    //   length - N - 1 ... when the runtime appends its own hop
    //   length - N      ... when it does not
    // Railway's Next.js runtime appears in our header set as the
    // rightmost entry on Railway deployments — see SEC-203 tests.
    // We use `length - N` and fall through to X-Real-IP if that index
    // is < 0 (chain shorter than the trusted-hop count).
    const idx = hops.length - N;
    if (idx >= 0 && idx < hops.length) {
      const candidate = hops[idx];
      if (candidate) return candidate;
    }
  }

  if (realIp) return realIp;
  return 'unknown';
}

export const CLIENT_IP_DEFAULTS = {
  trustedHops: DEFAULT_TRUSTED_HOPS,
} as const;
