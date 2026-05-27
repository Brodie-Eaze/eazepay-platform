/**
 * WebhookVerificationResult — the structured outcome of any inbound
 * webhook signature check, shared across every provider.
 *
 * Lifted out of `apps/partner-portal/lib/micamp/client.ts` during the
 * integrations-core refactor (was duplicated as a cross-import from
 * HighSale, which made the dependency graph point app->app sideways).
 *
 * Callers MUST log the `reason` to safeLog so we have an audit trail
 * of WHY a signature was rejected (replayed timestamp vs tampered body
 * vs unsigned). The reason vocabulary is closed — adding a new reason
 * means updating the dashboard query.
 */

export type WebhookVerificationReason =
  | 'missing_secret'
  | 'missing_signature'
  | 'bad_signature'
  | 'stale_timestamp'
  | 'malformed';

export type WebhookVerificationResult =
  | { valid: true }
  | { valid: false; reason: WebhookVerificationReason };
