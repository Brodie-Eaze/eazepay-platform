import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two jobs at the edge, before any route handler or React Server
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
 */

const PUBLIC_PATHS: ReadonlyArray<string> = [
  '/sign-in',
  '/welcome',
  '/onboarding',
  '/forgot-password',
  '/create-account',
  '/help',
  '/apply', // consumer apply landing — external customers
  '/lenders', // public lender developer hub — prospective lenders preview the marketplace + endpoints
  '/docs', // public lender integration docs
  '/landing', // public per-vertical marketing landing pages (MedPay / TradePay / CoachPay)
];

const isPublic = (pathname: string): boolean => {
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico' || pathname === '/robots.txt') return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
};

/**
 * In production, an `eazepay_demo` cookie is only accepted if the
 * deployment explicitly enabled demo mode (`DEMO_MODE_ENABLED=true`).
 * Otherwise an attacker who knows the cookie name could mint themselves
 * a "demo" session by setting it client-side. Dev + preview always
 * accept demo cookies to keep iteration fast.
 *
 * The cookie SETTER in /app/api/auth/demo/route.ts also enforces this —
 * this middleware check is defence-in-depth in case an old cookie
 * survives a production cutover, or someone forges one.
 */
function demoCookieTrusted(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.DEMO_MODE_ENABLED === 'true';
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const hasRealSession = Boolean(req.cookies.get('eazepay_at')?.value);
  const hasDemoSession =
    Boolean(req.cookies.get('eazepay_demo')?.value) && demoCookieTrusted();
  const hasSession = hasRealSession || hasDemoSession;

  if (!hasSession && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    // Only round-trip relative paths through `from`. An absolute URL or
    // a scheme-relative path here would let a phishing site craft a
    // sign-in link that redirects to an attacker-controlled host after
    // login. We re-validate at the form layer too.
    const safeFrom =
      pathname.startsWith('/') && !pathname.startsWith('//')
        ? pathname + search
        : '/';
    url.search = `?from=${encodeURIComponent(safeFrom)}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
