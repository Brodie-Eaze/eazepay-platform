/**
 * Client-side CSRF header helper.
 *
 * Reads the `eazepay_csrf` cookie (HttpOnly=false by design — see
 * lib/csrf.ts) and returns the headers object every state-changing
 * client fetch should merge in. Routes that wrap `enforceCsrf(req)`
 * server-side require the matching `X-CSRF-Token` header here, or the
 * request gets a 403 csrf_token_mismatch.
 *
 * Two flavours:
 *   - `csrfHeaders()` returns a plain `Record<string,string>` for
 *     spreading into a fetch options object.
 *   - `withCsrfHeaders(init)` patches a `RequestInit` so a call site
 *     can swap a raw fetch for a CSRF-aware one with one wrapper.
 *
 * Same cookie name + read logic as `lib/api-client.ts` (the BFF-prefixed
 * caller) — duplicated rather than imported to keep this module free of
 * the api-client's React hooks. When the apply-flow + onboarding pages
 * migrate to a shared fetch helper, both call sites can collapse.
 */

const CSRF_COOKIE_NAME = 'eazepay_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

function readCsrfCookieFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

export function csrfHeaders(): Record<string, string> {
  const token = readCsrfCookieFromDocument();
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}

export function withCsrfHeaders(init?: RequestInit): RequestInit {
  const merged: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      merged[key] = value;
    });
  }
  Object.assign(merged, csrfHeaders());
  return { ...init, headers: merged };
}
