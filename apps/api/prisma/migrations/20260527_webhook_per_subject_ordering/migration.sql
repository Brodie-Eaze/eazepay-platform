-- Per-subject in-order delivery for outbound webhooks.
--
-- Pre-fix: WebhookDispatcher.drain orders by createdAt and enqueues
-- whatever is pending. With workers consuming the queue in parallel
-- (concurrency = WORKER_CONCURRENCY, per-merchant cap = 2), two
-- events for the SAME subject_id (e.g. application_id) could be
-- delivered out of order — `application.approved` after
-- `application.funded` — because nothing prevents a later-sequenced
-- row from being claimed while an earlier one is still in_flight or
-- pending.
--
-- Post-fix: every row gets a monotonically increasing BIGSERIAL
-- `sequence`. The drain selector excludes any row that has an
-- earlier-sequenced sibling for the same subject_id still in
-- {pending, in_flight}. Rows with NULL subject_id (no anchor) are
-- not gated — they're naturally independent.
--
-- Backfill: existing rows get a `sequence` derived from `created_at`
-- ordering (oldest = lowest sequence), then we attach the sequence
-- generator default for new rows. Pre-existing rows that were
-- already in terminal states (delivered/failed/dead_letter) don't
-- participate in the head-of-line predicate, so backfill value
-- ordering only matters for any pending/in_flight rows mid-migration.
ALTER TABLE "webhook_deliveries"
  ADD COLUMN "sequence" BIGINT;

-- Backfill using created_at, then id as a stable tiebreaker. id is a
-- UUIDv4 (random) so it's only a deterministic tiebreaker for the
-- backfill snapshot, not a meaningful global order.
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM "webhook_deliveries"
)
UPDATE "webhook_deliveries" wd
   SET "sequence" = numbered.rn
  FROM numbered
 WHERE wd.id = numbered.id;

-- Create a sequence object and attach as the default. Start strictly
-- AFTER the highest backfilled value so new inserts don't collide
-- with backfilled values.
CREATE SEQUENCE "webhook_deliveries_sequence_seq" AS BIGINT;
SELECT setval(
  'webhook_deliveries_sequence_seq',
  COALESCE((SELECT MAX("sequence") FROM "webhook_deliveries"), 0) + 1,
  false
);

ALTER TABLE "webhook_deliveries"
  ALTER COLUMN "sequence" SET DEFAULT nextval('webhook_deliveries_sequence_seq'),
  ALTER COLUMN "sequence" SET NOT NULL;

ALTER SEQUENCE "webhook_deliveries_sequence_seq"
  OWNED BY "webhook_deliveries"."sequence";

-- Unique guarantees the predicate's "earlier" comparison is well-defined.
CREATE UNIQUE INDEX "webhook_deliveries_sequence_key"
  ON "webhook_deliveries" ("sequence");

-- Index supporting the head-of-line correlated subquery: scan by
-- subject_id and filter on status. Partial-index it to the only
-- statuses the predicate cares about — keeps it small and hot.
CREATE INDEX "webhook_deliveries_subject_head_of_line_idx"
  ON "webhook_deliveries" ("subject_id", "sequence")
  WHERE "status" IN ('pending', 'in_flight') AND "subject_id" IS NOT NULL;
