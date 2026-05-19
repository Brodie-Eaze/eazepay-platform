/**
 * Server-side session helper for BFF route handlers.
 *
 * Centralises "who is this caller and what can they touch" so individual
 * routes don't re-implement the cookie-read + signature-verify dance.
 * Pairs with `lib/brand-access.ts` (page routes via `next/headers`);
 * this module is for `NextRequest`-flavoured API handlers.
 *
 * Threat model: SEC-102 (audit). Pre-fix, `/api/v/<brand>/consumer-invites`
 * accepted `partnerId` from the request body with zero session check.
 * SEC-103/109 hardening (signed demo cookies) flows through here too —
 * `getSessionContext` returns mode:'none' if the cookie's HMAC fails
 * verification, so a forged cookie can't escalate.
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
 *   no session (or forged/expired demo cookie)
 *     → returns `{ mode: 'none' }`. Caller must reject with 401.
 */

import type { NextRequest } from 'next/server';
import type { BrandCode } from '@eazepay/shared-types';
import { partners as MASTER_PARTNERS, type PartnerSummary } from './master-data';
import { readSignedDemoPreset } from './demo-cookie';
import { readSignedAccountSession, ACCOUNT_COOKIE } from './account-cookie';

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
      /** Brand the session is scoped to, or null for operator presets. */
      brand: BrandCode | null;
    }
  | {
      /** Account-cookie session: a real business or teammate signed in
       *  with a password after completing onboarding / invite-accept.
       *  Scoped to exactly one brand + one partnerId — never operator. */
      mode: 'account';
      userId: string;
      brand: 'medpay' | 'tradepay' | 'coachpay';
      partnerId: string;
    }
  | {
      mode: 'real';
      /** TODO(SEC-101 follow-up): populate from /v1/me when wired. */
      placeholder: true;
    }
  | { mode: 'none' };

/**
 * Resolve the session for a given BFF request. Verifies the demo cookie
 * signature before trusting its value (SEC-103). Async because HMAC
 * verification uses Web Crypto subtle.
 */
export async function getSessionContext(req: NextRequest): Promise<SessionContext> {
  // Real account-session cookie has top priority: it's the strongest
  // identity claim (HMAC-signed, embedded expiry, userId + partnerId).
  const accountCookie = req.cookies.get(ACCOUNT_COOKIE.name)?.value;
  if (accountCookie) {
    const verifiedAccount = await readSignedAccountSession(accountCookie);
    if (verifiedAccount) {
      return {
        mode: 'account',
        userId: verifiedAccount.userId,
        brand: verifiedAccount.brand,
        partnerId: verifiedAccount.partnerId,
      };
    }
  }

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

  const signed = req.cookies.get('eazepay_demo')?.value;
  const verified = await readSignedDemoPreset(signed);
  if (!verified) return { mode: 'none' };
  if (!KNOWN_DEMO_PRESETS.has(verified.preset)) return { mode: 'none' };

  const typed = verified.preset as DemoPreset;
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

export function allowedPartnerIdsForBrand(
  session: SessionContext,
  brand: Exclude<BrandCode, 'direct'>,
): string[] {
  if (session.mode === 'none') return [];
  if (session.mode === 'real') {
    /* SEC-101: until the BFF `/v1/me` returns `{ merchantId, brand }`
     * claims, we have no trustworthy way to scope a real bearer-token
     * session to one partner. Previously this branch returned the full
     * partner list for the brand, which is a cross-tenant leak the
     * moment a second real partner signs in. FAIL CLOSED instead — every
     * brand-scoped read resolves to "no partners visible" until the BFF
     * is wired and `session.mode === 'real'` carries `merchantId`.
     * Operators who need to demo the platform should use the signed
     * demo cookie presets (HMAC-verified via `readSignedDemoPreset`).
     */
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'session.real_locked_closed',
        msg: 'Real session present but BFF /v1/me does not yet return brand+merchantId claims; refusing to expand visibility.',
        brand,
      }),
    );
    return [];
  }
  if (session.mode === 'account') {
    // Account sessions are strictly single-partner. Cross-brand
    // requests return empty — no leakage from a teammate's Helio
    // account into Orion or Atlas data.
    return session.brand === brand ? [session.partnerId] : [];
  }
  if (session.isOperator) return partnersForBrand(brand).map((p) => p.id);
  if (session.brand === brand) return partnersForBrand(brand).map((p) => p.id);
  return [];
}

function partnersForBrand(brand: Exclude<BrandCode, 'direct'>): PartnerSummary[] {
  const label = BRAND_TO_PRODUCT_LABEL[brand];
  return MASTER_PARTNERS.filter((p) => p.product === label || p.product === 'Multi-brand');
}

/**
 * Tiny helper for routes that just want to gate "any session at all".
 * Returns null if a session is present; a 401 Problem-Details Response
 * if not. Caller short-circuits:
 *
 *   const fail = await requireSession(req);
 *   if (fail) return fail;
 */
export async function requireSession(req: NextRequest): Promise<Response | null> {
  const ctx = await getSessionContext(req);
  if (ctx.mode === 'none') {
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
