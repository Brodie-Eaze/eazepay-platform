/**
 * Invoicing model — fee schedule, per-merchant override store, and
 * invoice math.
 *
 * EazePay invoices merchants a platform fee on funded volume. The
 * default fee % is set by the merchant's vertical:
 *
 *   MedPay   3.5%   medical / dental / vet / fertility / med-spa
 *   TradePay 5.0%   home-improvement / HVAC / roofing / solar
 *   CoachPay 6.0%   coaching / certifications / courses
 *   Multi    4.5%   blended for partners on >1 brand
 *
 * Per-merchant overrides take precedence — the accounts team can set
 * a custom rate per business from the Invoices page. Overrides live
 * in localStorage so the demo persists across page refreshes; in
 * production they'll round-trip through `/api/billing/fee-overrides`.
 *
 * Math:
 *   fee_amount_cents = round(funded_volume_cents * fee_pct)
 *
 * Numbers are kept in cents (BigInt-safe) so a long-tail of fractional
 * cents accumulate exactly the way the FinOps team expects (see
 * ADR-0012 on the money type).
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

/** Fee % keyed by canonical vertical / product label. */
export const VERTICAL_FEE_PCT = {
  medpay: 0.035,
  tradepay: 0.05,
  coachpay: 0.06,
  multi: 0.045,
} as const;

/** Map a partner.product label to a vertical key. Anything unknown
 *  falls back to the multi-brand rate. */
function productToVertical(product: string): keyof typeof VERTICAL_FEE_PCT {
  const p = product.toLowerCase().replace(/\s+/g, '');
  if (p === 'medpay') return 'medpay';
  if (p === 'tradepay') return 'tradepay';
  if (p === 'coachpay') return 'coachpay';
  return 'multi';
}

/* ──────────────────────────────────────────────────────────────────
 *  Per-merchant fee override store
 * ──────────────────────────────────────────────────────────────────
 *  Keyed by partnerId → custom fee % (decimal, e.g. 0.04 = 4%).
 *  Reads/writes localStorage. SSR-safe (returns empty map on server).
 *  The accounts team can override a single merchant's rate without
 *  touching the vertical-level defaults.
 */

const FEE_OVERRIDE_STORAGE_KEY = 'eazepay_fee_overrides_v1';

export function readFeeOverrides(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FEE_OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    // Defensive: only allow keys → finite numbers between 0 and 0.5
    // (50%). Anything else gets dropped — keeps a malformed payload
    // from corrupting the invoice math.
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 0.5) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function setFeeOverride(partnerId: string, feePct: number | null): void {
  if (typeof window === 'undefined') return;
  if (!partnerId) return;
  const next = readFeeOverrides();
  if (feePct === null) {
    delete next[partnerId];
  } else if (Number.isFinite(feePct) && feePct >= 0 && feePct <= 0.5) {
    next[partnerId] = feePct;
  } else {
    return;
  }
  try {
    window.localStorage.setItem(FEE_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage full / disabled — accept the in-session change anyway. */
  }
}

/**
 * Resolve the effective fee % for a partner: override > vertical
 * default. Used everywhere we need the rate at render time.
 */
export function effectiveFeePct(partnerId: string, product: string): number {
  const overrides = readFeeOverrides();
  if (partnerId in overrides) return overrides[partnerId]!;
  return VERTICAL_FEE_PCT[productToVertical(product)];
}

/** True when this partner has an explicit override (vs inheriting). */
export function hasFeeOverride(partnerId: string): boolean {
  return partnerId in readFeeOverrides();
}

export interface InvoiceComputeInput {
  partnerId: string;
  product: string;
  /**
   * Net cents funded in the invoicing period. This is the merchant's
   * gross funded volume for the period — the source of the fee.
   */
  fundedNetCents: number;
}

export interface ComputedInvoice {
  partnerId: string;
  grossFundedCents: number;
  feePct: number;
  /** True when this fee came from a per-merchant override; false when
   *  it came from the vertical default. UI uses this to badge the
   *  row. */
  overridden: boolean;
  feeAmountCents: number;
}

export function computeInvoiceForPartner(input: InvoiceComputeInput): ComputedInvoice {
  const overrides = readFeeOverrides();
  const overridden = input.partnerId in overrides;
  const feePct = overridden
    ? overrides[input.partnerId]!
    : VERTICAL_FEE_PCT[productToVertical(input.product)];
  const feeAmountCents = Math.round(input.fundedNetCents * feePct);
  return {
    partnerId: input.partnerId,
    grossFundedCents: input.fundedNetCents,
    feePct,
    overridden,
    feeAmountCents,
  };
}

/* ──────────────────────────────────────────────────────────────────
 *  Per-invoice status + amount override store
 * ──────────────────────────────────────────────────────────────────
 *  Keyed by invoiceNo → { status, customFeeCents }. The accounts
 *  team can flip status (Draft → Sent → Paid → Overdue) and
 *  override the calculated fee amount per invoice for one-off
 *  credits / concessions / clawbacks.
 */

const INVOICE_STORE_KEY = 'eazepay_invoice_overrides_v1';

export interface InvoiceOverride {
  status?: InvoiceStatus;
  customFeeCents?: number;
}

export function readInvoiceOverrides(): Record<string, InvoiceOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(INVOICE_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, InvoiceOverride> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const ov = v as Record<string, unknown>;
      const next: InvoiceOverride = {};
      if (
        typeof ov.status === 'string' &&
        (ov.status === 'draft' ||
          ov.status === 'sent' ||
          ov.status === 'paid' ||
          ov.status === 'overdue')
      ) {
        next.status = ov.status;
      }
      if (typeof ov.customFeeCents === 'number' && Number.isFinite(ov.customFeeCents)) {
        next.customFeeCents = ov.customFeeCents;
      }
      out[k] = next;
    }
    return out;
  } catch {
    return {};
  }
}

export function setInvoiceOverride(invoiceNo: string, patch: Partial<InvoiceOverride>): void {
  if (typeof window === 'undefined' || !invoiceNo) return;
  const next = readInvoiceOverrides();
  next[invoiceNo] = { ...next[invoiceNo], ...patch };
  try {
    window.localStorage.setItem(INVOICE_STORE_KEY, JSON.stringify(next));
  } catch {
    /* swallow */
  }
}
