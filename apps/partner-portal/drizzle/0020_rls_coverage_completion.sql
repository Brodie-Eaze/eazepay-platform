-- ============================================================
-- 0020_rls_coverage_completion — close the RLS table-coverage gap
-- left by 0013 and widen the audit_log INSERT policy so the FCRA
-- soft-pull evidence row is actually admitted.
--
-- WHY
-- ---
-- 0013_rls_policies claims (docblock) to cover "every tenant-scoped
-- table", but it only ENABLE+FORCE'd RLS on 8 tables. Three
-- tenant-bearing tables shipped with NO database backstop, so their
-- isolation rested 100% on app-layer `WHERE partner_id = ?` predicates
-- — exactly the single-missing-predicate leak class 0013 set out to
-- kill (ISO-05). A `p_acme` partner session could read every other
-- partner's `provisioning_runs` and `customer_migrations` rows.
--
-- This migration:
--   1. (ISO-05) ENABLE + FORCE RLS + a tenant_isolation policy on the
--      remaining tenant-bearing tables (provisioning_runs,
--      customer_migrations, consent_receipts), mirroring EXACTLY the
--      policy shape / GUC names / role model used in 0013:
--        partner_id = current_setting('app.current_partner_id', true)
--        OR current_setting('app.role', true) = 'operator'
--      `current_setting(..., true)` returns NULL on a context-less
--      connection so an unbound session fails CLOSED (NULL never
--      equals anything) — same fail-closed contract as 0013.
--
--   2. (ISO-02) Replace the audit_log tenant_isolation policy. The
--      0013 policy admitted INSERTs only when the actor is operator
--      OR target_type='partner'. The FCRA permissible-purpose row
--      (lib .../highsale/prequal: actor='consumer:prequal',
--      action='credit_pull.soft') writes target_type='application'
--      under a partner-role session, so the INSERT was silently
--      REJECTED by RLS — §1681b evidence dropped. (It "works" on the
--      live demo only because every demo session resolves to
--      role='operator'.) The widened policy adds an application-scoped
--      branch that admits a partner's audit row IFF the referenced
--      application belongs to that partner — so the FCRA write lands,
--      but a partner still cannot forge an audit row against another
--      tenant's application.
--
-- TABLES DELIBERATELY EXEMPT (no tenant column → global / operator-only;
-- forcing a partner_id predicate would be a broken policy):
--   * partners          — the tenant *registry* itself; operator-managed
--                         global directory. (A partner reading its own
--                         row would key on `id`, not a tenant FK; the
--                         portal never reads this table through an
--                         RLS-constrained partner path.)
--   * lenders           — global lender catalogue, shared across tenants.
--   * vertical_configs  — per-brand global config, operator-managed.
--   * webhook_inbox     — global provider-event ingestion buffer; rows
--                         are not partner-scoped at write time.
--   * idempotency_keys  — global, namespaced by (scope, key).
--   * welcome_tokens    — keyed on user_id / token, not partner.
--   * outbox_events     — global transactional outbox.
--
-- consent_receipts — SPECIAL CASE, READ THIS:
--   The FCRA verifier hot path (lib/consumer-consent-server.ts
--   verifyFCRAConsent → getReceiptById) and the consumer capture write
--   (storeConsentReceipt) run through `getDb()` WITHOUT
--   `withTenantContext` — there is no partner session during a public
--   consumer apply flow, and `partner_id` is frequently NULL on the
--   row. A strict `partner_id = current_partner_id` policy under FORCE
--   RLS therefore returns ZERO rows for that no-GUC path, which would
--   412 every soft-pull consent verification and break the entire
--   apply funnel (the ISO-01 "bare SELECT with no GUC returns zero
--   rows" hazard, proven empirically before this migration was written).
--   So the consent_receipts policy admits the trusted server-side
--   no-context path (role IS NULL) IN ADDITION to operator + the
--   owning partner. The real immutability/at-rest control for this
--   table is the append-only REVOKE + trigger in 0021; this policy is
--   the defense-in-depth scoping for any FUTURE partner-session read
--   (e.g. a partner dispute viewer) without regressing today's flow.
--   See docs/compliance/ISO-05.md for the full rationale + the human
--   sign-off flag on the `role IS NULL` branch.
--
-- ROLES (created in 0013): eazepay_service_role (NOBYPASSRLS — the BFF),
-- eazepay_migration_role (BYPASSRLS — scripts/migrate.ts).
--
-- IDEMPOTENT — ENABLE/FORCE are no-ops if already set; every CREATE
-- POLICY is preceded by DROP POLICY IF EXISTS so a re-apply is safe.
--
-- REVERSIBLE — the down-migration is documented at the foot of this
-- file (DROP POLICY + NO FORCE + DISABLE per table; restore the prior
-- audit_log policy from 0013). We do not ship a .down.sql because the
-- custom runner in scripts/migrate.ts is forward-only by design; a
-- rollback is a NEW migration that pastes the documented down block.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. provisioning_runs — direct partner_id (nullable after 0008).
--    Same shape as the `applications` policy in 0013.
-- ----------------------------------------------------------------

ALTER TABLE "provisioning_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provisioning_runs" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "provisioning_runs";
CREATE POLICY tenant_isolation ON "provisioning_runs"
  USING (
    partner_id = current_setting('app.current_partner_id', true)
    OR current_setting('app.role', true) = 'operator'
  )
  WITH CHECK (
    partner_id = current_setting('app.current_partner_id', true)
    OR current_setting('app.role', true) = 'operator'
  );

-- ----------------------------------------------------------------
-- 2. customer_migrations — the tenant column is `target_partner_id`
--    (the destination partner created during the AI-Funding → MedPay
--    book migration). Nullable; a context-less session still fails
--    closed because NULL = NULL is NULL, not TRUE.
-- ----------------------------------------------------------------

ALTER TABLE "customer_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_migrations" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "customer_migrations";
CREATE POLICY tenant_isolation ON "customer_migrations"
  USING (
    target_partner_id = current_setting('app.current_partner_id', true)
    OR current_setting('app.role', true) = 'operator'
  )
  WITH CHECK (
    target_partner_id = current_setting('app.current_partner_id', true)
    OR current_setting('app.role', true) = 'operator'
  );

-- ----------------------------------------------------------------
-- 3. consent_receipts — see the SPECIAL CASE note in the header.
--    Admits: operator | the trusted no-context server path (FCRA
--    verifier + consumer capture, role IS NULL) | the owning partner.
--    Immutability is enforced separately in 0021.
-- ----------------------------------------------------------------

ALTER TABLE "consent_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_receipts" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "consent_receipts";
CREATE POLICY tenant_isolation ON "consent_receipts"
  USING (
    current_setting('app.role', true) = 'operator'
    -- Trusted server-side consumer path: the FCRA verifier + the
    -- consent capture writer run with NO GUC bound (no partner session
    -- exists during a public apply flow), so `app.role` is NULL on a
    -- fresh pooled connection and the empty string '' after a RESET /
    -- a set_config(...,'') — both mean "no tenant context". Admitting
    -- them keeps those flows working; a strict predicate here returns
    -- zero rows and 412s every soft pull (the ISO-01 hazard, proven
    -- empirically). HUMAN SIGN-OFF REQUIRED: docs/compliance/ISO-05.md.
    OR coalesce(current_setting('app.role', true), '') = ''
    OR partner_id = current_setting('app.current_partner_id', true)
  )
  WITH CHECK (
    current_setting('app.role', true) = 'operator'
    OR coalesce(current_setting('app.role', true), '') = ''
    OR partner_id = current_setting('app.current_partner_id', true)
  );

-- ----------------------------------------------------------------
-- 4. audit_log — widen the INSERT/SELECT policy so the FCRA soft-pull
--    evidence row (target_type='application') is admitted under a
--    partner session, scoped to applications the partner owns.
--
--    The application-scoped branch uses an EXISTS subquery into
--    `applications` (mirroring the offers/decisions policies in 0013).
--    The subquery is itself subject to the applications RLS policy, so
--    a partner can only satisfy it for an application whose partner_id
--    matches their GUC — they cannot forge an audit row against another
--    tenant's application id. applications.id is uuid; audit_log
--    .target_id is text, hence the `a.id::text` cast.
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS tenant_isolation ON "audit_log";
CREATE POLICY tenant_isolation ON "audit_log"
  USING (
    current_setting('app.role', true) = 'operator'
    OR (target_type = 'partner'
        AND target_id = current_setting('app.current_partner_id', true))
    OR (target_type = 'application'
        AND EXISTS (
          SELECT 1 FROM "applications" a
          WHERE a.id::text = "audit_log".target_id
            AND a.partner_id = current_setting('app.current_partner_id', true)
        ))
  )
  WITH CHECK (
    current_setting('app.role', true) = 'operator'
    OR (target_type = 'partner'
        AND target_id = current_setting('app.current_partner_id', true))
    OR (target_type = 'application'
        AND EXISTS (
          SELECT 1 FROM "applications" a
          WHERE a.id::text = "audit_log".target_id
            AND a.partner_id = current_setting('app.current_partner_id', true)
        ))
  );

-- ============================================================
-- VERIFICATION (run manually post-deploy as eazepay_service_role)
-- ============================================================
-- ISO-05 (leak closed):
--   SET app.current_partner_id='p_acme'; SET app.role='partner';
--   SELECT count(*) FROM provisioning_runs;     -- only p_acme rows
--   SELECT count(*) FROM customer_migrations;    -- only p_acme rows
--   SET app.role='operator';
--   SELECT count(*) FROM provisioning_runs;     -- all rows
--   SET app.role='none'; SET app.current_partner_id='';
--   SELECT count(*) FROM provisioning_runs;     -- 0 (fail-closed)
--
-- consent_receipts (FCRA flow intact):
--   RESET app.role; RESET app.current_partner_id;
--   SELECT count(*) FROM consent_receipts WHERE id='<receipt>'; -- 1 (verifier)
--   SET app.current_partner_id='p_other'; SET app.role='partner';
--   SELECT count(*) FROM consent_receipts WHERE id='<p_acme receipt>'; -- 0
--
-- ISO-02 (FCRA audit row admitted, forge rejected):
--   SET app.current_partner_id='p_acme'; SET app.role='partner';
--   INSERT INTO audit_log (actor,action,target_type,target_id)
--     VALUES ('consumer:prequal','credit_pull.soft','application','<p_acme app uuid>'); -- OK
--   INSERT INTO audit_log (actor,action,target_type,target_id)
--     VALUES ('consumer:prequal','credit_pull.soft','application','<p_other app uuid>'); -- REJECTED
--
-- ============================================================
-- DOWN MIGRATION (paste into a NEW forward migration to roll back)
-- ============================================================
--   DROP POLICY IF EXISTS tenant_isolation ON "provisioning_runs";
--   ALTER TABLE "provisioning_runs"  NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "provisioning_runs"  DISABLE  ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS tenant_isolation ON "customer_migrations";
--   ALTER TABLE "customer_migrations" NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "customer_migrations" DISABLE  ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS tenant_isolation ON "consent_receipts";
--   ALTER TABLE "consent_receipts"   NO FORCE ROW LEVEL SECURITY;
--   ALTER TABLE "consent_receipts"   DISABLE  ROW LEVEL SECURITY;
--   -- Restore the original audit_log policy verbatim from 0013 (the
--   -- operator OR target_type='partner' form).
--   DROP POLICY IF EXISTS tenant_isolation ON "audit_log";
--   CREATE POLICY tenant_isolation ON "audit_log"
--     USING (current_setting('app.role', true) = 'operator'
--            OR (target_type='partner'
--                AND target_id = current_setting('app.current_partner_id', true)))
--     WITH CHECK (current_setting('app.role', true) = 'operator'
--            OR (target_type='partner'
--                AND target_id = current_setting('app.current_partner_id', true)));
-- ============================================================
