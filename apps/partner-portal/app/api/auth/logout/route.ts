import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sign-out. Clears the HttpOnly auth cookies on this origin and asks
 * the backend to revoke the refresh token. We swallow backend errors
 * because the user's intent is unambiguous — we want them out of the
 * tab regardless of what the server says.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3300';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('eazepay_rt')?.value;
  const accessToken = req.cookies.get('eazepay_at')?.value;

  // Best-effort revoke. Don't block the client teardown on this.
  if (refreshToken) {
    void fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      /* network errors during sign-out are non-fatal */
    });
  }

  const response = NextResponse.json({ ok: true });
  // Overwrite each cookie with an immediately-expiring blank.
  response.cookies.set('eazepay_at', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('eazepay_rt', '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
  response.cookies.set('eazepay_demo', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
