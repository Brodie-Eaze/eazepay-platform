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
  boolean,
  index,
  integer,
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

/* ---------- offers ----------
 *
 * Every offer a lender returns for an application. The marketplace
 * fans an application out to N lenders; each one POSTs back to
 * `/api/v1/webhooks/lenders/<id>` with their decision. We persist
 * one row per (lender, application) pair. The row is updated, not
 * duplicated, when the same lender re-quotes after additional info
 * lands (e.g. soft pull refresh) — the unique index enforces this.
 *
 * Indexing strategy:
 *   offers (application_id, created_at DESC)   ← waterfall view per app
 *   offers (lender_id, application_id) UNIQUE  ← idempotent upsert key
 *
 * Money columns are integer cents and APR is basis points (e.g. 1499
 * = 14.99%) to keep all math integer-safe across the lifecycle.
 */
export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id').notNull(),
    lenderId: text('lender_id').notNull(),
    /** Display name at write time so historical UI keeps rendering
     * even if the lender catalogue entry is later renamed/removed. */
    lenderName: text('lender_name'),
    /** approved | counter | declined | ineligible */
    decision: text('decision').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }),
    aprBps: integer('apr_bps'),
    termMonths: integer('term_months'),
    monthlyPaymentCents: bigint('monthly_payment_cents', { mode: 'number' }),
    /** Set when the consumer (or admin) selects this offer. NULL until then. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** Lender-provided expiry. After this, accept attempts are rejected. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Free-form reason on decline / counter. Surfaced in the offers UI. */
    declinedReason: text('declined_reason'),
    /** Full raw webhook payload for audit + regulator replay (JSON-encoded). */
    rawPayload: text('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    appCreatedIdx: index('offers_app_created_idx').on(t.applicationId, t.createdAt),
    lenderAppUnique: uniqueIndex('offers_lender_application_unique').on(
      t.lenderId,
      t.applicationId,
    ),
  }),
);

export type Offer = typeof offers.$inferSelect;
export type NewOffer = typeof offers.$inferInsert;

/* ---------- lenders ----------
 *
 * Persisted lender registry. Source of truth for the EazePay Lender
 * Marketplace. Replaces the in-memory `lib/marketplace-data.ts` fixture
 * once production lands. The fixture is still used as the seed source
 * during local development.
 *
 * Each row represents one connected lender. Verticals the lender is
 * eligible for live in `enabled_brands` (a CSV of `brandEnum` values)
 * so a single lender can be exposed across MedPay / TradePay / CoachPay
 * with one record. Per-partner overrides live in `partner_marketplaces`.
 *
 * `eligibility_rules_json` holds each lender's HARD eligibility rules
 * (FICO floor, DTI cap, income floor, employment type, geography,
 * treatment-category eligibility, etc.) — these feed the decision
 * engine's filter-and-rank step.
 *
 * `kickback_bps` is the origination fee paid back to us per funded
 * loan, expressed in basis points of the loan amount (e.g. 250 = 2.5%).
 * Integer-safe, kept as basis points to match `apr_bps` convention.
 */
