/**
 * Canonical taxonomy — single source of truth for brand codes, niches,
 * and lifecycle status enums shared across DB, API, jobs, and UI.
 *
 * Use these enums everywhere. The legacy `BrandCode` union and the
 * `BRANDS` Record in `./brands.ts` are retained for backward compat
 * (presentation metadata) but are NOT the canonical lifecycle/status
 * source. Builders Q + R will migrate remaining consumers off the
 * scattered duplicates in `apps/partner-portal/lib/master-data.ts`.
 *
 * Naming choices that resolve the audit:
 *  - Brand slugs are lowercase (`medpay`). DB rows, URLs, API contracts.
 *  - Display labels (`MedPay`) live in `BRAND_LABEL` — never inferred.
 *  - `direct` is a routing-only target, NOT a consumer-facing brand.
 *    It's in `RoutingTarget` but excluded from `BRANDS` so dropdowns
 *    and pills don't render it.
 *  - Partner status canonical = `active | pending | suspended | archived`.
 *    Legacy fixture value `'approved'` maps to `'active'`.
 *  - Lender status canonical = `live | pending_integration | paused | archived`.
 *    Legacy UI value `'disabled'` maps to `'paused'`.
 */

// ─── Brands ────────────────────────────────────────────────────────────────

/** Lowercase brand slug — used in DB, URLs, API contracts.
 *  NOTE: named `BRAND_CODES` (not `BRANDS`) because `./brands.ts`
 *  already exports a `BRANDS` Record with presentation metadata that
 *  has many existing consumers. Once Builder Q + R complete migration,
 *  the old record will be renamed to `BRAND_SPECS` and this tuple can
 *  reclaim the `BRANDS` name. */
export const BRAND_CODES = ['medpay', 'tradepay', 'coachpay'] as const;
export type Brand = (typeof BRAND_CODES)[number];

/** Display labels for UI surfaces. Pascal-cased per marketing voice.
 *  `direct` is intentionally excluded — it has no consumer-facing pill. */
export const BRAND_LABEL: Record<Brand, string> = {
  medpay: 'MedPay',
  tradepay: 'TradePay',
  coachpay: 'CoachPay',
} as const;

/** Routing-only target. Use when a partner bypasses brand chrome.
 *  Kept separate from `Brand` so consumer-facing selectors don't show it. */
export type RoutingTarget = Brand | 'direct';

// ─── Niches ────────────────────────────────────────────────────────────────

/** Niche sub-categorization within each brand. */
export const NICHES_BY_BRAND = {
  medpay: ['medical', 'dental', 'wellness', 'veterinary'],
  tradepay: ['hvac', 'plumbing', 'electrical', 'roofing', 'solar', 'general'],
  coachpay: ['life', 'career', 'fitness', 'business'],
} as const;

export type MedpayNiche = (typeof NICHES_BY_BRAND)['medpay'][number];
export type TradepayNiche = (typeof NICHES_BY_BRAND)['tradepay'][number];
export type CoachpayNiche = (typeof NICHES_BY_BRAND)['coachpay'][number];
export type Niche = MedpayNiche | TradepayNiche | CoachpayNiche;

export const NICHE_LABEL: Record<Niche, string> = {
  medical: 'Medical',
  dental: 'Dental',
  wellness: 'Wellness',
  veterinary: 'Veterinary',
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  roofing: 'Roofing',
  solar: 'Solar',
  general: 'General trades',
  life: 'Life coaching',
  career: 'Career coaching',
  fitness: 'Fitness coaching',
  business: 'Business coaching',
} as const;

const NICHE_TO_BRAND: Record<Niche, Brand> = (() => {
  const out = {} as Record<Niche, Brand>;
  for (const brand of BRAND_CODES) {
    for (const niche of NICHES_BY_BRAND[brand]) {
      (out as Record<string, Brand>)[niche] = brand;
    }
  }
  return out;
})();

