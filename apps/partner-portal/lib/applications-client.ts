/**
 * Client-side application fetchers — partner-portal dashboards.
 *
 * One place to call when a UI surface wants "the applications visible
 * to this caller right now." Internally we try the server API first
 * (Postgres-backed, canonical, real-time-ready) and fall back to the
 * legacy `localStorage` substrate when the API responds with
 * `503 db_unavailable` (which is exactly what `/api/v/<brand>/applications`
 * returns until DATABASE_URL is provisioned).
 *
 * This dual-source layer is intentional — it makes the cutover
 * reversible. Set DATABASE_URL and run migrations, dashboards start
 * showing DB rows. Unset DATABASE_URL, dashboards revert to localStorage
 * with no UI change.
 *
 * Once the API has been verified in production we'll delete the
 * fallback + the localStorage substrate together. Until then this
 * keeps the demo path alive while the migration lands.
 */

import type { Cents } from '@eazepay/shared-types';
import {
  readSubmittedApps,
  readSubmittedAppsForPartner,
  toLegacyRow,
  type LegacyApplicationRow,
  type SubmittedApp,
  type SubmittedAppBrand,
  type SubmittedAppStatus,
} from './submitted-applications';
import type { CreditTier } from './marketplace-data';
import { findPartner } from './master-data';

export type ApiApplicationRow = {
  id: string;
  brand: SubmittedAppBrand;
  partnerId: string;
  consumer: string;
  consumerEmail: string;
  amountCents: Cents;
  tier: string | null;
  selectedLender: string | null;
  status: 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';
  createdAt: string;
};

type ApiResponse = {
  items: ApiApplicationRow[];
  nextCursor: string | null;
};

/** Maps API rows back to the LegacyApplicationRow shape used by the
 *  existing partner + master dashboards. Doing it here means callers
 *  don't have to know whether the data came from API or localStorage. */
function apiRowToLegacy(r: ApiApplicationRow, partnerLegalName: string): LegacyApplicationRow {
  const tierToFico: Record<string, number> = {
    prime_plus: 760,
    prime: 720,
    near_prime: 680,
    sub_prime: 620,
    no_match: 580,
  };
  const brandToProduct: Record<SubmittedAppBrand, LegacyApplicationRow['product']> = {
    medpay: 'med-pay',
    tradepay: 'trade-pay',
    coachpay: 'coach-pay',
  };
  return {
    id: r.id,
    customer: r.consumer,
    customerEmail: r.consumerEmail,
    partner: partnerLegalName,
    product: brandToProduct[r.brand],
    amountCents: r.amountCents,
    fico: r.tier ? (tierToFico[r.tier] ?? 700) : 700,
    lender: r.selectedLender ?? 'Pending lender match',
    status: r.status,
    date: r.createdAt.slice(0, 10),
  };
}

/**
 * Fetch the partner-scoped applications visible to the current
 * session for a given brand. Returns:
 *   { source: 'api', rows }   when the API is reachable + DB ready
 *   { source: 'local', rows } when the API returned 503 db_unavailable
 *                             or any network error — localStorage path
 *
 * The page can ignore `source` and just render `rows`; it's exposed so
 * the dashboards can surface a "demo data" banner during the cutover
 * window if they want to.
 */
export async function fetchApplicationsForPartner(
  brand: SubmittedAppBrand,
  partnerId: string,
): Promise<{ source: 'api' | 'local'; rows: LegacyApplicationRow[] }> {
  if (!partnerId) return { source: 'local', rows: [] };
  const partner = findPartner(partnerId);
  const legalName = partner?.legalName ?? '';

  try {
    const res = await fetch(`/api/v/${brand}/applications?limit=100`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.status === 503) {
      return { source: 'local', rows: localPartnerRows(brand, partnerId, legalName) };
    }
    if (!res.ok) {
      return { source: 'local', rows: localPartnerRows(brand, partnerId, legalName) };
    }
    const body = (await res.json()) as ApiResponse;
    return {
      source: 'api',
      rows: body.items.map((r) => apiRowToLegacy(r, legalName)),
    };
  } catch {
    // Network failure — fall back to localStorage.
    return { source: 'local', rows: localPartnerRows(brand, partnerId, legalName) };
  }
}

function localPartnerRows(
  brand: SubmittedAppBrand,
  partnerId: string,
  legalName: string,
): LegacyApplicationRow[] {
  return readSubmittedAppsForPartner(partnerId)
    .filter((a) => a.brand === brand)
    .map((a) => toLegacyRow(a, legalName));
}

/**
 * Admin / master fetcher — every application across every brand.
 * Falls back to localStorage when the API is unavailable. Only an
 * operator session will get a 200 from the API; non-operators get 403
 * and we fall back to the localStorage admin view for now.
 */
