import { SetMetadata } from '@nestjs/common';

/**
 * SEC-018 — admin read paths must write audit rows.
 *
 * Threat scenario (SOC 2 evidence gap):
 *   A regulator asks "which staff member viewed consumer X's file on
 *   date Y, and what did they see?" Pre-fix, the admin read endpoints
 *   (/v1/admin/applications, /v1/admin/applications/:id,
 *    /v1/admin/audit-logs, /v1/admin/risk-flags) returned PII-bearing
 *   data without writing any audit trail. We could prove WHO logged
 *   in, but not WHO READ WHAT. SOC 2 CC6.1 / CC7.2 require a complete
 *   record of access to sensitive data — silent reads fail the audit.
 *
 * Fix: any admin GET that reads consumer-adjacent data is annotated
 * with `@AuditedRead({ targetType, idParam? })`. The companion
 * AuditedReadInterceptor writes an `admin.<targetType>.read` row to
 * AuditOutbox containing the actor, the resource id (or `'list'` for
 * collection reads) and the filter query string. Reads that throw
 * (404, 403, validation error) do NOT emit a row — we audit successful
 * disclosures, not attempts; attempted-disclosure rows would inflate
 * the chain without proving access actually happened.
 */
export const AUDITED_READ_KEY = 'admin:auditedRead';

export interface AuditedReadOptions {
  /**
   * The logical target type, used to compose the audit action name
   * (`admin.<targetType>.read`). Example: 'Application', 'AuditLog',
   * 'RiskFlag'. Stays a free-form string so callers can label new
   * read paths without touching this file.
   */
  targetType: string;
  /**
   * Name of the route param holding the resource id (e.g. 'id'). When
   * omitted the read is treated as a list/collection read and the
   * audit row's targetId is recorded as the literal `'list'`.
   */
  idParam?: string;
}

/**
 * Mark a controller method as a PII-adjacent read that MUST emit an
 * audit row on success. The companion `AuditedReadInterceptor` reads
 * this metadata via Reflector and writes the row asynchronously after
 * the response is observed.
 */
export const AuditedRead = (options: AuditedReadOptions): MethodDecorator =>
  SetMetadata(AUDITED_READ_KEY, options);
