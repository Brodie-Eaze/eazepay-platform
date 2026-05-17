/**
 * Event kinds — must mirror the Prisma `EventKind` enum exactly.
 * Keep this list in lockstep with apps/api/prisma/schema.prisma.
 */
export type EventKind =
  | 'application_opened'
  | 'application_submitted'
  | 'application_viewed'
  | 'application_abandoned'
  | 'offer_received'
  | 'offer_selected'
  | 'contract_signed'
  | 'funding_released'
  | 'invoice_generated'
  | 'invoice_sent'
  | 'invoice_confirmed'
  | 'invoice_disputed'
  | 'invoice_paid'
  | 'config_changed'
  | 'auth_signin_failed';

/** Permitted JSON for `payload`. See sanitiser.ts for the contract. */
export type SafeJsonValue =
  | string
  | number
  | boolean
  | null
  | SafeJsonValue[]
  | { [k: string]: SafeJsonValue };

export interface PublishInput {
  kind: EventKind;
  /** Tenant scope. null → master-only (e.g. failed-login for unknown user). */
  merchantId: string | null;
  targetType: string;
  targetId: string;
  /** Operator user id, or null for system / cron / public-recipient events. */
  actorId: string | null;
  /** Display label for the actor — operator email, "system", "recipient". */
  actorLabel: string;
  /** ID-only payload, must pass sanitiser. Use `payloadPii` for free text. */
  payload: Record<string, SafeJsonValue>;
  /** Optional free-text PII that will be envelope-encrypted before persist.
   *  AAD-bound to the event's uuid. Never decrypted into partner SSE frames. */
  payloadPii?: string;
}

export interface PublishedEvent {
  uuid: string;
  id: string; // BigInt serialised as string for the wire
  kind: EventKind;
  merchantId: string | null;
  targetType: string;
  targetId: string;
  actorId: string | null;
  actorLabel: string;
  payload: Record<string, SafeJsonValue>;
  at: string; // ISO timestamp
}
