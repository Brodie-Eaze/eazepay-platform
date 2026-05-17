/**
 * SEC-101 — server-side brand ownership resolver.
 *
 * Threat model: the partner portal renders pages under `/v/<brand>/*`.
 * Without server-side enforcement, a MedPay merchant signed in via demo
 * cookie `eazepay_demo=medpay` can type `/v/tradepay/applications` and
 * read TradePay's data — the frontend nav wall-up (PR #34) only hides
 * the link from their sidebar, it doesn't gate the route.
 *
 * This module is the load-bearing policy layer. The `/v/[brand]/layout.tsx`
 * server component verifies the demo cookie signature (via lib/demo-cookie.ts)
 * and passes the resolved preset string into `resolveBrandAccess(...)`.
 * Returns a discriminated union so the layout can log the deny-reason
 * without expanding the shape over time.
 *
 * ## Demo cookie policy (strict — this is the active exploit vector)
 *
 *   Verified preset     → Allowed brand slugs
 *   ───────────────────────────────────────────
 *   medpay              → ['medpay']
 *   tradepay            → ['tradepay']
 *   coachpay            → ['coachpay']
 *   all                 → ALL (multi-tenant demo workspace)
 *   master              → ALL (master operator demo; behind DEMO_MASTER_ENABLED env)
 *   admin / operator    → ALL (master-OS staff roles)
 *   viewer / investor   → ALL (read-only master-OS staff)
 *
 * Any other value is denied. Forged cookies fail verification before
 * they reach this resolver (caller passes `null` for verifiedDemoPreset).
 *
 * ## Real session policy (deferred contract)
 *
 * Real backend sessions (`hasRealSession: true`) currently bypass with
 * a structured `console.warn` breadcrumb. The intended end-state is:
 *
 *   1. Backend mints JWTs with a `merchantBrands: BrandSlug[]` claim
 *      (or master_admin role grants all-brand access).
 *   2. The layout decodes the JWT (verified by middleware already)
 *      and passes `allowedBrands` to a new arg of `resolveBrandAccess`.
 *
 * Until that lands, real sessions are advisory-only. The deployed
 * partner-portal demo doesn't issue real sessions, so the exploit path
 * SEC-101 identified is fully closed today via the demo cookie strict
 * path. The warn breadcrumb is intentional load-failure telemetry so
 * any production rollout of real sessions is visible.
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
  | {
      allowed: true;
      via: 'demo_operator' | 'demo_brand_match' | 'real_session_deferred' | 'account_brand_match';
    }
  | {
      allowed: false;
      reason:
        | 'no_session'
        | 'unknown_brand_slug'
        | 'demo_preset_unknown'
        | 'demo_brand_mismatch'
        | 'account_brand_mismatch';
    };

export interface BrandAccessInputs {
  /** True if a real (non-demo) session is present. The caller has
   *  already verified the JWT (middleware did it) — pass the boolean. */
  hasRealSession: boolean;
  /** The verified demo cookie preset, or null if absent / signature
   *  failed / expired. Caller MUST verify the signed cookie before
   *  passing the preset — this module does not verify HMAC. */
  verifiedDemoPreset: string | null;
  /** The verified account-cookie brand, or null. Caller MUST verify
   *  the HMAC before passing the brand. An account session that owns
   *  brand A cannot view brand B — strict 1:1 match. */
  verifiedAccountBrand: string | null;
}

export function brandCodeFromSlug(slug: string): BrandCode | null {
  const brand = BRAND_ORDER.find((code) => BRANDS[code].slug === slug);
  return brand ?? null;
}

export function resolveBrandAccess(
  brandSlug: string,
  inputs: BrandAccessInputs,
): BrandAccessResult {
  if (!brandCodeFromSlug(brandSlug)) {
    return { allowed: false, reason: 'unknown_brand_slug' };
  }

  // Account-session check first — strongest identity claim. The
  // verified-account-brand carried in the cookie payload MUST match
  // the URL brand slug exactly. Cross-brand attempts (account scoped
  // to medpay hitting /v/tradepay/*) are denied with a distinct
  // reason code so deny logs stay diagnosable.
  if (inputs.verifiedAccountBrand) {
    if (inputs.verifiedAccountBrand === brandSlug) {
      return { allowed: true, via: 'account_brand_match' };
    }
    return { allowed: false, reason: 'account_brand_mismatch' };
  }

  if (inputs.hasRealSession) {
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

  const preset = inputs.verifiedDemoPreset;
  if (!preset) return { allowed: false, reason: 'no_session' };
  if (!KNOWN_DEMO_PRESETS.has(preset)) {
    return { allowed: false, reason: 'demo_preset_unknown' };
  }

  if (OPERATOR_PRESETS.has(preset as DemoPreset)) {
    return { allowed: true, via: 'demo_operator' };
  }

  if (BRAND_PRESETS.has(preset as DemoPreset) && preset === brandSlug) {
    return { allowed: true, via: 'demo_brand_match' };
  }

  return { allowed: false, reason: 'demo_brand_mismatch' };
}
