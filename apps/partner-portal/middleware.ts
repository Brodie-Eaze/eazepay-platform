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

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const hasSession =
    Boolean(req.cookies.get('eazepay_at')?.value) ||
    Boolean(req.cookies.get('eazepay_demo')?.value);

  if (!hasSession && !isPublic(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?from=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
