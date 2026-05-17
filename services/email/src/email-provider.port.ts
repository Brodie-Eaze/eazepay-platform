/**
 * Transport-layer port for sending a single email.
 *
 * One adapter per provider — Resend (production), Mock (dev + tests).
 * The BrandedEmailService renders the branded template + resolves the
 * brand context, then hands the resulting payload to whichever provider
 * is wired in the DI container.
 *
 * Why a port instead of calling Resend directly: provider swaps happen.
 * Today's Resend may be tomorrow's SES / SendGrid / Postmark, and the
 * audit logger in EmailDispatchService doesn't care which one shipped
 * the bytes — it just records the provider name + ref.
 *
 * Idempotency: callers pass an `idempotencyKey` so a webhook replay or
 * a retry doesn't trigger a duplicate send. The Resend adapter forwards
 * it as the `Idempotency-Key` HTTP header; the mock keeps a per-process
 * Set to dedupe.
 */
export interface SendEmailInput {
  /** Fully-formatted From (matches a Resend verified sender). */
  from: string;
  /** Optional reply-to override. */
  replyTo?: string;
  /** Single recipient. Multi-recipient is intentionally not supported —
   *  each addressee gets their own audit-log row. */
  to: string;
  /** Plain subject line. Already brand-prefixed by the caller. */
  subject: string;
  /** Plain-text body (mandatory — anti-spam + accessibility). */
  text: string;
  /** Rendered HTML body. */
  html: string;
  /** Replay-safety key. Stable for the same logical send (e.g. the
   *  invoice token, the password-reset challenge id). */
  idempotencyKey: string;
  /** Optional headers to attach. Used for trace ids. */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  /** Provider that handled the dispatch ('resend', 'mock', etc.). */
  provider: string;
  /** Provider-issued message id. Audit logger persists this. */
  providerMessageId: string;
  /** Wall-clock time the provider acknowledged. */
  sentAt: Date;
}

export interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
