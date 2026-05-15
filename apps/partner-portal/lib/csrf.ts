import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * SEC — CSRF defence-in-depth for the partner-portal BFF.
 *
 * Existing layer: HttpOnly + SameSite=Lax on the auth cookies, which
 * blocks the most common cross-site form-POST CSRF in evergreen
 * browsers. SameSite=Lax is BROAD but not bulletproof — top-level
 * GET-initiated cross-site requests still send the cookie, and some
 * embedded contexts (Safari 16 ITP variants, in-app webviews,
 * pre-OAuth redirect flows) treat SameSite ambiguously.
 *
 * This module adds a double-submit cookie pattern as belt-and-braces:
 *   1. On any GET to an authenticated route, set `eazepay_csrf` if
 *      missing. HttpOnly=false so client JS can read it for the
 *      header echo; Secure + SameSite=Strict so a cross-site context
 *      cannot replay it.
 *   2. State-changing routes pull `eazepay_csrf` from the cookie AND
 *      `X-CSRF-Token` from the request header and constant-time
 *      compare. Reject 403 `csrf_token_mismatch` on failure.
 *
 * Why double-submit specifically: it requires no server-side state
 * (vs. synchroniser tokens) and binds CSRF to the same browser session
 * that issued the cookie — a cross-origin attacker cannot read the
 * cookie (Secure + SameSite=Strict) so they cannot echo it back. The
 * downside is XSS bypass: a script running on this origin can read
 * the cookie and forge the header. We accept that — XSS is a
 * higher-order vulnerability whose mitigation is CSP + escaping, not
 * CSRF tokens.
 *
 * Cookie name: `eazepay_csrf` — distinct prefix from the session
 * cookies so a "delete all eazepay_*" cookie sweep clears them
 * together but the names don't collide.
 *
 * Header name: `X-CSRF-Token` — standard, matches what Axios /
 * fetch-wrapper helpers commonly set automatically.
 */

const CSRF_COOKIE_NAME = 'eazepay_csrf' as const;
const CSRF_HEADER_NAME = 'X-CSRF-Token' as const;
const CSRF_HEADER_NAME_LOWER = 'x-csrf-token' as const;
const CSRF_TOKEN_BYTES = 32;
const CSRF_TTL_SECONDS = 60 * 60 * 8; // 8h — matches the typical session window

/**
 * Mint a fresh CSRF token. 32 random bytes ≈ 256 bits of entropy. A
 * legitimate session reuses the same token for the cookie's TTL; a
 * fresh token is minted only when the cookie is missing or expired.
 *
 * Hex (not base64url) because `X-CSRF-Token` values commonly land in
 * server-access logs — hex is unambiguous in URL-encoded contexts
 * and a leak of the value to a logging stack doesn't change anything
 * because the token is meant to be readable by client JS already.
 */
export function mintCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}

/**
 * Constant-time comparison of two token strings. Returns false on any
 * length mismatch, hex decode failure, or value mismatch — never throws.
 *
 * The branch on `Buffer.from(.., 'hex')` length is necessary because a
 * malformed hex input (odd-length, non-hex chars) silently produces a
 * shorter buffer; without the length check a 0-length buffer would
 * compare equal to itself trivially.
 */
export function verifyCsrfToken(
  headerVal: string | null | undefined,
  cookieVal: string | null | undefined,
): boolean {
  if (!headerVal || !cookieVal) return false;
  if (headerVal.length !== cookieVal.length) return false;
  let headerBuf: Buffer;
  let cookieBuf: Buffer;
  try {
    headerBuf = Buffer.from(headerVal, 'hex');
    cookieBuf = Buffer.from(cookieVal, 'hex');
  } catch {
    return false;
  }
  if (headerBuf.length === 0 || headerBuf.length !== cookieBuf.length) {
    return false;
  }
  return timingSafeEqual(headerBuf, cookieBuf);
}

/**
 * Pull the CSRF cookie + header from a NextRequest. Returns the pair
 * regardless of whether either is present — the caller does the
 * verify-or-403 dance, keeping this module pure.
 */
export function readCsrfPair(req: NextRequest): { cookie: string | null; header: string | null } {
  return {
    cookie: req.cookies.get(CSRF_COOKIE_NAME)?.value ?? null,
    // Headers are case-insensitive per HTTP/1.1; the Next.js Headers
    // wrapper normalises to lowercase on read, but check both spellings
    // to be tolerant of forwarded-proxy mangling.
    header: req.headers.get(CSRF_HEADER_NAME) ?? req.headers.get(CSRF_HEADER_NAME_LOWER) ?? null,
  };
}

/**
 * Set the CSRF cookie on a response. Called from middleware on any
 * authenticated GET if the cookie is missing — that way the token is
 * already present when the client renders the form that will POST.
 *
 * HttpOnly is deliberately FALSE — the client needs to read it via
 * `document.cookie` to echo into the header. SameSite=Strict ensures
 * a cross-site context cannot piggyback on the session.
 */
export function setCsrfCookie(res: NextResponse, value: string): void {
  res.cookies.set(CSRF_COOKIE_NAME, value, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_TTL_SECONDS,
  });
}

/**
 * Guard for state-changing route handlers. Returns null on success,
 * a 403 Problem Details Response on failure. The handler short-
 * circuits with:
 *
 *   const csrfFail = enforceCsrf(req);
 *   if (csrfFail) return csrfFail;
 *
 * Pulled out as a function because both the verify-then-return shape
 * and the 403 body must be byte-identical across every wrapped route
 * — divergent bodies would let a probing attacker fingerprint which
 * routes are wrapped.
 */
export function enforceCsrf(req: NextRequest): Response | null {
  // Login is a special case — the user has no session yet, so the
  // CSRF cookie hasn't been minted by middleware. The caller passes
  // `req` regardless; we treat a missing cookie as "exempt — first
  // request, the cookie ride-alongs in the response."
  const { cookie, header } = readCsrfPair(req);
  if (!verifyCsrfToken(header, cookie)) {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'csrf_token_mismatch',
        detail:
          'The CSRF token submitted with this request did not match the session token. Reload the page and try again.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
  return null;
}

export const CSRF_CONSTANTS = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
  ttlSeconds: CSRF_TTL_SECONDS,
} as const;