export async function fetchApplicationsForAdmin(opts?: {
  brand?: SubmittedAppBrand;
  status?: 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';
}): Promise<{ source: 'api' | 'local'; rows: LegacyApplicationRow[] }> {
  const params = new URLSearchParams();
  if (opts?.brand) params.set('brand', opts.brand);
  if (opts?.status) params.set('status', opts.status);
  params.set('limit', '100');
  try {
    const res = await fetch(`/api/admin/applications?${params}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.status === 503 || res.status === 403) {
      return { source: 'local', rows: localAdminRows(opts) };
    }
    if (!res.ok) {
      return { source: 'local', rows: localAdminRows(opts) };
    }
    const body = (await res.json()) as ApiResponse;
    return {
      source: 'api',
      rows: body.items.map((r) =>
        apiRowToLegacy(r, findPartner(r.partnerId)?.legalName ?? r.partnerId),
      ),
    };
  } catch {
    return { source: 'local', rows: localAdminRows(opts) };
  }
}

function localAdminRows(opts?: {
  brand?: SubmittedAppBrand;
  status?: 'submitted' | 'in_review' | 'approved' | 'funded' | 'declined';
}): LegacyApplicationRow[] {
  return readSubmittedApps()
    .filter((a) => (opts?.brand ? a.brand === opts.brand : true))
    .filter((a) => (opts?.status ? a.status === opts.status : true))
    .map((a) => toLegacyRow(a, findPartner(a.partnerId)?.legalName ?? a.partnerId));
}

/**
 * Map an API row back into the raw `SubmittedApp` shape used by the
 * master `/applications` page (which aggregates per-partner counts off
 * the `partnerId` field directly). Keeping the helper here means the
 * shape decision lives next to the API contract — if the API later
 * exposes new fields, the mapper is the only thing that has to learn
 * about them.
 *
 * Defaults applied:
 *   • tier: `prime` when the API row carries `null` (no waterfall match
 *     happened yet — the value is purely for FICO display downstream).
 *   • selectedLender: `'Pending lender match'` when the API row carries
 *     `null` — matches the localStorage substrate's behaviour.
 */
function apiRowToSubmittedApp(r: ApiApplicationRow): SubmittedApp {
  const tier: CreditTier =
    r.tier === 'prime_plus' ||
    r.tier === 'prime' ||
    r.tier === 'near_prime' ||
    r.tier === 'sub_prime' ||
    r.tier === 'no_match'
      ? (r.tier as CreditTier)
      : 'prime';
  return {
    id: r.id,
    partnerId: r.partnerId,
    brand: r.brand,
    customer: r.consumer,
    customerEmail: r.consumerEmail,
    amountCents: r.amountCents,
    tier,
    lender: r.selectedLender ?? 'Pending lender match',
    status: r.status as SubmittedAppStatus,
    submittedAt: r.createdAt,
  };
}

/**
 * Admin fetcher in `SubmittedApp[]` shape — what the master
 * `/applications` page expects (it computes per-partner counts off the
 * `partnerId` field directly, so it can't use the LegacyApplicationRow
 * shape which loses partnerId during the legal-name mapping).
 *
 * Same cutover contract as `fetchApplicationsForAdmin`:
 *   • API first; falls back to localStorage on 503 / 403 / network error.
 *   • Returns `{ source, rows }` so the UI can flag demo data if it
 *     wants to.
 *
 * Operator-only path on the server side. Non-operators get a 403 and
 * we fall back to the localStorage admin view, which is fine for the
 * demo cutover window but will eventually be removed.
 */
export async function fetchAdminSubmittedApps(opts?: {
  brand?: SubmittedAppBrand;
  status?: SubmittedAppStatus;
}): Promise<{ source: 'api' | 'local'; rows: SubmittedApp[] }> {
  const params = new URLSearchParams();
  if (opts?.brand) params.set('brand', opts.brand);
  if (opts?.status) params.set('status', opts.status);
  params.set('limit', '100');
  try {
    const res = await fetch(`/api/admin/applications?${params}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (res.status === 503 || res.status === 403) {
      return { source: 'local', rows: localAdminSubmittedApps(opts) };
    }
    if (!res.ok) {
      return { source: 'local', rows: localAdminSubmittedApps(opts) };
    }
    const body = (await res.json()) as ApiResponse;
    return { source: 'api', rows: body.items.map(apiRowToSubmittedApp) };
  } catch {
    return { source: 'local', rows: localAdminSubmittedApps(opts) };
  }
}

function localAdminSubmittedApps(opts?: {
  brand?: SubmittedAppBrand;
  status?: SubmittedAppStatus;
}): SubmittedApp[] {
  return readSubmittedApps()
    .filter((a) => (opts?.brand ? a.brand === opts.brand : true))
    .filter((a) => (opts?.status ? a.status === opts.status : true));
}
