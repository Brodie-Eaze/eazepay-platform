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
  const subject = `Welcome to ${brand.brandName} — set up your portal`;

  const body =
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;">Welcome, ${esc(vars.recipientName)}.</h1>` +
    paragraph(
      `${vars.merchantBusinessName} has been approved on ${brand.brandName}. Your portal is ready — pick a password, add your team, and start sending your first applications.`,
    ) +
    button(brand, vars.portalUrl, `Set up ${brand.brandName} portal`) +
    paragraph(
      `The link expires in 24 hours. If you didn't expect this, please ignore — your account stays locked until you complete setup.`,
    );

  const plainText =
    `Welcome to ${brand.brandName}, ${vars.recipientName}.\n\n` +
    `${vars.merchantBusinessName} has been approved. Set up your portal:\n${vars.portalUrl}\n\n` +
    `The link expires in 24 hours.\n\n${brand.legalEntity}`;

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
