/**
 * Drizzle schema — partner-portal Postgres.
 *
 * Single source of truth for every table the partner-portal owns
 * directly. The marketing/sales surfaces, lender adapters, and the
 * NestJS orchestration service have their own schemas elsewhere; this
 * file is strictly for the data that flows through the consumer apply
 * funnel into the partner dashboards and the master admin view.
 *
 * Migrations are generated with `pnpm db:generate` and applied with
 * `pnpm db:migrate`. Both commands read `DATABASE_URL` from env.
 *
 * Indexing strategy
 * -----------------
 *   applications (partner_id, created_at DESC)   ← partner dashboards
 *   applications (brand, created_at DESC)        ← per-vertical admin views
 *   applications (brand, status, created_at)     ← funnel filters
 *   applications (request_id)  UNIQUE             ← idempotency
 *
 * At 22.5k apps/day = ~8M rows/yr these indexes keep every dashboard
 * read sub-millisecond.
 */

import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ---------- enums ---------- */

export const brandEnum = pgEnum('brand', ['medpay', 'tradepay', 'coachpay']);
export const applicationStatusEnum = pgEnum('application_status', [
  'submitted',
  'in_review',
  'approved',
  'funded',
  'declined',
]);
export const applicationEventTypeEnum = pgEnum('application_event_type', [
  'created',
  'status_changed',
  'lender_quoted',
  'offer_accepted',
  'lender_funded',
  'note_added',
]);

/* ---------- partners ----------
 *
 * Persisted view of `lib/master-data.ts` MASTER_PARTNERS. Seeded once
 * from the fixture on initial deploy; future writes happen through the
 * admin tools when an operator approves a new onboarding submission.
 *
 * The `partner_id` on `applications` is a soft reference into this
 * table (no FK constraint) so the synthetic `__unattributed__` value
 * doesn't require a placeholder row.
 */
export const partners = pgTable(
  'partners',
  {
    id: text('id').primaryKey(),
    brand: brandEnum('brand').notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name'),
    product: text('product'),
    status: text('status').notNull().default('active'),
    primaryContactEmail: text('primary_contact_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandIdx: index('partners_brand_idx').on(t.brand),
    legalNameIdx: index('partners_legal_name_idx').on(t.legalName),
  }),
);

export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;

/* ---------- applications ----------
 *
 * Every consumer who completes `/apply/<brand>` writes a row here. The
 * row is the canonical source for both:
 *   • Partner portal /v/<brand>/applications  (filtered by partner_id)
 *   • Master /applications                    (no filter)
 *
 * Idempotency: the apply page mints a `request_id` per submission. The
 * UNIQUE constraint on it means a network retry posts the same id and
 * the second insert is a no-op (handled by `ON CONFLICT (request_id)
 * DO NOTHING ... RETURNING *` in the write path).
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brand: brandEnum('brand').notNull(),
    /** Soft reference to `partners.id`. The synthetic '__unattributed__'
     * value is allowed and stays out of every partner-scoped read. */
    partnerId: text('partner_id').notNull(),
    /** Raw `?ref=...` from the apply URL, kept verbatim for audit. */
    refQuery: text('ref_query'),
    /** Consumer name + contact. In production these are encrypted at
     * rest via the PII vault (ADR-0016); demo deployment stores plain
     * text. Schema is identical either way — only the writer changes. */
    consumerFirst: text('consumer_first').notNull(),
    consumerLast: text('consumer_last').notNull(),
    consumerEmail: text('consumer_email').notNull(),
    consumerPhone: text('consumer_phone').notNull(),
    /** Loan amount in cents to keep currency math integer-safe. */
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    tier: text('tier'),
    selectedLender: text('selected_lender'),
    status: applicationStatusEnum('status').notNull().default('submitted'),
    /** Idempotency key from the consumer apply form. */
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerCreatedIdx: index('applications_partner_created_idx').on(t.partnerId, t.createdAt),
    brandCreatedIdx: index('applications_brand_created_idx').on(t.brand, t.createdAt),
    brandStatusCreatedIdx: index('applications_brand_status_created_idx').on(
      t.brand,
      t.status,
      t.createdAt,
    ),
    requestIdUnique: uniqueIndex('applications_request_id_unique').on(t.requestId),
  }),
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

/* ---------- application_events ----------
 *
 * Append-only audit log for every state transition on an application.
 * The lender webhook handler writes here when a loan settles; the
 * admin status-change action writes here too. Regulators replay this
 * table to verify the decision trail (Reg B adverse-action timing,
 * FCRA dispute response windows).
 */
export const applicationEvents = pgTable(
  'application_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id').notNull(),
    type: applicationEventTypeEnum('type').notNull(),
    fromStatus: applicationStatusEnum('from_status'),
    toStatus: applicationStatusEnum('to_status'),
    /** Free-form JSON-encoded payload describing what happened. The
     * shape varies per event type; the consumer that produced the
     * event owns its schema. */
    payload: text('payload'),
    /** Who initiated the event — userId of the operator, or 'system'
     * for webhook-driven changes, or 'consumer' for self-service. */
    actor: text('actor').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    appCreatedIdx: index('application_events_app_created_idx').on(t.applicationId, t.createdAt),
  }),
);

export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
