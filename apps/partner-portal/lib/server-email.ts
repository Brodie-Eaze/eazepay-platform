/**
 * Partner-portal server-side branded-email sender.
 *
 * Why this module exists:
 *   service-email is a NestJS library that handles email for apps/api.
 *   The partner-portal has its own BFF routes (Next.js Route Handlers)
 *   that ALSO need to send branded transactional email — welcome on
 *   onboarding completion, team-invite on /v/<brand>/team invite,
 *   etc. Wiring the NestJS DI container into Next.js Route Handlers
 *   is messy, so we import the pure-function template renderers +
 *   brand resolver directly from @eazepay/service-email and call
 *   Resend's HTTP API ourselves.
 *
 * What's shared with service-email:
 *   - `resolveBrandContext(brand)` — same source of truth for
 *     from-address, accent, logo, legal entity per vertical.
 *   - Template renderers (`renderWelcomeEmail`, `renderTeamInviteEmail`,
 *     `renderInvoiceIssuedEmail`, `renderPasswordResetEmail`).
 *
 * What's local:
 *   - The Resend HTTP wrapper (15s timeout, Idempotency-Key, typed
 *     EmailSendError). Mirrors the NestJS adapter but as a plain async
 *     function callable from any Route Handler.
 *   - Mock fallback when `RESEND_API_KEY` is unset (logs to stdout, dedupes).
 *
 * Idempotency: callers SHOULD pass a stable key per logical send so
 * Resend dedupes within its 24h window. Suggestions:
 *   - welcome:  `welcome-<application_id>`
 *   - team-invite: `team-invite-<invite_token>`
 *   - invoice: `invoice-<invoice_no>`
 */

import type { BrandCode } from '@eazepay/shared-types';
import {
  resolveBrandContext,
  renderWelcomeEmail,
  renderTeamInviteEmail,
  renderInvoiceIssuedEmail,
  renderPasswordResetEmail,
  type WelcomeEmailVars,
  type TeamInviteEmailVars,
  type InvoiceIssuedEmailVars,
  type PasswordResetEmailVars,
} from '@eazepay/service-email';

export type SendableBrand = BrandCode | 'master';

/** Resend test mode flag — when set the API doesn't deliver but
 *  validates the payload + returns a real id, useful for E2E. */
const RESEND_TEST_MODE = process.env.RESEND_TEST_MODE === 'true';

/** Tracks idempotency keys seen by the mock so duplicate sends don't
 *  log twice during a single Next.js dev session. */
const MOCK_SEEN_KEYS = new Set<string>();

export interface SendBrandedEmailResult {
  provider: 'resend' | 'mock';
  providerMessageId: string;
  sentAt: Date;
}

export class EmailSendError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly meta: { transient: boolean },
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}

/**
 * Core dispatcher. Use the convenience wrappers below for the four
 * canonical email types — only call this directly if you've rendered
 * the html/text yourself.
 */
async function dispatchBrandedEmail(input: {
  brand: SendableBrand;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<SendBrandedEmailResult> {
  const brand = resolveBrandContext(input.brand);
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Mock fallback — log to stdout. Dedupe so a redeploy retry
    // doesn't pollute the console. Keeps Next dev tidy.
    if (!MOCK_SEEN_KEYS.has(input.idempotencyKey)) {
      MOCK_SEEN_KEYS.add(input.idempotencyKey);
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'email.mock_dispatch',
          brand: brand.brand,
          to: input.to,
          subject: input.subject,
          from: brand.fromAddress,
          idempotencyKey: input.idempotencyKey,
        }),
      );
    }
    return {
      provider: 'mock',
      providerMessageId: `mock-${input.idempotencyKey}`,
      sentAt: new Date(),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: brand.fromAddress,
        reply_to: brand.replyTo,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        // Test mode: tag the email so it's clear in the Resend dashboard.
        ...(RESEND_TEST_MODE ? { tags: [{ name: 'mode', value: 'test' }] } : {}),
      }),
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new EmailSendError(
      aborted ? 'timeout' : 'network',
      aborted ? 'Resend request timed out after 15s.' : 'Resend network failure.',
      { transient: true },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      name?: string;
      message?: string;
    };
    const code = payload.name ?? `http_${res.status}`;
    const transient = res.status >= 500 || code === 'rate_limit_exceeded';
    throw new EmailSendError(code, payload.message ?? `HTTP ${res.status}`, { transient });
  }

  const ok = (await res.json()) as { id: string };
  return { provider: 'resend', providerMessageId: ok.id, sentAt: new Date() };
}

/** Branded welcome email — fires on onboarding completion. */
export async function sendWelcomeEmail(input: {
  brand: SendableBrand;
  to: string;
  vars: WelcomeEmailVars;
  idempotencyKey: string;
}): Promise<SendBrandedEmailResult> {
  const brand = resolveBrandContext(input.brand);
  const rendered = renderWelcomeEmail(brand, input.vars);
  return dispatchBrandedEmail({
    brand: input.brand,
    to: input.to,
    subject: rendered.subject,
    html: rendered.email.html,
    text: rendered.email.text,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Branded team-invite — fires when an Owner/Admin invites a teammate. */
export async function sendTeamInviteEmail(input: {
  brand: SendableBrand;
  to: string;
  vars: TeamInviteEmailVars;
  idempotencyKey: string;
}): Promise<SendBrandedEmailResult> {
  const brand = resolveBrandContext(input.brand);
  const rendered = renderTeamInviteEmail(brand, input.vars);
  return dispatchBrandedEmail({
    brand: input.brand,
    to: input.to,
    subject: rendered.subject,
    html: rendered.email.html,
    text: rendered.email.text,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Branded invoice-issued — fires when master billing dispatches an invoice. */
export async function sendInvoiceIssuedEmail(input: {
  brand: SendableBrand;
  to: string;
  vars: InvoiceIssuedEmailVars;
  idempotencyKey: string;
}): Promise<SendBrandedEmailResult> {
  const brand = resolveBrandContext(input.brand);
  const rendered = renderInvoiceIssuedEmail(brand, input.vars);
  return dispatchBrandedEmail({
    brand: input.brand,
    to: input.to,
    subject: rendered.subject,
    html: rendered.email.html,
    text: rendered.email.text,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Branded password-reset — fires from the partner-portal BFF when
 *  the user requests a reset (mirror of apps/api version, used until
 *  apps/api is deployed). */
export async function sendPasswordResetEmail(input: {
  brand: SendableBrand;
  to: string;
  vars: PasswordResetEmailVars;
  idempotencyKey: string;
}): Promise<SendBrandedEmailResult> {
  const brand = resolveBrandContext(input.brand);
  const rendered = renderPasswordResetEmail(brand, input.vars);
  return dispatchBrandedEmail({
    brand: input.brand,
    to: input.to,
    subject: rendered.subject,
    html: rendered.email.html,
    text: rendered.email.text,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Test util — reset the mock dedup cache between specs. */
export function _resetMockSeenKeys(): void {
  MOCK_SEEN_KEYS.clear();
}
