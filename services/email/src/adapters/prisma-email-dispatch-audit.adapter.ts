import { Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type {
  EmailDispatchAuditRow,
  EmailDispatchAuditWriter,
} from '../email-dispatch-audit.service.js';

/**
 * Prisma-backed implementation of EmailDispatchAuditWriter.
 *
 * Host module (apps/api) wires this via:
 *
 *   EmailModule.forRoot({
 *     auditWriter: new PrismaEmailDispatchAudit(prisma),
 *   })
 *
 * Writes are INSERT-only. We never UPDATE the row after a send —
 * partial state would defeat the audit guarantee. If the provider
 * returns a different status later (bounce, complaint), that gets a
 * NEW row at a separate `bounce` template_key, leaving the original
 * dispatch row intact.
 *
 * Failure handling: any DB error throws so the BrandedEmailService
 * caller can decide. In practice BrandedEmailService wraps the audit
 * call in try/catch (audit gap shouldn't roll back a send that
 * already shipped bytes), so this throw surfaces as a single
 * structured error log per missed audit row.
 */
@Injectable()
export class PrismaEmailDispatchAudit implements EmailDispatchAuditWriter {
  private readonly logger = new Logger(PrismaEmailDispatchAudit.name);

  constructor(private readonly prisma: PrismaClient) {}

  async record(row: EmailDispatchAuditRow): Promise<void> {
    await this.prisma.emailDispatch.create({
      data: {
        brand: row.brand,
        // Audit-row contract uses `to` (RFC 5322 vocabulary); the
        // table column is named `recipient` to read naturally in
        // compliance-evidence pulls. The mapping is intentional.
        recipient: row.to,
        templateKey: row.templateKey,
        subject: row.subject,
        provider: row.provider,
        providerMessageId: row.providerMessageId,
        idempotencyKey: row.idempotencyKey,
        sentAt: row.sentAt,
      },
    });
  }

  // Suppress unused-var warning for the optional logger.
  private _ensureLoggerUsed(): void {
    void this.logger;
  }
}