export const lenders = pgTable(
  'lenders',
  {
    id: text('id').primaryKey(),
    displayName: text('display_name').notNull(),
    /** CSV of brandEnum values: 'medpay,tradepay'. Empty = available
     * to all verticals. Stored as text because Postgres array support
     * in Drizzle is uneven across pg drivers. */
    enabledBrands: text('enabled_brands').notNull().default(''),
    /** 'live' | 'pending_integration' | 'paused' | 'archived' */
    status: text('status').notNull().default('pending_integration'),
    /** Connection health from the last sync attempt. */
    connectionHealth: text('connection_health').notNull().default('unknown'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    /** Hard eligibility rules (FICO floor, DTI cap, geography, etc.)
     * shape varies per lender — stored as JSON-encoded text. */
    eligibilityRulesJson: text('eligibility_rules_json'),
    /** Origination kickback in basis points of funded amount. */
    kickbackBps: integer('kickback_bps').notNull().default(0),
    /** Webhook endpoint we POST to for application submission. */
    webhookUrl: text('webhook_url'),
    /** Webhook secret for HMAC verification on inbound callbacks. */
    webhookSecret: text('webhook_secret'),
    /** Minimum / maximum loan size envelope, in integer cents. */
    minAmountCents: bigint('min_amount_cents', { mode: 'number' }),
    maxAmountCents: bigint('max_amount_cents', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('lenders_status_idx').on(t.status),
    displayNameIdx: index('lenders_display_name_idx').on(t.displayName),
  }),
);

export type Lender = typeof lenders.$inferSelect;
export type NewLender = typeof lenders.$inferInsert;

/* ---------- vertical_configs ----------
 *
 * Per-vertical (medpay / tradepay / coachpay) configuration. The
 * admin portal "MedPay configuration" view writes here. Holds the
 * vertical-level lender allowlist, decision-engine routing policy,
 * application form schema reference, fee economics, branding defaults.
 *
 * Exactly one row per brand. Stored as JSON blobs because the schema
 * for each block evolves frequently and we want config changes to be
 * a single row update without migrations.
 */
export const verticalConfigs = pgTable(
  'vertical_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brand: brandEnum('brand').notNull(),
    /** CSV of lender ids enabled for this vertical (subset of
     * lenders.id where the brand is also in enabled_brands). */
    enabledLenderIds: text('enabled_lender_ids').notNull().default(''),
    /** Decision-engine routing policy: 'waterfall' | 'parallel' | 'hybrid' */
    routingMode: text('routing_mode').notNull().default('hybrid'),
    /** Vertical-level overrides on top of each lender's rules. JSON. */
    routingRulesJson: text('routing_rules_json'),
    /** Application form schema reference (slug into lib/forms/*). */
    formSchemaSlug: text('form_schema_slug'),
    /** Branding defaults for the consumer-facing surface. JSON. */
    brandingJson: text('branding_json'),
    /** Fee economics: our cut, partner cut, lender fees. JSON. */
    economicsJson: text('economics_json'),
    /** When the config was last published live. */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: text('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    brandUnique: uniqueIndex('vertical_configs_brand_unique').on(t.brand),
  }),
);

export type VerticalConfig = typeof verticalConfigs.$inferSelect;
export type NewVerticalConfig = typeof verticalConfigs.$inferInsert;

/* ---------- partner_marketplaces ----------
 *
 * Per-partner override of the vertical-level lender allowlist. A med
 * spa can be allowed/denied a specific lender independently of the
 * MedPay default (e.g. compliance exclusion, exclusivity, performance
 * pause). Replaces the `partnerAccessOverrides` map in
 * `lib/marketplace-data.ts`.
 *
 * Composite unique on (partner_id, lender_id) — a partner has at most
 * one override row per lender.
 */
export const partnerMarketplaces = pgTable(
  'partner_marketplaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: text('partner_id').notNull(),
    lenderId: text('lender_id').notNull(),
    /** 'enabled' | 'disabled' — disabled overrides the vertical default. */
    state: text('state').notNull(),
    reason: text('reason'),
    changedBy: text('changed_by').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerLenderUnique: uniqueIndex('partner_marketplaces_partner_lender_unique').on(
      t.partnerId,
      t.lenderId,
    ),
    partnerIdx: index('partner_marketplaces_partner_idx').on(t.partnerId),
  }),
);

export type PartnerMarketplace = typeof partnerMarketplaces.$inferSelect;
export type NewPartnerMarketplace = typeof partnerMarketplaces.$inferInsert;

/* ---------- mids (MiCamp merchant IDs) ----------
 *
 * One row per partner per MID. MiCamp can issue more than one MID per
 * merchant (different processors, different sub-merchants); we don't
 * assume a 1:1.
 *
 * `provisioning_status` walks: requested → underwriting_pre →
 * underwriting_post → active | rejected | paused. Auto-provisioning
 * lives in the `provisioning_state` JSON blob — the orchestrator
 * writes step status there.
 *
 * `rate_card_json` captures the interchange + processing fee schedule
 * agreed at provisioning time. Locked at issuance, updated on
 * re-negotiation only.
 */
