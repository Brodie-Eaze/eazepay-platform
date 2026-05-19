import { NextResponse, type NextRequest } from 'next/server';
import { mintCsrfToken, setCsrfCookie, CSRF_CONSTANTS } from './lib/csrf.js';
import { readSignedDemoPreset } from './lib/demo-cookie.js';
import { readSignedAccountSession, ACCOUNT_COOKIE } from './lib/account-cookie.js';
import { assertProdEnv } from './lib/env.js';

// Boot-time env validation. Runs once at module-load (when Next.js
// evaluates this module on worker start). In production, throws if any
// REQUIRED secret is missing — Railway's health check fails, the deploy
// stays unhealthy, and traffic continues hitting the previous revision.
// In dev, surfaces warnings but keeps the placeholder secrets working.
// See lib/env.ts for the failure-mode catalog.
assertProdEnv();

/**
 * Three jobs at the edge, before any route handler or React Server
 * Component runs:
 *
 *  1. Inject `x-pathname` on the request headers so server components
 *     can read it (used for nav highlighting). Setting headers on
 *     `request` inside `NextResponse.next` propagates them to the RSC
 *     request — that's what `headers()` in app/* reads.
 *
 *  2. Auth fence. Protected routes require either a real session
 *     (`eazepay_at`) or a demo session (`eazepay_demo`). No cookie →
 *     302 to `/sign-in?from=<encoded path>` so the form can bounce
 *     them back where they came from after authenticating.
 *
 *  3. CSRF cookie mint. On any GET to an authenticated path, set the
 *     `eazepay_csrf` cookie if missing so the page-side fetch helper
 *     can echo it into the `X-CSRF-Token` header on state-changing
 *     calls. See lib/csrf.ts for the threat model and the
 *     state-changing route wrappers that enforce verification.
 */

const PUBLIC_PATHS: ReadonlyArray<string> = [
  '/sign-in',
  '/welcome', // matches /welcome AND /welcome/<brand> — new-account password-set landing
  '/onboarding',
  '/forgot-password',
  '/create-account',
  '/help',
  '/apply', // consumer apply landing — external customers
  '/lenders', // public lender developer hub — prospective lenders preview the marketplace + endpoints
  '/docs', // public lender integration docs
  '/landing', // public per-vertical marketing landing pages (MedPay / TradePay / CoachPay)
  '/invoices/confirm', // recipient confirm/dispute page — token IS the credential, no session needed
  '/accept', // team-invite accept landing (/accept/<brand>?token=...)
  '/sales', // sales-team pitch decks (sales reps share links with prospects)
  '/medpay', // MedPay flow pages (Landing/Website/Checkout/Success/Onboarding)
  '/tradepay', // TradePay flow pages (Checkout/Onboarding)
  '/coachpay', // CoachPay flow pages (Checkout/Onboarding)
];

const isPublic = (pathname: string): boolean => {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
};

/**
 * Whether to honour an `eazepay_demo` cookie as a session. We default
 * to trusting demo cookies everywhere because the brand portal tiles
 * on the sign-in page are the primary way prospective MedPay /
 * TradePay / CoachPay partners explore the platform before formal
 * onboarding, and no live consumer money is flowing today. Operators
 * can hard-disable by setting `DEMO_MODE_ENABLED=false` — the cookie
 * setter in /app/api/auth/demo/route.ts honours the same flag, so a
 * forged cookie hitting a hardened deployment fails both layers.
 */
function demoCookieTrusted(): boolean {
  return process.env.DEMO_MODE_ENABLED !== 'false';
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const hasRealSession = Boolean(req.cookies.get('eazepay_at')?.value);
  // SEC-103/109: verify the demo cookie's HMAC signature before
  // trusting it as a session. A forged/expired cookie returns null
  // and is treated as no session — the user is bounced to /sign-in.
  let hasDemoSession = false;
  if (demoCookieTrusted()) {
    const signed = req.cookies.get('eazepay_demo')?.value;
    if (signed) {
      const verified = await readSignedDemoPreset(signed);
      hasDemoSession = verified !== null;
    }
  }
  // Real account-session cookie (set after a business completes
  // onboarding + password setup, or a teammate accepts an invite).
  // Verified the same way as the demo cookie — HMAC + embedded expiry.
  let hasAccountSession = false;
  const accountCookie = req.cookies.get(ACCOUNT_COOKIE.name)?.value;
  if (accountCookie) {
    const verified = await readSignedAccountSession(accountCookie);
    hasAccountSession = verified !== null;
  }
  const hasSession = hasRealSession || hasDemoSession || hasAccountSession;

  if (!hasSession && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    // Only round-trip relative paths through `from`. An absolute URL or
    // a scheme-relative path here would let a phishing site craft a
    // sign-in link that redirects to an attacker-controlled host after
    // login. We re-validate at the form layer too.
    const safeFrom =
      pathname.startsWith('/') && !pathname.startsWith('//') ? pathname + search : '/';
    url.search = `?from=${encodeURIComponent(safeFrom)}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Mint a CSRF token cookie if missing. We do this on every GET
  // (public OR authenticated) so the cookie is already present when
  // the React tree renders a form. State-changing routes — including
  // the unauthenticated sign-in POST — verify the echoed
  // X-CSRF-Token header against this cookie.
  //
  // Skip non-GET/HEAD methods and internal Next prefetch requests so
  // the cookie isn't churned on every navigation. Skip /api/ routes
  // too because their responses are JSON; the cookie is meant to ride
  // along with HTML page loads.
  const isReadMethod = req.method === 'GET' || req.method === 'HEAD';
  const isApi = pathname.startsWith('/api/');
  const hasCsrfCookie = Boolean(req.cookies.get(CSRF_CONSTANTS.cookieName)?.value);
  if (isReadMethod && !isApi && !hasCsrfCookie) {
    setCsrfCookie(res, mintCsrfToken());
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
