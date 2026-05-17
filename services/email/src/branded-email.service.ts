import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { BrandCode } from '@eazepay/shared-types';
import { EMAIL_PROVIDER, type EmailProvider, type SendEmailResult } from './email-provider.port.js';
import { resolveBrandContext } from './brand-context.js';
import { renderWelcomeEmail, type WelcomeEmailVars } from './templates/welcome.js';
import {
  renderPasswordResetEmail,
  type PasswordResetEmailVars,
} from './templates/password-reset.js';
import { renderTeamInviteEmail, type TeamInviteEmailVars } from './templates/team-invite.js';
import {
  renderInvoiceIssuedEmail,
  type InvoiceIssuedEmailVars,
} from './templates/invoice-issued.js';
import {
  EmailDispatchAuditService,
  type EmailDispatchAuditWriter,
  EMAIL_DISPATCH_AUDIT,
} from './email-dispatch-audit.service.js';

/**
 * Single entry point for branded outbound email.
 *
 * Caller flow:
 *
 *   await emails.sendWelcome({
 *     brand: 'medpay',
 *     to: 'finance@helio-dental.com',
 *     vars: { recipientName: 'Helio team', merchantBusinessName: 'Helio Dental Group', portalUrl: '...' },
 *   });
 *
 * Internally:
 *   1. resolveBrandContext(brand) → from-addr, accent, logo, support
 *   2. render<Template> → { subject, email: { html, text } }
 *   3. EmailProvider.send → adapter (Resend in prod, Mock in dev)
 *   4. EmailDispatchAuditService.record → durable row for SOC2 evidence
 *
 * Idempotency: callers SHOULD pass `idempotencyKey`. If they don't, we
 * mint a random UUID — the dedup window only catches duplicate sends
 * within the same logical operation when the key is meaningful (the
 * invoice number, the OTP challenge id, etc.). For transactional sends
 * where retry-safety matters, the caller's key is what makes the
 * Resend `Idempotency-Key` header useful (24h server-side dedup).
 *
 * Audit:
 *   Every send path threads through the (optional) audit writer. If
 *   no writer is wired in DI we silently skip the audit row — useful
 *   for unit tests but logged at warn-level in production so the gap
 *   is visible.
 */

export interface SendBaseInput {
  /** The vertical the partner signed up under. Determines from-address
   *  + accent + logo. 'master' uses the parent EazePay branding (only
   *  appropriate for operator-internal mail). */
  brand: BrandCode | 'master';
  to: string;
  /** Stable per-operation key for replay safety. Defaults to a fresh UUID. */
  idempotencyKey?: string;
  /** Optional headers to attach (trace id, etc.). */
  headers?: Record<string, string>;
}

@Injectable()
export class BrandedEmailService {
  private readonly logger = new Logger(BrandedEmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    @Optional()
    @Inject(EMAIL_DISPATCH_AUDIT)
    private readonly auditWriter?: EmailDispatchAuditWriter,
  ) {
    if (!auditWriter) {
      this.logger.warn(
        'BrandedEmailService constructed without EMAIL_DISPATCH_AUDIT writer — sends will not be recorded. ' +
          'Wire EmailDispatchAuditService (or a mock) in the host module for SOC2 evidence.',
      );
    }
  }

  async sendWelcome(input: SendBaseInput & { vars: WelcomeEmailVars }): Promise<SendEmailResult> {
    const brand = resolveBrandContext(input.brand);
    const rendered = renderWelcomeEmail(brand, input.vars);
    return this.dispatch({
      ...input,
      templateKey: 'welcome',
      subject: rendered.subject,
      text: rendered.email.text,
      html: rendered.email.html,
    });
  }

  async sendPasswordReset(
    input: SendBaseInput & { vars: PasswordResetEmailVars },
  ): Promise<SendEmailResult> {
    const brand = resolveBrandContext(input.brand);
    const rendered = renderPasswordResetEmail(brand, input.vars);
    return this.dispatch({
      ...input,
      templateKey: 'password_reset',
      subject: rendered.subject,
      text: rendered.email.text,
      html: rendered.email.html,
    });
  }

  async sendTeamInvite(
    input: SendBaseInput & { vars: TeamInviteEmailVars },
  ): Promise<SendEmailResult> {
    const brand = resolveBrandContext(input.brand);
    const rendered = renderTeamInviteEmail(brand, input.vars);
    return this.dispatch({
      ...input,
      templateKey: 'team_invite',
      subject: rendered.subject,
      text: rendered.email.text,
      html: rendered.email.html,
    });
  }

  async sendInvoiceIssued(
    input: SendBaseInput & { vars: InvoiceIssuedEmailVars },
  ): Promise<SendEmailResult> {
    const brand = resolveBrandContext(input.brand);
    const rendered = renderInvoiceIssuedEmail(brand, input.vars);
    return this.dispatch({
      ...input,
      templateKey: 'invoice_issued',
      subject: rendered.subject,
      text: rendered.email.text,
      html: rendered.email.html,
    });
  }

  private async dispatch(input: {
    brand: BrandCode | 'master';
    to: string;
    idempotencyKey?: string;
    headers?: Record<string, string>;
    templateKey: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<SendEmailResult> {
    const brand = resolveBrandContext(input.brand);
    const idempotencyKey = input.idempotencyKey ?? randomUUID();

    const result = await this.provider.send({
      from: brand.fromAddress,
      replyTo: brand.replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      idempotencyKey,
      headers: input.headers,
    });

    // Best-effort audit write. We don't fail the send if the audit
    // sink is unreachable — the email already shipped, and the
    // adapter result will be logged. The audit gap surfaces as a
    // missing row, which the SOC2 evidence pull will flag.
    if (this.auditWriter) {
      try {
        await this.auditWriter.record({
          brand: input.brand,
          to: input.to,
          templateKey: input.templateKey,
          subject: input.subject,
          provider: result.provider,
          providerMessageId: result.providerMessageId,
          sentAt: result.sentAt,
          idempotencyKey,
        });
      } catch (err) {
        this.logger.error(
          `Audit-write failed for ${result.providerMessageId} (${input.templateKey} → ${input.to}): ${(err as Error).message}`,
        );
      }
    }

    return result;
  }
}
