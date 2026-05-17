/**
 * Server-side session helper for BFF route handlers.
 *
 * Centralises "who is this caller and what can they touch" so individual
 * routes don't re-implement the cookie-read + scope-derivation dance.
 * Pairs with `lib/brand-access.ts` (which does the same thing for page
 * routes via `next/headers`); this module is for `NextRequest`-flavoured
 * API handlers.
 *
 * Threat model: SEC-102 (audit). Pre-fix, `/api/v/<brand>/consumer-invites`
 * accepted `partnerId` from the request body with zero session check,
 * so a salesperson email lookup leaked another partner's pipeline. Any
 * BFF that reads or writes partner-scoped data MUST resolve the caller
 * through this helper and constrain partnerIds to `session.allowedPartnerIds`.
 *
 * ## Session modes
 *
 *   demo + operator preset (master/all/admin/operator/viewer/investor)
 *     → can act on any partner, any brand. Mirrors the master OS surface.
 *
 *   demo + brand preset (medpay/tradepay/coachpay)
 *     → can only act on partners whose roster brand matches the preset.
 *
 *   real session (eazepay_at cookie present)
 *     → deferred contract. Treated as operator-scoped with a structured
 *       breadcrumb until the backend emits merchantId/brand claims.
 *
 *   no session
 *     → returns `{ mode: 'none' }`. Caller must reject with 401.
 */

import type { NextRequest } from 'next/server';
import type { BrandCode } from '@eazepay/shared-types';
import { partners as MASTER_PARTNERS, type PartnerSummary } from './master-data';

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

/** Map the BrandCode → the literal partner.product label used in the roster. */
const BRAND_TO_PRODUCT_LABEL: Record<Exclude<BrandCode, 'direct'>, PartnerSummary['product']> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
};

export type SessionContext =
  | {
      mode: 'demo';
      preset: DemoPreset;
      isOperator: boolean;
      /** Brand the session is scoped to, or null for operator/all-brand presets. */
      brand: BrandCode | null;
    }
  | {
      mode: 'real';
      /** TODO(SEC-101 follow-up): populate from /v1/me when wired. */
      placeholder: true;
    }
  | { mode: 'none' };

export function getSessionContext(req: NextRequest): SessionContext {
  const at = req.cookies.get('eazepay_at')?.value;
  if (at) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'session.real_deferred',
        msg: 'Real-session context resolution is not yet wired to /v1/me. Treating as operator.',
        hint: 'Implement /v1/me brand claims + update lib/session.ts before shipping real sessions.',
      }),
    );
    return { mode: 'real', placeholder: true };
  }

  const preset = req.cookies.get('eazepay_demo')?.value;
  if (!preset) return { mode: 'none' };
  if (!KNOWN_DEMO_PRESETS.has(preset)) return { mode: 'none' };

  const typed = preset as DemoPreset;
  if (OPERATOR_PRESETS.has(typed)) {
    return { mode: 'demo', preset: typed, isOperator: true, brand: null };
  }

  // Brand preset — the demo presets match BrandCode 1:1.
  return {
    mode: 'demo',
    preset: typed,
    isOperator: false,
    brand: typed as BrandCode,
  };
}

/** Roster of partner IDs the session may act on for the given brand. */
export function allowedPartnerIdsForBrand(
  session: SessionContext,
  brand: Exclude<BrandCode, 'direct'>,
): string[] {
  if (session.mode === 'none') return [];
  if (session.mode === 'real') {
    // Treat as operator until the backend lands. Same caveat as
    // `getSessionContext` — breadcrumb-only enforcement.
    return partnersForBrand(brand).map((p) => p.id);
  }
  // Demo: operators see all; brand-scoped see only their brand.
  if (session.isOperator) return partnersForBrand(brand).map((p) => p.id);
  if (session.brand === brand) return partnersForBrand(brand).map((p) => p.id);
  return [];
}

/** Partners whose product matches the brand (plus Multi-brand). */
function partnersForBrand(brand: Exclude<BrandCode, 'direct'>): PartnerSummary[] {
  const label = BRAND_TO_PRODUCT_LABEL[brand];
  return MASTER_PARTNERS.filter((p) => p.product === label || p.product === 'Multi-brand');
}

/**
 * Tiny helper for routes that just want to gate "any session at all"
 * without caring about partner scoping. Returns null if a session is
 * present; a 401 Problem-Details Response if not. Caller short-circuits:
 *
 *   const fail = requireSession(req);
 *   if (fail) return fail;
 */
export function requireSession(req: NextRequest): Response | null {
  if (getSessionContext(req).mode === 'none') {
    return new Response(
      JSON.stringify({
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        code: 'not_signed_in',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return null;
}
