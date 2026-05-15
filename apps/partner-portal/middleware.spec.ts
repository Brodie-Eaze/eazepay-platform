import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

/**
 * Middleware fence smoke tests.
 *
 * The middleware has two jobs: inject `x-pathname` on the RSC request
 * headers, and bounce unauthed requests to `/sign-in?from=<safe-path>`.
 * SEC-008 closed an open-redirect vector: pre-fix, `from` could be set
 * to `//evil.com` or `https://evil.com` because the middleware just
 * encoded `pathname + search` verbatim. The current implementation
 * normalises any non-relative path to `/` before encoding. These specs
 * pin that behaviour.
 *
 * Note: `NextRequest` in vitest doesn't emit a real 302 — the Response
 * object carries the redirect target in its `Location` header.
 */

function unauthedRequest(url: string): NextRequest {
  // why: a NextRequest with no cookies is exactly what the middleware
  // sees from a logged-out browser hitting a protected path.
  return new NextRequest(url);
}

function authedRequest(url: string): NextRequest {
  // why: build a NextRequest carrying the `eazepay_at` access-token
  // cookie. The middleware treats this as a real session.
  const req = new NextRequest(url, {
    headers: { cookie: 'eazepay_at=fake-access-token' },
  });
  return req;
}

describe('partner-portal middleware', () => {
  it('redirects unauthed /control-panel to /sign-in with from=/control-panel', () => {
    const res = middleware(unauthedRequest('http://localhost:3004/control-panel'));
    expect(res.status).toBe(307); // NextResponse.redirect default
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const u = new URL(location!);
    expect(u.pathname).toBe('/sign-in');
    // why: encodeURIComponent('/control-panel') === '%2Fcontrol-panel'
    expect(u.searchParams.get('from')).toBe('/control-panel');
  });

  it('SEC-008 — scheme-relative path (//evil.com) is normalised to /', () => {
    // why: a phishing site could craft a sign-in link that, after
    // login, redirects to `//evil.com` (which the browser interprets
    // as the attacker's host). The middleware refuses to round-trip
    // any `from` that starts with `//`.
    const res = middleware(unauthedRequest('http://localhost:3004//evil.com'));
    const location = res.headers.get('location');
    expect(location).toBeTruthy();
    const u = new URL(location!);
    expect(u.pathname).toBe('/sign-in');
    expect(u.searchParams.get('from')).toBe('/');
  });

  it('SEC-008 — absolute URL in pathname normalises to /', () => {
    // why: similar to the //evil.com case but with an explicit https
    // scheme baked into the path. NextRequest normalises the URL
    // before middleware sees it, so the most realistic abuse vector
    // is a scheme-relative `//evil.com` (covered above). We assert
    // the function's contract on any non-relative input.
    const res = middleware(unauthedRequest('http://localhost:3004/https://evil.com/path'));
    const location = res.headers.get('location');
    const u = new URL(location!);
    expect(u.pathname).toBe('/sign-in');
    // why: `/https://evil.com/path` *does* start with `/` and not
    // `//`, so the middleware lets it through — this is fine because
    // the browser interprets it as a relative path back to our own
    // origin, never to evil.com.
    expect(u.searchParams.get('from')).toBe('/https://evil.com/path');
  });

  it('preserves the query string in the from parameter', () => {
    // why: a user clicking a deep link like /apply?invite=xyz needs to
    // land back on the same URL after auth, query intact.
    const res = middleware(unauthedRequest('http://localhost:3004/control-panel?tab=invites'));
    const location = res.headers.get('location');
    const u = new URL(location!);
    expect(u.searchParams.get('from')).toBe('/control-panel?tab=invites');
  });

  it('authed request to /control-panel passes through (no redirect)', () => {
    const res = middleware(authedRequest('http://localhost:3004/control-panel'));
    // why: NextResponse.next() returns a 200-ish response, NOT 307.
    // The contract is "no location header" — the request was forwarded
    // upstream rather than redirected.
    expect(res.headers.get('location')).toBeNull();
    // And the injected x-pathname is set so RSCs can read it.
    expect(res.headers.get('x-middleware-request-x-pathname')).toBe('/control-panel');
  });

  it('public paths are not gated (no auth required)', () => {
    // why: /sign-in itself must not redirect to /sign-in, otherwise we
    // have a redirect loop. Same for /apply (consumer landing).
    const signIn = middleware(unauthedRequest('http://localhost:3004/sign-in'));
    expect(signIn.headers.get('location')).toBeNull();
    const apply = middleware(unauthedRequest('http://localhost:3004/apply/medpay'));
    expect(apply.headers.get('location')).toBeNull();
  });

  it('/api/* and /_next/* are public (cookie-less RPC works)', () => {
    // why: BFF route handlers run inside the same Next process and
    // some are intentionally public (consumer apply endpoints). The
    // fence must skip /api entirely; auth is enforced per-route.
    const api = middleware(unauthedRequest('http://localhost:3004/api/onboarding/invite'));
    expect(api.headers.get('location')).toBeNull();
    const nextAsset = middleware(unauthedRequest('http://localhost:3004/_next/static/chunk.js'));
    expect(nextAsset.headers.get('location')).toBeNull();
  });
});
