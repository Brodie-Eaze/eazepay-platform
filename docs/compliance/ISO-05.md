# Tenant isolation + audit integrity (ISO-05 / ISO-02 / EX-005 / ISO-03)

> SOC 2 CC6.1, CC6.6 (logical access / tenant isolation), CC7.2, CC8.1
> (audit-trail integrity); FCRA §604(a)(2) [15 U.S.C. § 1681b]
> (consent-receipt immutability + permissible-purpose evidence).
> Owner: CCO + Engineering lead. Remediation PR: `fix/soc2-rls-audit-integrity`.
> Date: 2026-05-31.

Four coupled findings from the isolation assessment, all in
`apps/partner-portal`, all P1. Defense-in-depth tenant isolation in
this app rests on Postgres RLS (migration 0013) plus app-layer guards;
these findings closed the gaps where the RLS backstop was missing,
mis-scoped, or where audit failures were invisible.

## Table coverage delta

Before: RLS (ENABLE + FORCE + tenant policy) on **8** of the **18**
partner-portal tables. After: **11** of 18 (every tenant-bearing
table), with the remaining 7 documented as legitimately
operator-only / global.

| Table                        | Tenant column               | RLS before | RLS after                     |
| ---------------------------- | --------------------------- | ---------- | ----------------------------- |
| applications                 | partner_id                  | yes        | yes                           |
| application_events           | via application_id          | yes        | yes                           |
| offers                       | via application_id          | yes        | yes                           |
| decisions                    | via application_id          | yes        | yes                           |
| mids                         | partner_id                  | yes        | yes                           |
| partner_marketplaces         | partner_id                  | yes        | yes                           |
| partner_highsale_subaccounts | partner_id                  | yes        | yes                           |
| audit_log                    | via target_id / target_type | yes        | yes (policy widened — ISO-02) |
| **provisioning_runs**        | partner_id                  | **no**     | **yes (0020)**                |
| **customer_migrations**      | target_partner_id           | **no**     | **yes (0020)**                |
| **consent_receipts**         | partner_id (nullable)       | **no**     | **yes (0020)**                |
| partners                     | — (tenant registry)         | n/a        | exempt                        |
| lenders                      | — (global catalogue)        | n/a        | exempt                        |
| vertical_configs             | — (per-brand global)        | n/a        | exempt                        |
| webhook_inbox                | — (global ingest buffer)    | n/a        | exempt                        |
| idempotency_keys             | — (global, scope+key)       | n/a        | exempt                        |
| welcome_tokens               | — (keyed on user/token)     | n/a        | exempt                        |
| outbox_events                | — (global outbox)           | n/a        | exempt                        |

Exempt = no tenant column; forcing a `partner_id` predicate would be a
broken policy (`partners` is the tenant directory itself; the rest are
global/operator-managed).

## ISO-05 — RLS coverage completion

**Was wrong:** `provisioning_runs`, `customer_migrations`,
`consent_receipts` shipped with NO RLS, contradicting the 0013
docblock's "every tenant-scoped table" claim. Isolation rested 100% on
app-layer `WHERE partner_id = ?` predicates — the single-missing-
predicate leak class 0013 set out to kill. Proven at the DB layer: a
`p_acme` partner session under the constrained `eazepay_service_role`
saw 2 of 2 `provisioning_runs` and 2 of 2 `customer_migrations` rows
(should be 1 each).

**Fix:** `drizzle/0020_rls_coverage_completion.sql` — ENABLE + FORCE
ROW LEVEL SECURITY + a `tenant_isolation` policy on each, mirroring
EXACTLY the 0013 shape, GUC names (`app.current_partner_id`,
`app.role`), and role model. `customer_migrations` scopes on
`target_partner_id` (its tenant column). `current_setting(..., true)`
returns NULL on a context-less connection, so an unbound session fails
CLOSED — same contract as 0013.

**How it satisfies the control (CC6.1/CC6.6):** isolation is now
enforced by Postgres on every query the BFF makes (the app role is
NOBYPASSRLS), not by remembering a predicate per route. Verified: post-
fix the same partner session sees 1 row each; operator sees all;
role=none sees 0 (fail-closed).

## ISO-02 — FCRA audit row admitted (audit_log policy widening)

