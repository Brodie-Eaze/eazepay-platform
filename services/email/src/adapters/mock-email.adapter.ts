import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EmailProvider, SendEmailInput, SendEmailResult } from '../email-provider.port.js';

/**
 * Dev + test EmailProvider. Logs to stdout, deduplicates on
 * idempotencyKey, and returns a synthetic provider message id so
 * downstream audit-log writes don't fail.
 *
 * Wired by EmailModule whenever RESEND_API_KEY is unset (or in tests
 * where we don't want real outbound mail).
 *
 * What we DON'T do here: persist the rendered HTML. The
 * EmailDispatchService captures `subject + text` for SOC2 evidence,
 * which is enough — the HTML is regenerable from the template + the
 * vars. Keeping the mock cheap also keeps test setup cheap.
 */
@Injectable()
export class MockEmailAdapter implements EmailProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockEmailAdapter.name);
  private readonly seen = new Set<string>();

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.seen.has(input.idempotencyKey)) {
      this.logger.debug(
        `MOCK SKIP (duplicate idempotencyKey=${input.idempotencyKey}) ${input.subject}`,
      );
      return {
        provider: this.name,
        providerMessageId: `mock-dup-${input.idempotencyKey}`,
        sentAt: new Date(),
      };
    }
    this.seen.add(input.idempotencyKey);
    this.logger.log(
      `MOCK EMAIL → ${input.to} | ${input.subject}\n` +
        `  from=${input.from}\n` +
        `  text-preview="${input.text.slice(0, 140).replace(/\s+/g, ' ')}…"`,
    );
    return {
      provider: this.name,
      providerMessageId: `mock-${randomUUID()}`,
      sentAt: new Date(),
    };
  }
}
