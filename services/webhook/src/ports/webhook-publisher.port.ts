/**
 * Cross-cutting publish port. Other services (orchestration,
 * application, payment) inject this with @Optional() and call
 * publish() at the moments they want merchants notified.
 *
 * The publisher itself decides which subscribed endpoints match the
 * event type, fans out delivery rows, and the dispatcher cron drains
 * them with retry. Callers do NOT block on delivery.
 */
export interface WebhookPublishInput {
  /** Stable dotted name, matched by literal string against
   *  WebhookEndpoint.events. Examples: 'application.offers_presented',
   *  'application.contracted', 'application.funded',
   *  'application.declined', 'loan.repayment.collected',
   *  'loan.repayment.failed'. */
  eventType: string;
  /** Stable id from the publishing service so duplicate publishes
   *  collapse at the (endpoint, event) unique constraint. */
  eventId: string;
  /** Subject anchor — typically (Application, applicationId) or
   *  (Loan, loanId). Carried on the delivery row + the wire payload. */
  subjectType: string;
  subjectId: string;
  /** Merchant scope. Only this merchant's active endpoints will receive
   *  the event. Pass null for events that should fan out to ALL active
   *  endpoints regardless of merchant — currently nothing uses that
   *  but the surface is reserved. */
  merchantId: string | null;
  /** Wire payload. Reference entity ids; never live money or PII. */
  payload: Record<string, unknown>;
}

export interface WebhookPublisher {
  publish(input: WebhookPublishInput): Promise<{ deliveriesCreated: number }>;
}

export const WEBHOOK_PUBLISHER = Symbol('WEBHOOK_PUBLISHER');
