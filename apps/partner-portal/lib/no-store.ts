/**
 * SEC-212 — `Cache-Control: no-store` helper for sensitive responses.
 *
 * Threat: shared intermediaries (corporate proxies, browser back-button
 * caches, CDN-misconfigurations) MAY cache a 200 response that carries
 * session tokens, account-scoped data, admin reporting, or per-brand
 * tenant data. A second user on the same egress IP could be served
 * the cached body containing the first user's data.
 *
 * Defence: every response that carries identity-bearing or tenant-
 * scoped data sets `Cache-Control: no-store`. `no-store` is stricter
 * than `no-cache` — it forbids storage entirely (private + shared),
 * which is the right posture for auth + admin + per-tenant payloads.
 *
 * Pragma: 'no-cache' + Expires: '0' for HTTP/1.0-era intermediaries
 * that may still ignore Cache-Control. Belt + braces.
 */

/**
 * Mutates the response Headers in place to add no-store + Pragma +
 * Expires. Returns the response for chaining.
 *
 * Safe to call on responses that already have a Cache-Control header
 * — we overwrite. The expectation is "this response is sensitive" and
 * an existing Cache-Control: public would be a bug regardless.
 */
export function noStore<T extends Response>(res: T): T {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

/**
 * Headers object spread suitable for `new Response(body, { headers })`
 * call sites that don't have a mutable Response handy.
 */
export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
} as const;
