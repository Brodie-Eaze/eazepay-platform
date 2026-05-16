/**
 * Submitted-application store. Mock-grade, localStorage-backed.
 *
 * What this powers
 * ----------------
 * When a consumer completes the /apply/<brand> flow under a partner's
 * referral link (`?ref=p_helio`), we record the application here.
 * Two surfaces then read from this store and merge with the seed
 * fixture in `master-data.ts`:
 *
 *   • Admin / Master  →  /applications        (sees every app)
 *   • Per-partner     →  /v/<brand>/applications  (sees ONLY their own)
 *
 * PII isolation discipline
 * ------------------------
 * This module is the only place in the client codebase that should
 * read submitted-app data. Every consumer goes through ONE of two
 * exported readers:
 *
 *   readSubmittedApps()                      → admin / master view
 *   readSubmittedAppsForPartner(partnerId)   → partner-scoped view
 *
 * The per-partner reader is hardened with a non-empty partnerId check
 * — passing an empty string returns `[]` instead of leaking the full
 * store. The store itself is keyed per application with the partner
 * attribution stamped at write time and never mutated.
 *
 * IMPORTANT: this is mock-grade. In production a real BFF endpoint
 * (`/api/applications?partnerId=…`) must enforce isolation on the
 * server, checking the session cookie's bound merchantId before
 * returning rows. The localStorage substrate here is operator-visible
 * (anyone with devtools on the consumer flow can read it), so it
 * carries demo-only seed data and synthetic PII — never real consumer
 * PII. See ADR-0016 (PII vault) + ADR-0017 (JIT unmask) for the
 * production architecture.
 */

import type { CreditTier } from './marketplace-data';

const STORAGE_KEY = 'eazepay_submitted_apps_v1';

export type SubmittedAppBrand = 'medpay' | 'tradepay' | 'coachpay';
export type SubmittedAppStatus = 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';

export interface SubmittedApp {
  /** Stable identifier minted at write time. */
  id: string;
  /**
   * Canonical partner id (eg. `p_helio`). Set from the `?ref=` query
   * param on the apply page, or the demo brand's implicit partner
   * binding (see DEMO_PARTNER_BY_BRAND below) if no ref is present.
   */
  partnerId: string;
  brand: SubmittedAppBrand;
  /** Display name composed at write time — first + last. */
  customer: string;
  customerEmail: string;
  amountCents: number;
  tier: CreditTier;
  lender: string;
  status: SubmittedAppStatus;
  /** ISO timestamp at write. */
  submittedAt: string;
}

/**
 * Demo brand → canonical partner id binding. Used by the per-brand
 * portal to determine "which apps are mine" when the operator is in a
 * demo session (no explicit partner identity).
 *
 * MedPay → Helio Dental Group
 * TradePay → Orion Roof & Solar
 * CoachPay → Atlas Executive Coaching
 */
export const DEMO_PARTNER_BY_BRAND: Record<SubmittedAppBrand, string> = {
  medpay: 'p_helio',
  tradepay: 'p_orion',
  coachpay: 'p_atlas',
};

/** Narrow runtime check used when parsing the localStorage payload. */
function isValidApp(x: unknown): x is SubmittedApp {
  if (!x || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.partnerId === 'string' &&
    typeof a.brand === 'string' &&
    typeof a.customer === 'string' &&
    typeof a.customerEmail === 'string' &&
    typeof a.amountCents === 'number' &&
    typeof a.tier === 'string' &&
    typeof a.lender === 'string' &&
    typeof a.status === 'string' &&
    typeof a.submittedAt === 'string'
  );
}

/**
 * Read every submitted application across every partner.
 *
 * ONLY callable from admin-flavour surfaces (the master `/applications`
 * page). Callers are required to be inside an admin-scoped route — the
 * platform middleware guards `/applications` behind the admin role.
 *
 * SSR-safe: returns `[]` when `window` is undefined.
 */
