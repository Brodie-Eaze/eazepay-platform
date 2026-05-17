/**
 * "Generate from activity" — derives draft invoices for a given
 * period from the underlying activity source.
 *
 * EazePay's activity source is the merchant's funded volume in the
 * period (the analogue of AUREAN OS's `cash_collected` from rep
 * activity logs). Today this comes from `master-data.netCents`
 * apportioned to the active period; tomorrow it'll be a query
 * against the settlements ledger for invoices in [startDate, endDate].
 *
 * Each draft invoice records its `derivedFrom` so the audit log can
 * answer "where did this number come from?".
 */
import { partners as MASTER_PARTNERS } from './master-data';
import {
  computeInvoiceForPartner,
  readInvoiceOverrides,
  setInvoiceOverride,
  appendActivity,
  type InvoiceOverride,
} from './invoicing';
import type { Period } from './billing-period';
import { getBillingConfig } from './billing-config';

export interface GeneratedInvoice {
  invoiceNo: string;
  partnerId: string;
  initials: string;
  merchant: string;
  email: string;
  vertical: string;
  periodId: string;
  periodLabel: string;
  grossFundedCents: number;
  feePct: number;
  feeAmountCents: number;
  dueDate: string;
  status: 'draft' | 'sent';
}

export interface GeneratePreview {
  toCreate: number;
  alreadyExists: number;
  paused: number;
  totalFeeCents: number;
  perMerchant: Array<{
    partnerId: string;
    merchant: string;
    invoiceNo: string;
    grossFundedCents: number;
    feeAmountCents: number;
    alreadyExists: boolean;
    paused: boolean;
  }>;
}

export function invoiceNoFor(periodId: string, partnerId: string): string {
  // Stable, period-scoped, easy to type into search: INV-2026-05-p_atlas.
  return `INV-${periodId}-${partnerId}`;
}

/**
 * Pure preview — no writes. Powers the "Generate from activity"
 * confirmation step so the operator sees what will happen.
 */
export function previewGenerate(period: Period): GeneratePreview {
  const overrides = readInvoiceOverrides();
  const perMerchant: GeneratePreview['perMerchant'] = [];
  let toCreate = 0;
  let alreadyExists = 0;
  let paused = 0;
  let totalFeeCents = 0;
  for (const p of MASTER_PARTNERS) {
    const cfg = getBillingConfig(p.id);
    const invoiceNo = invoiceNoFor(period.id, p.id);
    const existed = invoiceNo in overrides;
    const isPaused = cfg.cycle === 'paused';
    const computed = computeInvoiceForPartner({
      partnerId: p.id,
      product: p.product,
      fundedNetCents: p.netCents,
    });
    if (isPaused) paused++;
    else if (existed) alreadyExists++;
    else {
      toCreate++;
      totalFeeCents += computed.feeAmountCents;
    }
    perMerchant.push({
      partnerId: p.id,
      merchant: p.legalName,
      invoiceNo,
      grossFundedCents: computed.grossFundedCents,
      feeAmountCents: computed.feeAmountCents,
      alreadyExists: existed,
      paused: isPaused,
    });
  }
  return { toCreate, alreadyExists, paused, totalFeeCents, perMerchant };
}

/**
 * Materialise drafts for every partner whose config isn't paused and
 * who doesn't already have an invoice for the period.
 *
 * Returns the created invoice numbers so the UI can flash a count.
 */
export function runGenerate(
  period: Period,
  actor: string,
): { created: string[]; skipped: { paused: number; alreadyExists: number } } {
  const overrides = readInvoiceOverrides();
  const created: string[] = [];
  let paused = 0;
  let alreadyExists = 0;
  for (const p of MASTER_PARTNERS) {
    const cfg = getBillingConfig(p.id);
    if (cfg.cycle === 'paused') {
      paused++;
      continue;
    }
    const invoiceNo = invoiceNoFor(period.id, p.id);
    if (invoiceNo in overrides) {
      alreadyExists++;
      continue;
    }
    const computed = computeInvoiceForPartner({
      partnerId: p.id,
      product: p.product,
      fundedNetCents: p.netCents,
    });
    const willAutoSend = cfg.autoSend;
    const patch: Partial<InvoiceOverride> = {
      status: willAutoSend ? 'sent' : 'draft',
      dueDate: period.dueDate,
      // Don't pin customFeeCents — let the computed fee flow so a fee%
      // change later still updates the invoice amount.
    };
    setInvoiceOverride(invoiceNo, patch);
    appendActivity(invoiceNo, {
      kind: 'status',
      by: actor,
      summary: `Generated from activity for ${period.label} · gross ${(computed.grossFundedCents / 100).toFixed(2)} × ${(computed.feePct * 100).toFixed(2)}% = ${(computed.feeAmountCents / 100).toFixed(2)}`,
    });
    if (willAutoSend) {
      appendActivity(invoiceNo, {
        kind: 'send',
        by: actor,
        summary: 'Auto-sent (config.autoSend=true)',
      });
    }
    created.push(invoiceNo);
  }
  return { created, skipped: { paused, alreadyExists } };
}

/**
 * Hydrate the full row for an invoice (period + partner facts) — the
 * Monthly Billing tab uses this to render rows whose invoiceNo we
 * already know (so we don't have to re-read master-data per row).
 */
export function hydrateInvoice(invoiceNo: string, period: Period): GeneratedInvoice | null {
  // invoiceNo format: INV-<periodId>-<partnerId>
  const partnerId = invoiceNo.replace(`INV-${period.id}-`, '');
  const p = MASTER_PARTNERS.find((x) => x.id === partnerId);
  if (!p) return null;
  const computed = computeInvoiceForPartner({
    partnerId: p.id,
    product: p.product,
    fundedNetCents: p.netCents,
  });
  const ov = readInvoiceOverrides()[invoiceNo];
  const customAmount = typeof ov?.customFeeCents === 'number' ? ov.customFeeCents : null;
  return {
    invoiceNo,
    partnerId: p.id,
    initials: p.initials,
    merchant: p.legalName,
    email: p.email,
    vertical: p.product,
    periodId: period.id,
    periodLabel: period.label,
    grossFundedCents: computed.grossFundedCents,
    feePct: computed.feePct,
    feeAmountCents: customAmount ?? computed.feeAmountCents,
    dueDate: ov?.dueDate ?? period.dueDate,
    status: ov?.status === 'sent' ? 'sent' : 'draft',
  };
}

/**
 * Sum the platform-fee % default for a period across all active
 * (non-paused) partners — used for the header "Due @ X%" label.
 */
export function averageActiveFeePct(): number {
  const partners = MASTER_PARTNERS.filter((p) => getBillingConfig(p.id).cycle !== 'paused');
  if (partners.length === 0) return 0;
  const sum = partners.reduce((s, p) => {
    const c = computeInvoiceForPartner({
      partnerId: p.id,
      product: p.product,
      fundedNetCents: p.netCents,
    });
    return s + c.feePct;
  }, 0);
  return sum / partners.length;
}
