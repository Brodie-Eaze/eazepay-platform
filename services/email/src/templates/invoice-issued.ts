import type { BrandEmailContext } from '../brand-context.js';
import { wrap, paragraph, button, metaRow, esc, type WrappedEmail } from './_layout.js';

/**
 * Monthly billing invoice — issued.
 *
 * Fires on: master operator clicks "Send" on a Monthly Billing row, OR
 * automation runs and dispatches.
 *
 * The email carries the same two links the Send dialog shows in-app:
 *   - confirm/dispute (token-gated public page)
 *   - pay link (optional — only if the merchant configured a payment-link
 *     template in the Automation tab)
 *
 * Branding: the partner signed up under a specific vertical, so the
 * billing for that vertical comes from that vertical — MedPay invoices
 * from `noreply@medpay.eazepay.com`, etc. The BrandEmailContext
 * determines this; the template is brand-agnostic.
 */

export interface InvoiceIssuedEmailVars {
  recipientName: string;
  merchantBusinessName: string;
  invoiceNo: string;
  periodLabel: string;
  /** Cents — formatted for display. */
  grossFundedCents: number;
  feePct: number;
  amountDueCents: number;
  dueDate: string;
  confirmUrl: string;
  payUrl?: string;
}

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

export function renderInvoiceIssuedEmail(
  brand: BrandEmailContext,
  vars: InvoiceIssuedEmailVars,
): { subject: string; email: WrappedEmail } {
  const subject = `${brand.brandName} invoice ${vars.invoiceNo} — ${fmtUsd(vars.amountDueCents)} due ${vars.dueDate}`;

  const payRow = vars.payUrl
    ? button(brand, vars.payUrl, 'Pay now')
    : `<p style="margin:0 0 16px;font-size:12px;color:#6b7280;line-height:1.5;">A pay link isn't configured for this account — confirm the invoice and we'll follow up with payment instructions.</p>`;

  const body =
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;">${fmtUsd(vars.amountDueCents)} due ${vars.dueDate}</h1>` +
    paragraph(
      `Hi ${vars.recipientName} — here's the ${vars.periodLabel} platform-fee invoice for ${vars.merchantBusinessName}. Confirm the line items, then pay (or flag anything that looks off).`,
    ) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 20px;border-collapse:collapse;">` +
    metaRow('Invoice', vars.invoiceNo) +
    metaRow('Period', vars.periodLabel) +
    metaRow('Gross funded', fmtUsd(vars.grossFundedCents)) +
    metaRow('Fee rate', fmtPct(vars.feePct)) +
    `<tr><td colspan="2" style="padding:6px 0;border-top:1px solid #f0f1f5;"></td></tr>` +
    metaRow('Amount due', fmtUsd(vars.amountDueCents)) +
    metaRow('Due date', vars.dueDate) +
    `</table>` +
    button(brand, vars.confirmUrl, 'Confirm or dispute') +
    payRow +
    paragraph(
      `Reply to this email if anything needs reconciling — we'll loop in ${brand.brandName} FinOps.`,
    );

  const plainText =
    `${brand.brandName} invoice ${vars.invoiceNo}\n` +
    `\n` +
    `Hi ${vars.recipientName},\n` +
    `Your ${vars.periodLabel} platform-fee invoice for ${vars.merchantBusinessName} is ready.\n\n` +
    `Invoice:       ${vars.invoiceNo}\n` +
    `Period:        ${vars.periodLabel}\n` +
    `Gross funded:  ${fmtUsd(vars.grossFundedCents)}\n` +
    `Fee rate:      ${fmtPct(vars.feePct)}\n` +
    `Amount due:    ${fmtUsd(vars.amountDueCents)}\n` +
    `Due date:      ${vars.dueDate}\n\n` +
    `Confirm or dispute: ${vars.confirmUrl}\n` +
    (vars.payUrl ? `Pay now: ${vars.payUrl}\n\n` : `\n`) +
    `Reply to this email if anything needs reconciling.\n\n${brand.legalEntity}`;

  return {
    subject,
    email: wrap(brand, {
      preheader: `${fmtUsd(vars.amountDueCents)} due ${vars.dueDate} — confirm or dispute inside.`,
      body,
      plainText,
    }),
  };
}

// Suppress unused-import warning — esc is part of the layout barrel.
void esc;
