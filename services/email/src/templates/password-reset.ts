import type { BrandEmailContext } from '../brand-context.js';
import { wrap, paragraph, button, monoBlock, esc, type WrappedEmail } from './_layout.js';

/**
 * Password reset email.
 *
 * Fires on: POST /v1/auth/forgot-password. Carries a single-use, 30-min
 * reset link AND the 6-digit OTP that pairs with it so the receiver can
 * complete the flow from either device (the link includes the OTP as
 * a query param for one-tap reset; mobile-mail-app users who get
 * redirected to an in-app browser can fall back to typing the code).
 *
 * Security notes (SEC-110 follow-up):
 *   - The reset URL is brand-scoped (`/v/<brand>/auth/reset?token=...`)
 *     so a stolen link doesn't leak which OS surface the user has.
 *   - The OTP TTL ≤ 1800s (30 min); enforced server-side in
 *     auth.service.ts. Single-use — consumed on first POST.
 *   - Email recipient verification: we don't say "your account exists"
 *     in either the API response or this template — every forgot-password
 *     attempt for an unknown email returns 202 + does nothing, to
 *     prevent enumeration.
 */

export interface PasswordResetEmailVars {
  recipientName: string;
  /** Brand-scoped reset URL. Includes the challengeId so the server
   *  doesn't have to look up by token alone. */
  resetUrl: string;
  /** 6-digit numeric OTP for manual fallback. */
  resetCode: string;
  /** Where the request originated (IP / city). Helps the user spot
   *  unauthorized attempts. */
  requestOrigin: string;
}

export function renderPasswordResetEmail(
  brand: BrandEmailContext,
  vars: PasswordResetEmailVars,
): { subject: string; email: WrappedEmail } {
  const subject = `Reset your ${brand.brandName} password`;

  const body =
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;">Reset your password</h1>` +
    paragraph(
      `Hi ${vars.recipientName}, someone requested a password reset for your ${brand.brandName} portal.`,
    ) +
    button(brand, vars.resetUrl, 'Reset password') +
    paragraph(
      `Or type this 6-digit code on the reset screen if the link doesn't open in the right browser:`,
    ) +
    monoBlock(vars.resetCode) +
    paragraph(
      `This link and code expire in 30 minutes and can only be used once. Origin of this request: ${vars.requestOrigin}.`,
    ) +
    paragraph(
      `If you didn't request a reset, ignore this email — your password stays unchanged. If you keep getting unwanted reset emails, please contact ${brand.replyTo}.`,
    );

  const plainText =
    `Reset your ${brand.brandName} password.\n\n` +
    `Hi ${vars.recipientName}, someone requested a password reset.\n\n` +
    `Reset link: ${vars.resetUrl}\n` +
    `Or use code: ${vars.resetCode}\n\n` +
    `Both expire in 30 minutes and are single-use.\n` +
    `Origin: ${vars.requestOrigin}.\n\n` +
    `If you didn't request this, ignore this email.\n\n${brand.legalEntity}`;

  return {
    subject,
    email: wrap(brand, {
      // why preheader phrasing: the inbox preview is the second line
      // most users scan. Saying "expires in 30 minutes" up front
      // discourages later-than-30-min clicks that would 410.
      preheader: `Single-use reset link — expires in 30 minutes.`,
      body,
      plainText,
    }),
  };
}

// Suppress unused-import warning — esc is part of the layout barrel.
void esc;
