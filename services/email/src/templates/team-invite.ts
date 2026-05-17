import type { BrandEmailContext } from '../brand-context.js';
import { wrap, paragraph, button, esc, type WrappedEmail } from './_layout.js';

/**
 * Team-member invite email.
 *
 * Fires on: POST /api/v/<brand>/team/invite (partner-side) or POST
 * /v1/admin/team (master-side, brand falls back to 'master').
 *
 * The accept link carries a one-time token; clicking it lands the
 * recipient on the brand-scoped account-setup wizard. Token TTL is 7
 * days — set in the invite store, NOT here. Email is informational only.
 */

export interface TeamInviteEmailVars {
  recipientName: string;
  inviterName: string;
  /** Role the inviter selected (e.g. "Underwriter", "Read-only"). */
  roleLabel: string;
  acceptUrl: string;
  /** Optional personal note. Plain text — escaped before render. */
  inviterNote?: string;
}

export function renderTeamInviteEmail(
  brand: BrandEmailContext,
  vars: TeamInviteEmailVars,
): { subject: string; email: WrappedEmail } {
  const subject = `${vars.inviterName} invited you to ${brand.brandName}`;

  const noteBlock = vars.inviterNote
    ? `<div style="margin:0 0 16px;padding:14px 16px;background:#fafbfc;border-left:3px solid ${brand.accentHex};border-radius:6px;font-size:13px;color:#374151;line-height:1.55;font-style:italic;">"${esc(vars.inviterNote)}"</div>`
    : '';

  const body =
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;letter-spacing:-0.01em;">You're invited to ${brand.brandName}</h1>` +
    paragraph(
      `${vars.inviterName} invited you to join the ${brand.brandName} portal as ${vars.roleLabel}.`,
    ) +
    noteBlock +
    button(brand, vars.acceptUrl, 'Accept invite') +
    paragraph(
      `The invite expires in 7 days. Once you accept, you'll set a password and land in the ${brand.brandName} portal with the role above.`,
    );

  const plainText =
    `${vars.inviterName} invited you to ${brand.brandName} as ${vars.roleLabel}.\n\n` +
    (vars.inviterNote ? `Note from ${vars.inviterName}: "${vars.inviterNote}"\n\n` : '') +
    `Accept: ${vars.acceptUrl}\n\n` +
    `Expires in 7 days.\n\n${brand.legalEntity}`;

  return {
    subject,
    email: wrap(brand, {
      preheader: `Role: ${vars.roleLabel}. Expires in 7 days.`,
      body,
      plainText,
    }),
  };
}
