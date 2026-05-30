/**
 * SEC-010 — Origin enforcement for state-changing BFF routes.
 *
 * Threat being closed
 * -------------------
 * SameSite=Lax + the CSRF double-submit cookie already block the most
 * obvious cross-site form POST attacks. Defence in depth still wants
 * an explicit `Origin` header check on every state-changing partner /
 * admin route because:
 *
 *   • Some embedded WebView contexts (in-app browsers, OAuth redirect
 *     shells) treat SameSite=Lax loosely — a forged `<form>` submission
 *     from a phishing host can still ship the partner-session cookie
 *     to a same-origin handler.
 *   • A future client mistake (`credentials: 'include'` on a cross-
 *     origin fetch) silently widens the attack surface unless the
 *     server rejects mismatched Origins at the edge.
 *   • Auditors expect to see an allowlist check, not just SameSite.
 *
 * Defence
 * -------
 * One helper, used by every state-changing partner / admin route. The
 * call site short-circuits with:
 *
 *   const originFail = enforceOrigin(req);
 *   if (originFail) return originFail;
 *
 * Allowlist:
 *   • Production: exact-match against `process.env.ALLOWED_ORIGINS`
 *     (CSV of `https://host[:port]` entries).
 *   • Dev / test: localhost:* and 127.0.0.1:* on http or https, plus
 *     `ALLOWED_ORIGINS` if set.
 *
 * ALLOWED_ORIGINS posture (SEC-EZ-003 — read this before trusting the
 * comment above):
 *   • `ALLOWED_ORIGINS` is RECOMMENDED, not REQUIRED, in lib/env.ts —
 *     the boot-time validator WARNS when it is unset but does NOT
 *     refuse to boot. (It was REQUIRED during the ship-ready sprint,
 *     then deliberately downgraded so the stub-phase deploy isn't
 *     blocked while the real MiCamp/HighSale partner keys aren't wired.)
 *   • The runtime guard below FAILS CLOSED per request regardless: when
 *     `ALLOWED_ORIGINS` is empty in production, the allowlist set is
 *     empty, so any cross-origin `Origin`/`Referer` is rejected with a
 *     403 and a missing-both-headers request is rejected too. Absent
 *     config never means "allow all" — it means "allow nothing but
 *     same-origin browser requests". SameSite=Lax + the CSRF
 *     double-submit cookie remain in force underneath.
 *   • Re-upgrade `ALLOWED_ORIGINS` (and the partner webhook secrets) to
 *     REQUIRED in lib/env.ts BEFORE partner webhooks / cross-origin
 *     embeds go live, so a misconfigured prod fails the deploy loudly
 *     instead of silently running with an empty allowlist.
 *
 * Exemptions:
 *   • Webhook routes — partner-side servers POST without a browser, so
 *     they don't send Origin. Auth comes from HMAC signature on the
 *     body. The middleware allowlist already exempts /webhook paths;
 *     this guard is never called from a webhook route, but a default-
 *     deny stance would refuse a missing Origin so it's worth being
 *     explicit.
 *   • Public consumer apply routes — `/api/v/<brand>/applications`
 *     POST is intentionally cross-origin (a partner's marketing site
 *     embeds an iframe / form on their domain). Not wrapped.
 *
 * Same-origin request handling
 * ----------------------------
 * Some browsers omit `Origin` on same-origin POSTs. We accept a missing
 * Origin only when `Referer` is present AND matches the allowlist. If
 * BOTH are missing the request is rejected — that combination is rare
 * for legitimate browsers and common for hand-crafted curl-style abuse
 * which can be denied without UX cost.
 */

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Parse `ALLOWED_ORIGINS` into a normalised set of allowed origins.
 *
 * Normalisation:
 *   • Strip trailing slash so `https://app.eazepay.com/` matches
 *     `https://app.eazepay.com`.
 *   • Lower-case the host so case-mangled headers don't bypass.
 *   • Drop empty entries (handles `a,,b` and trailing commas).
 *
 * Cached on first read; tests reset via `_resetAllowedOriginsCache()`.
 */
let cachedAllowed: Set<string> | null = null;

function parseAllowedOrigins(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim().replace(/\/+$/, '');
    if (trimmed.length === 0) continue;
    out.add(trimmed.toLowerCase());
  }
  return out;
}

