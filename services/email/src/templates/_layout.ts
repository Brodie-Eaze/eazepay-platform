import type { BrandEmailContext } from '../brand-context.js';

/**
 * Shared HTML scaffold for every branded email.
 *
 * Constraints driving the design:
 *   - Mail-client compatibility is hostile (Outlook 2016 still strips
 *     `<style>`, Gmail inlines CSS, dark-mode inverts). Inline styles
 *     only. Tables only. No flexbox, no grid.
 *   - Width capped at 560px for mobile readability.
 *   - Brand wordmark + accent header band; rest is monochrome so the
 *     vertical's identity sits at the top without competing for
 *     attention.
 *   - Footer carries the legal entity + help URL + an unsubscribe
 *     hint (every brand-flavored notification email is transactional
 *     and exempt from CAN-SPAM unsubscribe, but we still want a
 *     contact route).
 *
 * Helpers exposed:
 *   - `wrap(brand, { preheader, body, plainText })` returns
 *     `{html, text, subject?}` — caller passes the body fragments.
 *   - `button(brand, href, label)` is a bullet-proof CTA button.
 *   - `monoBlock(text)` renders a code-style monospaced block (used by
 *     password-reset tokens, recovery codes).
 *   - `paragraph(text)` is the standard body paragraph.
 *   - `metaRow(label, value)` renders an invoice-style label/value pair.
 *
 * Everything returns `string` so templates compose cheaply without
 * pulling in React Email (30MB+ of deps). When React Email lands later
 * the wrap() signature stays the same.
 */

export interface WrapInput {
  /** Hidden preheader (shows next to subject in inbox previews). */
  preheader: string;
  /** Inner HTML body — call paragraph()/button()/etc. to build. */
  body: string;
  /** Plain-text equivalent of body. Required (CAN-SPAM + accessibility). */
  plainText: string;
}

export interface WrappedEmail {
  html: string;
  text: string;
}

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value before HTML interpolation. ALWAYS use for any user-derived string. */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#1f2937;">${esc(text)}</p>`;
}

export function button(brand: BrandEmailContext, href: string, label: string): string {
  // why: bullet-proof button — render via table+VML for Outlook;
  // simplified here to a styled anchor (good enough for Gmail/Apple
  // Mail/Outlook 365/iOS). Switch to MSO conditional comments if/when
  // Outlook 2016 support becomes a stated requirement.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr><td bgcolor="${brand.accentHex}" style="border-radius:10px;">
      <a href="${esc(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:Inter,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
    </td></tr>
  </table>`;
}

export function monoBlock(text: string): string {
  return `<div style="margin:0 0 16px;padding:14px 16px;background:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#111827;letter-spacing:0.02em;">${esc(text)}</div>`;
}

export function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;color:#6b7280;letter-spacing:0.04em;text-transform:uppercase;font-weight:600;">${esc(label)}</td>
    <td style="padding:6px 0;font-size:13px;color:#111827;text-align:right;font-variant-numeric:tabular-nums;">${esc(value)}</td>
  </tr>`;
}

export function wrap(brand: BrandEmailContext, input: WrapInput): WrappedEmail {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(brand.brandName)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Inter,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <span style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:#f6f7fb;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(input.preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f6f7fb">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;">
        <tr><td style="padding:0 0 8px;">
          <div style="height:4px;border-radius:2px;background:${brand.accentHex};"></div>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding-bottom:18px;border-bottom:1px solid #f0f1f5;">
              <span style="display:inline-block;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;color:${brand.accentHex};">${esc(brand.brandName)}</span>
            </td></tr>
            <tr><td style="padding:22px 0 0;">
              ${input.body}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 8px 0;font-size:11px;line-height:1.6;color:#6b7280;text-align:center;">
          ${esc(brand.legalEntity)} · <a href="${esc(brand.helpUrl)}" style="color:#6b7280;text-decoration:underline;">Help</a><br />
          You're receiving this because you have an account with ${esc(brand.brandName)}. This is a transactional message.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { html, text: input.plainText };
}
