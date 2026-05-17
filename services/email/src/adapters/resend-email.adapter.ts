import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, SendEmailInput, SendEmailResult } from '../email-provider.port.js';

/**
 * Resend EmailProvider. Activated by EmailModule when RESEND_API_KEY is set.
 *
 * Wire: POST https://api.resend.com/emails with the rendered envelope.
 * Resend honours `Idempotency-Key` (24h dedup) so a webhook replay
 * doesn't double-send. Failures return RFC 7807-shaped errors which we
 * surface as thrown Errors — BrandedEmailService wraps them in a typed
 * EmailSendError so callers can branch on permanent vs transient.
 *
 * Why not the @resend/node SDK: small surface, vendor-lock, and adding
 * a 1.2MB dep for a single POST isn't worth it. Native fetch is fine.
 *
 * Failure modes covered:
 *   - Network / 5xx → transient (caller should retry)
 *   - 4xx with code=invalid_from → permanent (caller should alert; the
 *     subdomain hasn't been verified in Resend yet)
 *   - 4xx with code=rate_limited → transient (caller should back off)
 *   - 4xx other → permanent (caller logs + drops)
 */
@Injectable()
export class ResendEmailAdapter implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.resend.com/emails';

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        'ResendEmailAdapter constructed but RESEND_API_KEY is unset. ' +
          'EmailModule should have selected MockEmailAdapter instead.',
      );
    }
    this.apiKey = key;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const body = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      ...(input.headers ? { headers: input.headers } : {}),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify(body),
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
      throw new EmailSendError(code, payload.message ?? `HTTP ${res.status}`, {
        transient,
      });
    }

    const ok = (await res.json()) as { id: string };
    return {
      provider: this.name,
      providerMessageId: ok.id,
      sentAt: new Date(),
    };
  }
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
