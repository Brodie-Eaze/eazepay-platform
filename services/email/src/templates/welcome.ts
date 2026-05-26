import type { BrandEmailContext } from '../brand-context.js';
import { wrap, paragraph, button, type WrappedEmail } from './_layout.js';

/**
 * Welcome / portal-access email.
 *
 * Fires on: successful merchant signup (apps/api after KYB passes), or
 * the operator-side "Approve partner" action from the master command
 * centre. Carries a one-click sign-in link valid for 24h — recipient
 * sets their password from there.
 */

export interface WelcomeEmailVars {
  recipientName: string;
  /** Where the password-setup link lives. Must be brand-scoped:
   *  `/v/<brand>/welcome?token=<setup-token>`. */
  portalUrl: string;
  /** Friendly merchant business name to address in the body. */
  merchantBusinessName: string;
}

export function renderWelcomeEmail(
  brand: BrandEmailContext,
  vars: WelcomeEmailVars,
): { subject: string; email: WrappedEmail } {
  const subject = `${vars.merchantBusinessName} is live on ${brand.brandName} — finish setup`;

  const body =
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;">You're in, ${esc(vars.recipientName)}.</h1>` +
    paragraph(
      `${vars.merchantBusinessName} is approved on ${brand.brandName}. One step left — set your password and you can send your first application today.`,
    ) +
    button(brand, vars.portalUrl, `Set my password`) +
    paragraph(
      `This link works for the next 24 hours. Didn't request access? Ignore this email — the account stays locked until you finish setup.`,
    );

  const plainText =
    `You're in, ${vars.recipientName}.\n\n` +
    `${vars.merchantBusinessName} is approved on ${brand.brandName}. Set your password to start:\n${vars.portalUrl}\n\n` +
    `This link works for the next 24 hours.\n\n${brand.legalEntity}`;

  return { subject, email: wrap(brand, { preheader: subject, body, plainText }) };
}

function esc(s: string): string {
  // Local copy of the layout's esc() — kept private to template module
  // so callers can't accidentally double-escape.
  return s.replace(/[&<>"']/g, (c) => {
    const m: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return m[c] ?? c;
  });
}
