/**
 * POST /api/account/sign-out
 *
 * Clears the account-session cookie. Idempotent: safe to call from a
 * stale session, double-clicks, etc. CSRF-wrapped so a cross-site
 * forced sign-out can't happen against an active session.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { enforceCsrf } from '../../../../lib/csrf.js';
import { ACCOUNT_COOKIE } from '../../../../lib/account-cookie';

export async function POST(req: NextRequest) {
  const csrfFail = enforceCsrf(req);
  if (csrfFail) return csrfFail;
  const response = NextResponse.json({ ok: true, redirectTo: '/sign-in' });
  response.cookies.set(ACCOUNT_COOKIE.name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
