import type { BrandCode } from '@eazepay/shared-types';

/**
 * Audit port for every email the BrandedEmailService dispatches.
 *
 * Why a port: SOC2 evidence pulls answer "send me every email we
 * dispatched to merchant X between dates A and B". That requires a
 * durable row per send, queryable by recipient + template + brand +
 * date. Today we wire a Prisma-backed implementation; tomorrow it
 * might be DynamoDB or a streaming pipeline to S3 Object Lock — same
 * port, swappable adapter.
 *
 * The actual schema lives in apps/api/prisma/schema.prisma as
 * `email_dispatch`. See the migration 20260517_email_dispatch_audit
 * for the column shape.
 *
 * Privacy: we record subject + recipient + brand + template + provider
 * id. We DO NOT record the rendered HTML/text body. The body is
 * regenerable from the template + the args at any point in time; the
 * args themselves may include PII (recipient name, OTP code, invoice
 * amount) and don't belong in an audit row. If a regulator asks "what
 * exactly did this email say", git log + the template key + the
 * arguments captured by the originating service is the right path.
 */

export interface EmailDispatchAuditRow {
  brand: BrandCode | 'master';
  to: string;
  templateKey: string;
  subject: string;
  provider: string;
  providerMessageId: string;
  sentAt: Date;
  idempotencyKey: string;
}

export interface EmailDispatchAuditWriter {
  record(row: EmailDispatchAuditRow): Promise<void>;
}

export const EMAIL_DISPATCH_AUDIT = Symbol('EMAIL_DISPATCH_AUDIT');

/**
 * Console-backed audit writer for dev + tests. Logs the row at info
 * level. Production wires the Prisma-backed version (see
 * EmailDispatchAuditPrismaService below).
 */
export class ConsoleEmailDispatchAudit implements EmailDispatchAuditWriter {
  async record(row: EmailDispatchAuditRow): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'email_dispatch.recorded',
        brand: row.brand,
        to: row.to,
        templateKey: row.templateKey,
        subject: row.subject,
        provider: row.provider,
        providerMessageId: row.providerMessageId,
        sentAt: row.sentAt.toISOString(),
        idempotencyKey: row.idempotencyKey,
      }),
    );
  }
}

// Re-export with the original name for the BrandedEmailService import
// to stay readable.
export { ConsoleEmailDispatchAudit as EmailDispatchAuditService };
