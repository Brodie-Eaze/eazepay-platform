import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sign-out. Clears the HttpOnly auth cookies on this origin and asks
 * the backend to revoke the refresh token.
 *
 * SEC-110 hardening: pre-fix, the backend revoke was fire-and-forget
 * (`void fetch(...).catch`) — if the call timed out or 5xx'd, the
 * client cookie was cleared but the server-side session lived on.
 * That contradicts the SEC-009 revocation contract: a session must
 * not be considered terminated until the backend confirms.
 *
 * New behaviour:
 *   1. Await the backend revoke (10s timeout). On 2xx, proceed to
 *      clear cookies.
 *   2. On any non-2xx or network error, DO NOT clear cookies; surface
 *      a 502/504 problem-details body with code `logout_revoke_failed`
 *      so the client can retry or surface a "still signed in" warning.
 *      The user's session is intact server-side; pretending otherwise
 *      would be the silent failure pattern the security review flagged.
 *   3. Always preserve the full cookie attribute set on clear (path +
 *     sameSite + secure) so browsers identify the same cookie and
 *     don't leave a ghost.
 *
 * Cookie cookies that were never set in the first place still get the
 * blank-overwrite — cheap and prevents stragglers from older sessions.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';
const REVOKE_TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('eazepay_rt')?.value;
  const accessToken = req.cookies.get('eazepay_at')?.value;
  const demoCookie = req.cookies.get('eazepay_demo')?.value;

  // Demo-only sessions don't have a backend to revoke against — just
  // clear cookies and return.
  if (!refreshToken && !accessToken && demoCookie) {
    return clearAndOk();
  }

  // No session at all → still respond 200 with cookies cleared so
  // double-clicks on sign-out don't 401.
  if (!refreshToken && !accessToken) {
    return clearAndOk();
  }

  // Await backend revoke. On failure we leave cookies alone so the
  // client knows the session is still live.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken: refreshToken ?? null }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Surface backend status so the client can decide.
      return NextResponse.json(
        {
          type: 'about:blank',
          title: 'Sign-out failed',
          status: res.status >= 500 ? 502 : res.status,
          code: 'logout_revoke_failed',
          detail: 'Backend declined to revoke the session. You are still signed in.',
        },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        type: 'about:blank',
        title: aborted ? 'Sign-out timed out' : 'Backend unreachable',
        status: aborted ? 504 : 502,
        code: 'logout_revoke_failed',
        detail:
          'Could not confirm session revocation with the backend. You are still signed in. Retry to complete sign-out.',
      },
      { status: aborted ? 504 : 502 },
    );
  }

  return clearAndOk();
}

function clearAndOk(): NextResponse {
  const response = NextResponse.json({ ok: true });
  // SEC-110 sub: mirror the set-cookie attributes (sameSite, path,
  // secure) when clearing so the browser identifies the same cookie
  // and doesn't leave a ghost behind. Without sameSite/secure on the
  // clear, some browsers treat the operation as a different cookie.
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set('eazepay_at', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('eazepay_rt', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 0,
  });
  response.cookies.set('eazepay_demo', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