export function brandForNiche(niche: Niche): Brand {
  return NICHE_TO_BRAND[niche];
}

export function nichesForBrand(brand: Brand): readonly Niche[] {
  return NICHES_BY_BRAND[brand] as readonly Niche[];
}

const ALL_NICHES: ReadonlySet<string> = new Set(Object.keys(NICHE_LABEL));

export function isNiche(s: string): s is Niche {
  return ALL_NICHES.has(s);
}

export function isBrand(s: string): s is Brand {
  return (BRAND_CODES as readonly string[]).includes(s);
}

// ─── Application lifecycle ─────────────────────────────────────────────────

/** Mirrors the `application_status` pgEnum in
 *  `libs/db/schema.ts` (lines 40-46). Keep in lockstep. */
export const APPLICATION_STATUSES = [
  'submitted',
  'in_review',
  'approved',
  'funded',
  'declined',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  approved: 'Approved',
  funded: 'Funded',
  declined: 'Declined',
} as const;

// ─── Partner lifecycle ─────────────────────────────────────────────────────

/** Resolves the three-way drift between DB (`'active'` default in
 *  `schema.ts:74`), fixture (`'approved'` in master-data.ts:16), and UI
 *  ("Approved" in control-panel/page.tsx:60). Canonical = DB value.
 *  Migration map (Builder Q): `'approved'` → `'active'`. */
export const PARTNER_STATUSES = ['active', 'pending', 'suspended', 'archived'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
  archived: 'Archived',
} as const;

/** Map legacy partner-status synonyms to canonical. Builder Q uses this
 *  when migrating the master-data fixture + control-panel UI. */
export function normalizePartnerStatus(s: string): PartnerStatus | undefined {
  const lower = s.toLowerCase();
  if (lower === 'approved') return 'active';
  if ((PARTNER_STATUSES as readonly string[]).includes(lower)) return lower as PartnerStatus;
  return undefined;
}

// ─── Lender lifecycle ──────────────────────────────────────────────────────

/** `schema.ts:279` stores this as `text` (not a pgEnum) — comment
 *  enumerates the values but the UI in `lender-marketplace/page.tsx:360`
 *  uses an extra `'disabled'` value. Canonical collapses
 *  `'disabled'` → `'paused'`. */
export const LENDER_STATUSES = ['live', 'pending_integration', 'paused', 'archived'] as const;
export type LenderStatus = (typeof LENDER_STATUSES)[number];

export const LENDER_STATUS_LABEL: Record<LenderStatus, string> = {
  live: 'Live',
  pending_integration: 'Pending integration',
  paused: 'Paused',
  archived: 'Archived',
} as const;

export function normalizeLenderStatus(s: string): LenderStatus | undefined {
  const lower = s.toLowerCase();
  if (lower === 'disabled') return 'paused';
  if ((LENDER_STATUSES as readonly string[]).includes(lower)) return lower as LenderStatus;
  return undefined;
}

// ─── MID provisioning ──────────────────────────────────────────────────────

export const MID_STATUSES = [
  'requested',
  'underwriting_pre',
  'underwriting_post',
  'active',
  'rejected',
  'paused',
] as const;
export type MidStatus = (typeof MID_STATUSES)[number];

export const MID_STATUS_LABEL: Record<MidStatus, string> = {
  requested: 'Requested',
  underwriting_pre: 'Underwriting (pre)',
  underwriting_post: 'Underwriting (post)',
  active: 'Active',
  rejected: 'Rejected',
  paused: 'Paused',
} as const;

// ─── Webhook inbox ─────────────────────────────────────────────────────────

export const WEBHOOK_STATUSES = ['pending', 'processing', 'done', 'failed'] as const;
export type WebhookStatus = (typeof WEBHOOK_STATUSES)[number];

export const WEBHOOK_STATUS_LABEL: Record<WebhookStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  done: 'Done',
  failed: 'Failed',
} as const;