export const mids = pgTable(
  'mids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: text('partner_id').notNull(),
    /** External MiCamp identifier — the number on the merchant's
     * processing statement. NULL until MiCamp returns it. */
    micampMid: text('micamp_mid'),
    /** requested | underwriting_pre | underwriting_post | active | rejected | paused */
    provisioningStatus: text('provisioning_status').notNull().default('requested'),
    /** JSON blob: per-step status from the auto-provisioning orchestrator. */
    provisioningStateJson: text('provisioning_state_json'),
    /** JSON blob: interchange % + processing fee schedule at issuance. */
    rateCardJson: text('rate_card_json'),
    /** When MiCamp flipped us from pre- to post-underwriting. */
    postUnderwritingAt: timestamp('post_underwriting_at', { withTimezone: true }),
    /** Rolling total of processing volume (cents) used to trigger the
     * pre→post underwriting flip. */
    volumeCentsToDate: bigint('volume_cents_to_date', { mode: 'number' }).notNull().default(0),
    /** Last settlement timestamp from the MiCamp webhook. */
    lastSettledAt: timestamp('last_settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index('mids_partner_idx').on(t.partnerId),
    statusIdx: index('mids_status_idx').on(t.provisioningStatus),
    micampMidUnique: uniqueIndex('mids_micamp_mid_unique').on(t.micampMid),
  }),
);

export type Mid = typeof mids.$inferSelect;
export type NewMid = typeof mids.$inferInsert;

/* ---------- decisions ----------
 *
 * One row per decision-engine evaluation. The engine runs at intake
 * (after HighSale pre-qual lands) and produces a propensity-ranked
 * list of lenders. We persist the full ranked output so:
 *   • The offer page can be re-rendered deterministically from history
 *   • Adverse-action notices can cite the specific eligibility rule
 *     that excluded a lender (Reg B compliance)
 *   • The ranking algorithm can be A/B tested against historical
 *     decisions without re-running HighSale pulls
 *
 * `ranked_lenders_json` shape:
 *   [{ lenderId, propensityScore, rank, reasonCode, included: bool }]
 *
 * `inputs_json` captures the HighSale pre-qual snapshot + intake form
 * data that produced the decision. Frozen at decision time.
 */
export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id').notNull(),
    /** Which engine produced this — 'trutopia' | 'internal' | 'fallback' */
    engine: text('engine').notNull(),
    /** Engine version / model identifier for replay. */
    engineVersion: text('engine_version').notNull().default('v1'),
    /** True when the persisted `engine` reflects a fallback path (e.g.
     * Trutopia upstream failed and the internal scorer produced the
     * decision). Required for audit integrity — without it, replays
     * cannot distinguish a clean Trutopia run from a fallback. */
    engineFallback: boolean('engine_fallback').notNull().default(false),
    inputsJson: text('inputs_json'),
    rankedLendersJson: text('ranked_lenders_json'),
    /** Top-line stats for fast dashboard reads without parsing JSON. */
    eligibleLenderCount: integer('eligible_lender_count').notNull().default(0),
    excludedLenderCount: integer('excluded_lender_count').notNull().default(0),
    topPropensityScore: integer('top_propensity_score'),
    /** Latency in ms for the engine call — observability metric. */
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    appCreatedIdx: index('decisions_app_created_idx').on(t.applicationId, t.createdAt),
    engineIdx: index('decisions_engine_idx').on(t.engine),
  }),
);

export type Decision = typeof decisions.$inferSelect;
export type NewDecision = typeof decisions.$inferInsert;