export function readSubmittedApps(): SubmittedApp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidApp);
  } catch {
    return [];
  }
}

/**
 * Read submitted applications scoped to a single partner. Hardened:
 *
 *   • An empty / missing partnerId returns `[]` (never the full store).
 *   • The filter compares strict equality on `partnerId` — there is no
 *     substring / case-folding match.
 *   • Apps stamped with a different partnerId are dropped before the
 *     consumer sees them.
 *
 * This is the ONLY reader the per-partner portal should use. The
 * `partnerId` argument must come from the session, not from the URL or
 * any user-supplied input.
 */
export function readSubmittedAppsForPartner(partnerId: string): SubmittedApp[] {
  if (!partnerId || typeof partnerId !== 'string') return [];
  return readSubmittedApps().filter((a) => a.partnerId === partnerId);
}

/**
 * Persist a new application. Mints the id + timestamp.
 *
 * Returns the persisted row. No-op when called server-side (the row
 * is still returned so the caller can render it immediately, but
 * nothing is written to storage).
 */
export function saveSubmittedApp(
  input: Omit<SubmittedApp, 'id' | 'submittedAt' | 'status'> &
    Partial<Pick<SubmittedApp, 'status'>>,
): SubmittedApp {
  const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const submittedAt = new Date().toISOString();
  const row: SubmittedApp = {
    id,
    submittedAt,
    status: input.status ?? 'submitted',
    partnerId: input.partnerId,
    brand: input.brand,
    customer: input.customer,
    customerEmail: input.customerEmail,
    amountCents: input.amountCents,
    tier: input.tier,
    lender: input.lender,
  };
  if (typeof window === 'undefined') return row;
  try {
    const existing = readSubmittedApps();
    existing.push(row);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    /* localStorage may be full or disabled (private browsing) — the row
       is still useful to the caller's in-memory rendering even if it
       didn't persist. Swallow + continue. */
  }
  return row;
}

/**
 * Resolve the canonical partner id for the current demo session. Reads
 * the `eazepay_demo` cookie client-side; returns `null` when running
 * server-side, when the cookie isn't a known brand, or when no demo
 * cookie is set (real-session partner identity will be wired here once
 * the BFF exposes `/api/me`).
 */
export function readCurrentPartnerIdFromDemoCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)eazepay_demo=([^;]+)/);
  if (!match) return null;
  const brand = decodeURIComponent(match[1] ?? '');
  if (brand === 'medpay' || brand === 'tradepay' || brand === 'coachpay') {
    return DEMO_PARTNER_BY_BRAND[brand];
  }
  return null;
}

/**
 * Convert a submitted app into the legacy `ApplicationRow` shape used
 * by the admin /applications + per-partner /v/[brand]/applications
 * tables. Centralised so the two callers stay in lockstep.
 */
export interface LegacyApplicationRow {
  id: string;
  customer: string;
  customerEmail: string;
  partner: string;
  product: 'med-pay' | 'trade-pay' | 'coach-pay';
  amountCents: number;
  fico: number;
  lender: string;
  status: 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';
  date: string;
}

const TIER_TO_FICO: Record<CreditTier, number> = {
  prime_plus: 760,
  prime: 720,
  near_prime: 680,
  sub_prime: 620,
  no_match: 580,
};

const BRAND_TO_PRODUCT: Record<SubmittedAppBrand, LegacyApplicationRow['product']> = {
  medpay: 'med-pay',
  tradepay: 'trade-pay',
  coachpay: 'coach-pay',
};

export function toLegacyRow(a: SubmittedApp, partnerLegalName: string): LegacyApplicationRow {
  return {
    id: a.id,
    customer: a.customer,
    customerEmail: a.customerEmail,
    partner: partnerLegalName,
    product: BRAND_TO_PRODUCT[a.brand],
    amountCents: a.amountCents,
    fico: TIER_TO_FICO[a.tier],
    lender: a.lender,
    status: a.status,
    date: a.submittedAt.slice(0, 10),
  };
}