function getAllowedOrigins(): Set<string> {
  if (cachedAllowed !== null) return cachedAllowed;
  cachedAllowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  // SEC-EZ-003: surface the empty-allowlist posture once per worker in
  // production. The guard still fails closed (empty set rejects every
  // cross-origin request), but an unset ALLOWED_ORIGINS in prod is a
  // launch-day misconfiguration worth a loud log line so it doesn't go
  // unnoticed. Warn-only — never throws, never blocks the request path.
  if (cachedAllowed.size === 0 && process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      '[origin-guard] ALLOWED_ORIGINS is unset in production — origin allowlist is empty, ' +
        'so every cross-origin state-changing request is rejected (fail-closed). Set ALLOWED_ORIGINS ' +
        'before partner webhooks / cross-origin embeds go live. See lib/env.ts (RECOMMENDED → re-upgrade to REQUIRED).',
    );
  }
  return cachedAllowed;
}

/** Test-only: drop the cache so a spec can mutate `ALLOWED_ORIGINS`. */
export function _resetAllowedOriginsCache(): void {
  cachedAllowed = null;
}

/**
 * Is `origin` (a normalised string like `https://app.eazepay.com`) a
 * loopback host that's always trusted in non-production?
 */
function isLocalhostOrigin(origin: string): boolean {
  // Match `http://localhost:PORT`, `http://127.0.0.1:PORT`, and the
  // https variants. No regex on path — Origin headers never include
  // path components.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Normalise a candidate origin/referer to the same shape entries in
 * `ALLOWED_ORIGINS` use: lower-case, no trailing slash, no path.
 *
 * Returns null when the URL is unparseable or is missing a scheme +
 * host — both are unsafe to forward into a comparison.
 */
function normaliseOrigin(value: string | null): string | null {
  if (!value || value === 'null') return null;
  try {
    const url = new URL(value);
    if (!url.protocol || !url.host) return null;
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function forbidden(detail: string): NextResponse {
  // RFC 7807 problem-details — same shape as the rest of the BFF's
  // 4xx responses so a fingerprinting attacker can't pick this one
  // out by body shape.
  return NextResponse.json(
    {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'forbidden_origin',
      detail,
    },
    { status: 403 },
  );
}

/**
 * Reject any request whose `Origin` (or, when Origin is absent,
 * `Referer`) is not on the allowlist.
 *
 * Returns:
 *   • `null` when the request passes — caller continues.
 *   • A 403 `NextResponse` when the request fails — caller returns it
 *     unchanged.
 *
 * Behaviour:
 *   1. Pull and normalise `Origin`. If present, must match the
 *      allowlist exactly.
 *   2. Origin absent (some same-origin POSTs omit it): fall back to
 *      `Referer` and match its origin component against the allowlist.
 *   3. Both absent: reject. Legitimate browsers send at least one;
 *      hand-crafted curl-style requests are the dominant case here
 *      and they don't need to hit state-changing surfaces from
 *      outside our origin.
 *
 * In non-production (`NODE_ENV !== 'production'`) localhost and
 * 127.0.0.1 always pass even if not listed — local dev usually has
 * `ALLOWED_ORIGINS` unset.
 */
export function enforceOrigin(req: NextRequest): NextResponse | null {
  const isProd = process.env.NODE_ENV === 'production';
  const allowed = getAllowedOrigins();

  const originHeader = req.headers.get('origin');
  const refererHeader = req.headers.get('referer');

  const candidate = normaliseOrigin(originHeader) ?? normaliseOrigin(refererHeader);

  // Both headers absent. In production we reject — browsers send at
  // least one on POST/PATCH/DELETE; the omission is overwhelmingly
  // attack traffic. In non-production we accept because:
  //   - unit tests build NextRequest without these headers
  //   - `curl` / Postman from a local operator IS legitimate
  //   - the threat (session-cookie-bearing cross-origin POST) doesn't
  //     exist outside of a deployed browser surface
  if (!candidate) {
    if (!isProd) return null;
    return forbidden('This endpoint requires a same-origin browser request.');
  }

  // Non-prod loopback allowance — covers `next dev` on any port.
  if (!isProd && isLocalhostOrigin(candidate)) {
    return null;
  }

  if (allowed.has(candidate)) {
    return null;
  }

  return forbidden('Request origin is not on the allowlist for this endpoint.');
}