/* ---------- audit_log ----------
 *
 * Admin-action audit log. Distinct from `application_events` (which
 * is application-scoped). Every change made through the admin portal
 * (lender toggle, vertical config publish, partner approval, MID
 * pause, etc.) lands here.
 *
 * `target_type` + `target_id` form a polymorphic reference — common
 * values: 'lender' | 'partner' | 'vertical_config' | 'mid' | 'migration'.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Operator user id. */
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    /** Before/after snapshot or free-form context, JSON-encoded. */
    payloadJson: text('payload_json'),
    /** Source IP — for sensitive admin actions. NULL if unknown. */
    ipAddress: text('ip_address'),
    /** Source user agent. */
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorCreatedIdx: index('audit_log_actor_created_idx').on(t.actor, t.createdAt),
    targetIdx: index('audit_log_target_idx').on(t.targetType, t.targetId),
    createdIdx: index('audit_log_created_idx').on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;

/* ---------- customer_migrations ----------
 *
 * AI Funding Solutions → MedPay book migration queue. On launch day
 * (July 1) we walk every customer who closed during May–June through
 * a controlled migration onto the MedPay financial infrastructure:
 * HighSale sub-account, MedPay partner portal, Lender Marketplace,
 * MiCamp MID. Each customer is a row here so we can run the migration
 * in batches, see per-customer status, and retry failures.
 *
 * `step_state_json` shape:
 *   { highsale: 'pending|done|failed', marketplace: ..., micamp: ... }
 */
export const customerMigrations = pgTable(
  'customer_migrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** AI Funding customer id — opaque identifier from the source system. */
    sourceCustomerId: text('source_customer_id').notNull(),
    /** Destination partner row created during migration. NULL until partner exists. */
    targetPartnerId: text('target_partner_id'),
    sourceProduct: text('source_product').notNull().default('ai_funding'),
    targetBrand: brandEnum('target_brand').notNull().default('medpay'),
    /** queued | in_progress | completed | failed | rolled_back */
    status: text('status').notNull().default('queued'),
    stepStateJson: text('step_state_json'),
    failureReason: text('failure_reason'),
    /** When the migration was kicked off + completed. */
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('customer_migrations_status_idx').on(t.status),
    sourceUnique: uniqueIndex('customer_migrations_source_unique').on(t.sourceCustomerId),
  }),
);

export type CustomerMigration = typeof customerMigrations.$inferSelect;
export type NewCustomerMigration = typeof customerMigrations.$inferInsert;

/* ---------- provisioning_runs ----------
 *
 * One row per partner provisioning attempt initiated through the
 * orchestrator (`POST /api/onboarding/provision`). Distinct from `mids`
 * (which is keyed on the issued MiCamp MID and only captures one of
 * the four steps) because we want full audit history of every attempt,
 * including failed ones, retries, and cross-brand variants of the same
 * partner.
 *
 * `steps_json` is the full ProvisionStep[] array dumped at every
 * setStep() call. The orchestrator owns the shape — see
 * `lib/orchestrator/provision.ts`. Storing the whole array vs.
 * one-row-per-step is intentional: at four steps per run the JSON blob
 * stays tiny, queries are single-row, and the schema doesn't have to
 * evolve as we add/remove steps in the playbook.
 */
export const provisioningRuns = pgTable(
  'provisioning_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerId: text('partner_id').notNull(),
    /** Allows 'ai_funding' alongside the brand enum since migrated
     * runs carry the source product for audit; stored as text so the
     * brand enum doesn't have to gain a vestigial value. */
    brand: text('brand').notNull(),
    /** queued | running | completed | failed */
    status: text('status').notNull().default('queued'),
    /** JSON-encoded ProvisionStep[]. Rewritten on every step transition. */
    stepsJson: text('steps_json'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    partnerIdx: index('provisioning_runs_partner_idx').on(t.partnerId),
    statusIdx: index('provisioning_runs_status_idx').on(t.status),
    startedAtIdx: index('provisioning_runs_started_at_idx').on(t.startedAt),
  }),
);

export type ProvisioningRun = typeof provisioningRuns.$inferSelect;
export type NewProvisioningRun = typeof provisioningRuns.$inferInsert;

