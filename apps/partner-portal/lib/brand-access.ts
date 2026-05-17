/**
 * SEC-101 — server-side brand ownership resolver.
 *
 * Threat model: the partner portal renders pages under `/v/<brand>/*`.
 * Without server-side enforcement, a MedPay merchant signed in via demo
 * cookie `eazepay_demo=medpay` can type `/v/tradepay/applications` and
 * read TradePay's data — the frontend nav wall-up (PR #34) only hides
 * the link from their sidebar, it doesn't gate the route.
 *
 * This module is the load-bearing enforcement. The `/v/[brand]/layout.tsx`
 * server component calls `resolveBrandAccess(...)` and `notFound()`s
 * any caller whose session doesn't own the brand. Returns a discriminated
 * union so the layout can log the deny-reason without expanding the
 * shape over time.
 *
 * ## Demo cookie policy (strict — this is the active exploit vector)
 *
 *   Cookie value        → Allowed brand slugs
 *   ───────────────────────────────────────────
 *   medpay              → ['medpay']
 *   tradepay            → ['tradepay']
 *   coachpay            → ['coachpay']
 *   all                 → ALL (multi-tenant demo workspace)
 *   master              → ALL (master operator demo)
 *   admin / operator    → ALL (master-OS staff roles — operators have
 *                              legitimate ops need to view brand surfaces)
 *   viewer / investor   → ALL (read-only master-OS staff)
 *
 * Any cookie value not in this table is treated as deny → notFound().
 *
 * ## Real session policy (deferred contract)
 *
 * Real backend sessions (`eazepay_at` cookie set) currently bypass with
 * a structured `console.warn` breadcrumb. The intended end-state is:
 *
 *   1. Backend mints JWTs with a `merchantBrands: BrandSlug[]` claim
 *      (or master_admin role grants all-brand access).
 *   2. This helper decodes the JWT (verified by middleware already)
 *      and checks the brand against the claim.
 *
 * Until that lands, real sessions are advisory-only. The deployed
 * partner-portal demo doesn't issue real sessions, so the exploit path
 * the audit identified (SEC-101) is fully closed today via the demo
 * cookie strict path. The warn breadcrumb is intentional load-failure
 * telemetry so any production rollout of real sessions is visible.
 */

import type { BrandCode } from '@eazepay/shared-types';
import { BRAND_ORDER, BRANDS } from '@eazepay/shared-types';

type DemoPreset =
  | 'admin'
  | 'operator'
  | 'viewer'
  | 'investor'
  | 'tradepay'
  | 'medpay'
  | 'coachpay'
  | 'all'
  | 'master';

const OPERATOR_PRESETS: ReadonlySet<DemoPreset> = new Set([
  'admin',
  'operator',
  'viewer',
  'investor',
  'master',
  'all',
]);

const BRAND_PRESETS: ReadonlySet<DemoPreset> = new Set(['tradepay', 'medpay', 'coachpay']);

const KNOWN_DEMO_PRESETS: ReadonlySet<string> = new Set<string>([
  ...OPERATOR_PRESETS,
  ...BRAND_PRESETS,
]);

export type BrandAccessResult =
  | { allowed: true; via: 'demo_operator' | 'demo_brand_match' | 'real_session_deferred' }
  | {
      allowed: false;
      reason: 'no_session' | 'unknown_brand_slug' | 'demo_preset_unknown' | 'demo_brand_mismatch';
    };

/**
 * Resolve the `brand` URL slug to a canonical BrandCode. Returns null
 * for unknown slugs — the layout 404s those before any cookie check
 * runs, so an attacker can't probe whether `/v/<arbitrary>/x` enforces.
 */
export function brandCodeFromSlug(slug: string): BrandCode | null {
  const brand = BRAND_ORDER.find((code) => BRANDS[code].slug === slug);
  return brand ?? null;
}

/**
 * Server-side authorization check for `/v/<brand>/*` routes. Pure
 * function — caller passes the cookie values it reads via `next/headers`
 * so this module stays trivially testable.
 *
 * @param brandSlug   The URL param. Validated against the known brand
 *                    slugs; unknown slugs deny with `unknown_brand_slug`.
 * @param cookies     Cookie values read by the caller. Missing values
 *                    are treated as undefined.
 */
export function resolveBrandAccess(
  brandSlug: string,
  cookies: {
    eazepay_at?: string;
    eazepay_demo?: string;
  },
): BrandAccessResult {
  // Validate the brand slug first. Any unknown brand 404s before we
  // touch cookies — denies an attacker the ability to probe.
  if (!brandCodeFromSlug(brandSlug)) {
    return { allowed: false, reason: 'unknown_brand_slug' };
  }

  const realToken = cookies.eazepay_at;
  const demoPreset = cookies.eazepay_demo;

  // Real session: contract not yet wired (backend doesn't emit
  // merchantBrands claim today). Allow with a structured breadcrumb
  // so any unintended production rollout is visible in server logs.
  if (realToken) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'brand_access.real_session_deferred',
        msg: 'Real-session brand-ownership check is not yet wired to the backend. Allowing.',
        brand: brandSlug,
        hint: 'Implement /v1/me brand claims and update brand-access.ts before shipping real sessions.',
      }),
    );
    return { allowed: true, via: 'real_session_deferred' };
  }

  if (!demoPreset) {
    return { allowed: false, reason: 'no_session' };
  }

  if (!KNOWN_DEMO_PRESETS.has(demoPreset)) {
    return { allowed: false, reason: 'demo_preset_unknown' };
  }

  if (OPERATOR_PRESETS.has(demoPreset as DemoPreset)) {
    return { allowed: true, via: 'demo_operator' };
  }

  // Brand-based demo preset — must match the requested brand exactly.
  if (BRAND_PRESETS.has(demoPreset as DemoPreset) && demoPreset === brandSlug) {
    return { allowed: true, via: 'demo_brand_match' };
  }

  return { allowed: false, reason: 'demo_brand_mismatch' };
}