**Was wrong:** the 0013 `audit_log` WITH CHECK admitted INSERTs only
when actor is operator OR `target_type='partner'`. The FCRA soft-pull
evidence row (`apps/partner-portal/app/api/integrations/highsale/prequal/route.ts`:
`actor='consumer:prequal'`, `action='credit_pull.soft'`,
`target_type='application'`) writes under a partner-role session, so
the INSERT was silently REJECTED by RLS — §1681b permissible-purpose
evidence dropped. It "worked" only because every live demo session
resolves to role='operator'. Proven: the INSERT raised `new row
violates row-level security policy for table "audit_log"` under a
partner session.

**Fix:** 0020 replaces the `audit_log` policy, adding an application-
scoped branch: a partner may write a `target_type='application'` row
IFF the referenced application belongs to that partner (EXISTS subquery
into `applications`, mirroring the offers/decisions policies in 0013;
the subquery is itself RLS-scoped, so a partner cannot satisfy it for
another tenant's application). `applications.id` is uuid, `audit_log
.target_id` is text — hence the `a.id::text` cast.

**How it satisfies the control (CC8.1 / FCRA §1681b):** the FCRA
permissible-purpose row now lands under a real account session, while a
partner still cannot forge an audit row against another tenant's
application. Verified: own-app row INSERTED; forged other-tenant row
and nonexistent-app row both REJECTED; operator still writes any
target_type.

## EX-005 — consent-receipt immutability

**Was wrong:** `drizzle/0011_consent_receipts.sql` REVOKEd UPDATE/DELETE
from the role `authenticated`, which does not exist in this DB (a
Supabase-template leftover). The REVOKE was guarded by `IF EXISTS (...
rolname='authenticated')`, so it never ran. The FCRA consent receipt —
the legal artifact proving a consumer authorized a specific soft pull —
was fully mutable by the app role. Proven: as `eazepay_service_role`,
`UPDATE consent_receipts SET raw_text='TAMPERED'` and `DELETE FROM
consent_receipts` both succeeded.

**Fix:** `drizzle/0021_consent_receipts_immutability.sql` — REVOKE
UPDATE/DELETE/TRUNCATE from `eazepay_service_role` + PUBLIC, plus a
BEFORE UPDATE/DELETE/TRUNCATE trigger that RAISES (mirrors the
`audit_log` treatment in 0019). **RTBF carve-out:** unlike `audit_log`
(immutable to everyone), the trigger EXEMPTS `eazepay_migration_role`
so the right-to-be-forgotten crypto-shred can still zero the encrypted
PII columns — honouring the 0011 docblock's RTBF requirement. Every
other role (service role, re-grants, PUBLIC) is blocked.

**How it satisfies the control (FCRA §604(a)(2)):** a captured consent
receipt is now tamper-evident and non-erasable from the application,
while RTBF remains operable via the privileged role. Verified: INSERT
allowed; UPDATE/DELETE/TRUNCATE blocked for the app role; crypto-shred
via the migration role allowed.

## ISO-03 — audit writes fail loud

**Was wrong:** `lib/audit-log.ts::writeAuditLog` (and the FCRA writer
`writeFcraAuditLog` in the prequal route) swallowed write failures into
a generic `*.write_failed` log line, indistinguishable from routine
noise. A row rejected by RLS (e.g. the ISO-02 case) vanished silently.

**Fix:** both catch blocks now emit a dedicated high-signal event
(`audit_log.write_dropped` / `audit_log.fcra.soft_pull.write_dropped`)
tagged `severity: 'critical'`, `alert: true`, `control` (`SOC2-CC8.1`
/ `FCRA-1681b`), and `compliance_gap`. Still non-throwing — audit is a
side-channel and the mutation it described already happened; surfacing
a 500 would neither restore the row nor undo the mutation, only hide
the success. But a dropped row now trips log-based alerting instead of
being invisible.

## The ISO-01 trap — why consent_receipts is NOT strictly scoped

`consent_receipts` is read/written by the FCRA verifier
(`lib/consumer-consent-server.ts::verifyFCRAConsent` →
`lib/db/consent-receipts.ts::getReceiptById`) and the consumer-capture
writer (`storeConsentReceipt` → `storeReceipt`). **Both run through
`getDb()` with NO `withTenantContext`** — there is no partner session
during a public consumer apply flow, and `partner_id` is frequently
NULL on the row.

A strict `partner_id = current_setting('app.current_partner_id')`
policy under FORCE RLS therefore returns ZERO rows for that no-GUC
path. Proven empirically: with a naive strict policy, the verifier
lookup returned 0 rows → every soft-pull consent verification would
412 and the entire apply funnel would break. This is the ISO-01
"bare SELECT with no GUC returns zero rows under FORCE RLS" hazard.

The same property already holds for the existing covered tables: under
`eazepay_service_role` with no GUC, `lookupOwnerPartnerId`
(`lib/server-guards.ts`) reads of `applications` / `mids` /
`partner_highsale_subaccounts` ALSO return 0 rows today. So
`provisioning_runs` (which that helper also reads, with no GUC) behaves
identically to the already-shipped tables — **no NEW regression is
introduced.** In production this lookup is reached only after the
`isAdminOverride` short-circuit (all live sessions are demo-operator),
so it is not exercised by non-admin partners today.

**Decision:** the `consent_receipts` policy admits (a) operator,
(b) the trusted no-context server path
(`coalesce(current_setting('app.role', true), '') = ''`, i.e. NULL or
empty — a fresh pooled connection vs. a RESET / `set_config(...,'')`),
and (c) the owning partner. The real at-rest control for this table is
the append-only REVOKE + trigger (EX-005); the RLS policy is the
defense-in-depth scoping for any FUTURE partner-session read (e.g. a
partner dispute viewer) without regressing today's flow.

### HUMAN SIGN-OFF REQUIRED

The `role IS NULL / ''` branch on `consent_receipts` is a deliberate,
documented **fail-open for the no-context path** — the one place in
this PR that departs from the strict fail-closed model used everywhere
else. It is correct given the un-wrapped FCRA verifier/capture paths,
but a reviewer should confirm one of:

1. Accept the branch as-is (the immutability + app-layer CSRF/rate-
   limit/operator-only-GET controls are the real boundary for this
   table). — default, lowest-risk.
2. OR wrap `verifyFCRAConsent` + `storeReceipt` in an explicit
   server/consumer `withRawTenantContext(PUBLIC_CONSUMER_CONTEXT, ...)`
   and tighten the policy to drop the NULL/'' branch. This is a larger
   app-layer change (the capture path has no partner session, so there
   is no real `partner_id` to bind) and is deliberately out of scope
   for this minimal-diff PR.

Same lookup-helper caveat applies to `provisioning_runs`: if
`assertResourceOwnership` is ever exercised by a non-admin partner
session in production, `lookupOwnerPartnerId` must be wrapped in
`withTenantContext` (it currently is not — but this is pre-existing and
true of `application`/`mid`/`subaccount` today, not introduced here).

## Migrations

- `drizzle/0020_rls_coverage_completion.sql` — ISO-05 + ISO-02.
- `drizzle/0021_consent_receipts_immutability.sql` — EX-005.

Both are idempotent (ENABLE/FORCE no-op if set; DROP POLICY IF EXISTS
before CREATE; CREATE OR REPLACE FUNCTION; DROP TRIGGER IF EXISTS) and
carry a documented DOWN block at the file foot. The custom runner
(`scripts/migrate.ts`) is forward-only; rollback = a new migration that
pastes the documented down block. Numbering jumps 0019 → 0020 (the
0015–0018 slots were never used; the runner sorts `.sql` files
lexically, independent of the Drizzle meta journal).

## Tests / verification

- `lib/db/rls-coverage.spec.ts` — 14 live-Postgres assertions (ISO-05
  leak closed + operator + fail-closed; the FCRA no-GUC verifier path
  still reads; ISO-02 own-app admitted / forge rejected / operator any;
  EX-005 INSERT allowed, UPDATE/DELETE/TRUNCATE blocked, RTBF crypto-
  shred allowed). Gated on `TEST_DATABASE_URL`, mirroring
  `append-only.spec.ts`.
- `lib/audit-log.spec.ts` — added the ISO-03 fail-loud assertion (a
  rejected INSERT logs `audit_log.write_dropped` with severity/control/
  alert tags and does not throw).
- `lib/db/append-only.spec.ts` — the audit_log INSERT setup now binds an
  operator GUC in-txn so it is not incidentally rejected by the
  (pre-existing) audit_log FORCE-RLS WITH CHECK; the immutability
  assertions are unchanged.
- All four migration bodies were applied + re-applied (idempotency)
  against a real Postgres 16 with the actual 0001–0021 schema and the
  `eazepay_service_role` / `eazepay_migration_role` roles before commit;
  every bug was reproduced pre-fix and shown closed post-fix.
- Manual verification SQL is embedded at the foot of each migration.