/* ---------- webhook_inbox ----------
 *
 * Write-then-200 inbox for inbound provider webhooks. Every signed +
 * verified delivery lands here BEFORE we ack — async processing then
 * drains the inbox.
 *
 * Why: upstream providers treat 200 as "delivered, never retry". If we
 * ack 200 and process inline, a crash mid-handler silently drops the
 * event. Conversely, if we ack 5xx after partial processing, upstream
 * retries and we double-apply state changes. The fix is the inbox
 * pattern: persist atomically, ack 200 immediately, process from the
 * inbox in a worker that owns its own retry/backoff.
 *
 * Idempotency: the unique index on (provider, event_id) means a
 * provider replay (which DOES happen — MiCamp, Stripe, every webhook
 * source resends on missed acks) collides at INSERT time and we no-op.
 * The provider's own event id is the dedupe key — never our own clock.
 *
 * `processing_status` walks: pending → processing → done | failed.
 * Failed rows with attempts < 5 are picked up by the next poll;
 * attempts >= 5 are left for ops review (eventual DLQ table).
 *
 * `raw_body` is the verbatim wire bytes so we can replay the handler
 * after a bugfix without re-asking the provider for the event.
 */
export const webhookInbox = pgTable(
  'webhook_inbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 'micamp' | 'highsale' | 'trutopia' — extend as providers land. */
    provider: text('provider').notNull(),
    /** Provider's external event id. Defensive extraction at write
     * time (MiCamp uses `id`, HighSale uses `event_id`, etc.). */
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    /** Verbatim JSON payload from the wire. Used by the worker to
     * reconstruct the typed event, and kept indefinitely for audit. */
    rawBody: text('raw_body').notNull(),
    signatureHeader: text('signature_header'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    /** 'pending' | 'processing' | 'done' | 'failed' */
    processingStatus: text('processing_status').notNull().default('pending'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => ({
    /** Composite unique = idempotency key. Provider replays collide here. */
    providerEventUnique: uniqueIndex('webhook_inbox_provider_event_unique').on(
      t.provider,
      t.eventId,
    ),
    /** Worker poll: status='pending' ORDER BY received_at ASC. */
    statusReceivedIdx: index('webhook_inbox_status_received_idx').on(
      t.processingStatus,
      t.receivedAt,
    ),
    providerReceivedIdx: index('webhook_inbox_provider_received_idx').on(t.provider, t.receivedAt),
  }),
);

export type WebhookInboxRow = typeof webhookInbox.$inferSelect;
export type NewWebhookInboxRow = typeof webhookInbox.$inferInsert;

/* ---------- idempotency_keys ----------
 *
 * Caller-supplied idempotency keys for state-changing routes. Use
 * pattern (future routes):
 *   1. Caller sends `Idempotency-Key: <uuid>` on a POST.
 *   2. Route looks up (scope, key). On hit, return stored response
 *      verbatim. On miss, run the operation + write the response.
 *
 * `scope` is a route-specific namespace (e.g. 'application_create',
 * 'mid_provision') so the same key from two different routes does NOT
 * collide. `response_hash` is sha256 of the canonical response body —
 * lets us detect when a caller reuses a key with a different request
 * shape (which is a caller bug, return 422).
 *
 * `expires_at` is set per-scope. After expiry the row is reclaimed by
 * a sweeper; the unique index lets the same key be reused thereafter.
 *
 * This migration only establishes the table — concrete usage lands
 * in a follow-up that wires the application_create + mid_provision
 * routes through it.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Route-scoped namespace, e.g. 'application_create'. */
    scope: text('scope').notNull(),
    /** Caller-provided idempotency key — verbatim. */
    key: text('key').notNull(),
    /** sha256 of canonical response body. Detects key reuse with
     * different request shape (caller bug → 422). */
    responseHash: text('response_hash').notNull(),
    statusCode: integer('status_code').notNull(),
    responseBody: text('response_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    scopeKeyUnique: uniqueIndex('idempotency_keys_scope_key_unique').on(t.scope, t.key),
    expiresIdx: index('idempotency_keys_expires_idx').on(t.expiresAt),
  }),
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKeyRow = typeof idempotencyKeys.$inferInsert;
