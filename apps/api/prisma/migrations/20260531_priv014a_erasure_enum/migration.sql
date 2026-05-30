-- PRIV-014 (a) — add the ComplianceReviewKind value that anchors a
-- right-to-erasure run. Split into its own migration because
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on
-- PostgreSQL < 12 and, even where supported, the new value is not usable
-- until the surrounding transaction commits. Keeping it alone (and FIRST,
-- by lexical order) lets the table DDL in 20260531_priv014b reference it
-- safely.

ALTER TYPE "ComplianceReviewKind" ADD VALUE IF NOT EXISTS 'data_erasure';
