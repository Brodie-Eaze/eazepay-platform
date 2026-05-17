/**
 * Invoicing model — fee schedule + per-merchant invoice math.
 *
 * EazePay invoices merchants a platform fee on funded volume. The
 * default fee % is set by the merchant's vertical:
 *
 *   MedPay   3.5%   medical / dental / vet / fertility / med-spa
 *   TradePay 5.0%   home-improvement / HVAC / roofing / solar
 *   CoachPay 6.0%   coaching / certifications / courses
 *   Multi    4.5%   blended for partners on >1 brand
 *
 * Per-merchant overrides take precedence (set in /control-panel/<id>'s
 * Billing tab — to be wired in a follow-up PR). For now the page reads
 * straight from these defaults.
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
  feeAmountCents: number;
}

export function computeInvoiceForPartner(input: InvoiceComputeInput): ComputedInvoice {
  const vertical = productToVertical(input.product);
  const feePct = VERTICAL_FEE_PCT[vertical];
  const feeAmountCents = Math.round(input.fundedNetCents * feePct);
  return {
    partnerId: input.partnerId,
    grossFundedCents: input.fundedNetCents,
    feePct,
    feeAmountCents,
  };
}
