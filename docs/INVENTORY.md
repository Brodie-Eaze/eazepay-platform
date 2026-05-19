# Platform inventory — what's real vs. theatre

**Date:** 2026-05-19
**Author:** Audit from two parallel passes (surface inventory + adversarial architecture review)
**Trigger:** Founder asked: "what's missing in this platform.. for some reason it doesn't feel solid"

This document maps every meaningful surface in the eaze-billing platform to its actual data source and status. It exists so we can stop guessing whether a number on screen is real, and so the next stabilization PRs can be prioritized against evidence instead of vibes.

## TL;DR

- **121 pages.** 3 read from Postgres (gated behind `hasDb()`). ~50 read from `lib/master-data.ts` fixtures. ~10 read from `localStorage`. The rest are inline-mocked.
- **27 API routes.** 2 are Postgres-backed. 10 `/api/v1/*` routes read from a hardcoded `SAMPLE_LENDERS` array. Stripe is an explicit stub. Auth proxies a backend that may or may not be deployed.
- **40 spec files.** **Zero** cover the new data layer (PR #80). `apps/partner-portal` has no `project.json` so **Nx-affected CI does not gate it**.
- **Observability: zero.** No Sentry, no Pino, no OpenTelemetry, no health route. Logging is `console.*` to Railway stdout. 30+ silent `.catch(() => ({}))` blocks.
- **PII:** consumer first/last/email/phone are stored as plaintext `text NOT NULL` in Postgres (PR #80). ADR-0016 (vault) was accepted 70 days ago and is unbuilt.
- **Decision engine:** does not exist. The "waterfall" is `Array.filter()` + `Array.sort()` with `Math.random()`-padded fake trace data.
- **Audit chain:** the `/audit` page reads a 14-row fixture from `master-data.ts`. The real ADR-0011 outbox model exists in `apps/api/prisma` but is disconnected from anything the founder looks at.

## Ship-stoppers (must fix before any prod traffic)

| #    | Problem                                                                   | File                                                                                                                 | Fix                                                                                                                                         | Eff. |
| ---- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| SS-1 | `DEMO_COOKIE_SECRET` undocumented; missing in prod → first request 500s   | `apps/partner-portal/lib/demo-cookie.ts:53-58`, `.env.example` (33 lines, no mention)                                | Document every env var in `.env.example`. Split `DEMO_COOKIE_SECRET` and `ACCOUNT_COOKIE_SECRET`. Add fail-fast boot probe in `lib/env.ts`. | 2h   |
| SS-2 | `apps/partner-portal` not in Nx → CI doesn't lint/typecheck/test/build it | no `apps/partner-portal/project.json` (every other app has one); `.github/workflows/ci.yml:35-55` uses `nx affected` | Add `project.json` mirroring `apps/api/`. Add unconditional smoke-build job on `apps/partner-portal/**` paths.                              | 3h   |

## Top trust gaps (ordered by impact)

### T1 — Four parallel application data sources

| Source                        | Lives at                                                                                                   | Read by          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| Postgres `applications` table | `lib/db/schema.ts`, gated by `hasDb()`                                                                     | 2 pages (PR #80) |
| `localStorage` substrate      | `lib/submitted-applications.ts`                                                                            | 8 pages          |
| Hardcoded fixtures            | `lib/master-data.ts` `applications` array                                                                  | ~12 pages        |
| Wall-clock synth              | `app/api/v/[brand]/applications/[id]/status/route.ts:23` — `Math.floor(Date.now()/15_000) % LADDER.length` | live-tracking UI |

No page can answer "is this the real number?" When billing goes live, the invoice will not match what any dashboard shows.

**Fix:** pick one substrate. Gate `master-data` fixtures behind `NODE_ENV !== 'production' && DEMO_MODE_ENABLED === 'true'`. Delete localStorage writers. Add a `<DataSourceBadge>` component every page renders so the operator can see "DB | fixture | synth" at a glance. **2-3 days.**

### T2 — Audit chain is a 14-row fixture

ADR-0011 mandates a transactional outbox. Reality:

- Model defined in `apps/api/prisma/schema.prisma:1329` (`AuditOutbox`) ✓
- Drain service real at `services/audit/src/audit-drain.service.ts` ✓
- Only sink is `local-fs-audit-sink.adapter.ts` (writes to disk)
- `partner-portal` does not import from `services/audit` at all
- `/audit` page reads `auditLog` from `master-data.ts` — 14 hardcoded rows
- `application_events` table exists in PR #80 schema but **no route inserts into it**

A regulator subpoena for state transitions on application X returns the same 14 rows for any X.

**Fix:** insert `application_events` rows inside the same Drizzle transaction as the `applications` insert. Add `prevHash` + `rowHash` columns. Build `/audit` off `application_events`. Until cold sink exists, point at an S3 bucket with Object Lock + 7yr retention. **3-5 days.**

### T3 — Decision engine doesn't exist

The "waterfall of lenders" that sales positions as the core product:

- `apps/partner-portal/lib/marketplace-data.ts:351-369` — `isLenderEnabledForPartner` is 3 lines of logic
- `apps/partner-portal/app/api/v1/orchestration/route/route.ts:44-58` — `Array.filter().sort((a, b) => a.apr_bps - b.apr_bps)`. The `trace.latency_ms` is `Math.floor(Math.random() * 120)`
- `services/orchestration/src/decision/` exists as real-looking NestJS module but **no BFF route imports it**
- 12 "lenders" are hardcoded fixtures; 3 of them have `pendingIntegration: { note: 'awaiting credentials' }` — i.e., explicitly not integrated

The first technical due-diligence call asks: "show me the routing decision for application X." Today's answer is a sorted array with a `Math.random()` latency.

**Fix:** import `services/orchestration` from the BFF. Promote `marketplace-data.ts` to a real `marketplace_lenders` Postgres table. Add a `routing_decisions` table that records policy version + input snapshot + eligible-set + winner, one row per evaluate. **1 week minimum.**

### T4 — PII plaintext in Postgres

PR #80 schema:

```
consumer_first text NOT NULL,
consumer_last text NOT NULL,
consumer_email text NOT NULL,
consumer_phone text NOT NULL,
```

ADR-0016 (envelope encryption + per-row data keys + KMS) was accepted 2026-03-08. ADR-0017 (JIT unmask) likewise. Neither is built. The schema comment claims "schema is identical either way — only the writer changes" but encrypted fields would be `bytea` plus a `data_key_id` FK; the current schema is not vault-compatible.

GLBA Safeguards Rule, NYDFS Part 500, state privacy laws all require encryption at rest with key management. The first bank-partner BSA/AML & IT-security questionnaire kills the deal.

**Fix (minimum bar, 1-2 weeks):**

1. Move PII columns to `bytea`. Add `data_key_id` column referencing a new `data_keys` table.
2. Mint a per-row data key on insert, wrapped by an env-held master key (KMS later, ENV now).
3. Add `pii_unmask_requests` + `pii_unmask_grants` tables.
4. Decrypt only inside a server function that always emits an `application_events` audit row of type `pii_read`.
5. Do not ship more PII routes until the writer encrypts.

### T5 — Three session systems, mode-coupled authorization

Three cookies coexist: `eazepay_at` (real backend), `eazepay_demo` (signed preset), `eazepay_account` (signed real session). `isOperator = session.mode === 'demo' && session.isOperator` — meaning a real signed-in admin has no canonical operator representation. `DEMO_MODE_ENABLED` defaults to `true`. Both cookies share a single signing secret.

**Fix (3-5 days):** add `actor_role` claim to the account cookie (`admin | operator | partner_admin | viewer`). Move all `isOperator` checks to `session.role === 'admin'`. Force `DEMO_MODE_ENABLED=false` in prod via Railway config. Split secrets per-cookie before any real launch.

### T6 — No observability, no health route

- No `/api/health` or `/api/ready` route exists.
- No Sentry. No Pino. No OpenTelemetry. Drizzle client has `logger: false`.
- `safe-log.ts` exists (good pattern) and is used in exactly 1 route.
- 8+ silent `.catch(() => ({}))` blocks inside server routes hide failures.
- In-process rate limit (`lib/edge-rate-limit.ts:18-26`) is defeated by Railway's default multi-replica scaling.

**Fix (1-2 days):** add `/api/health` pinging `SELECT 1`. Wire Sentry or Axiom (one env var). Replace silent catches with `safeLog.error`. Move rate limit to Upstash Redis.

### T7 — Stripe is a 100-line if-statement

`app/api/billing/stripe/create-setup-session/route.ts:50-100` returns `{ stub: true, redirect }` in stub mode and `501 live_mode_not_implemented` in live mode. `pnpm add stripe` has not been run. UI button reads "PAY SETUP FEE $10,000.00".

**Fix (4-6h):** either remove the Pay button until wired, or wire Stripe and add a `setup_fee_intents` table that records every click + outcome.

### T8 — Migrations are forward-only; seed script can pollute prod

- `drizzle/0001_init.sql` exists; no `*.down.sql`.
- `scripts/seed.ts` upserts the fixture roster (`p_atlas`, `p_helio`, `p_orion`...) into whatever DB it points at.
- Drizzle `meta/` directory is empty (no schema snapshots).

**Fix (4-6h):** add `_down.sql` per migration. Gate `db:seed` on `NODE_ENV !== 'production' || ALLOW_SEED=true`. Document the deploy command in `railway.toml`.

## Polished-but-fake surfaces

These look real enough to mislead a regulator, investor, or partner during a demo. They need either real data sources or explicit "DEMO DATA" banners — pick one per surface.

| Surface                              | What it looks like                                                    | What it actually is                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/settlements`                       | Weekly treasury — $1,212,400, `paid` / `in_flight` / `scheduled` rows | Hardcoded literal at `app/settlements/page.tsx:29-94`                                                                |
| `/audit`                             | Filterable, paginated audit feed                                      | 14 hardcoded rows in `master-data.ts`                                                                                |
| `/events`                            | Event-bus tail                                                        | Inline `EVENT_SEED` array                                                                                            |
| `/queues`                            | BullMQ inspector with depth/retry counts                              | Inline mock. Header comment falsely says "Reads from workers service stats endpoint."                                |
| `/dead-letter`                       | DLQ inspector                                                         | Inline mock                                                                                                          |
| `/insights` funnel                   | Funded `1_842`, FICO-band approval rates                              | Hand-tuned `mock-data.ts`                                                                                            |
| `/lender-marketplace/access` toggles | Per-partner override grid                                             | UI mutates local state; no API call                                                                                  |
| Stripe checkout buttons              | "PAY SETUP FEE $10,000.00"                                            | Bypass to onboarding; no charge, no record                                                                           |
| `/v/<brand>/billing`                 | Per-merchant invoices                                                 | Reads "the brand's first partner from master-data" — every signed-in merchant sees the same first partner's invoices |
| Apply flow offers                    | Lender offers with APR/term                                           | Computed from hardcoded `SAMPLE_LENDERS`                                                                             |

## Dead / orphaned routes

Routes that exist but aren't reachable from current nav, or duplicate canonical routes:

- `app/coach-pay/page.tsx` ← duplicate of `/coachpay`
- `app/trade-pay/page.tsx` ← duplicate of `/tradepay`
- `app/eaze-med-pay/page.tsx` ← old name still resolves
- `app/marketplace/page.tsx` + `app/marketplaces/page.tsx` ← both exist; canonical is `/lender-marketplace`
- `app/payouts/page.tsx` ← redirects to `/invoices`
- `app/payouts/[partnerId]/page.tsx` ← orphan; parent redirects away
- `app/v/[brand]/settlements/page.tsx` ← redirect-only
- `app/dialerpay/`, `eaze-affiliate/`, `eaze-ai/`, `eaze-processing/`, `marketing-consult/`, `sales-recruitment/`, `ez-check/` ← in nav but "Coming soon"-grade content
- `app/security/page.tsx`, `app/activity/page.tsx` ← no nav link
- `app/sales/*` (3 decks) + `app/landing/*` (multiple) ← 4000+ line client components shipping inside the partner-portal bundle

**Fix:** audit `_shell.tsx` nav vs filesystem. Delete orphans. Move `/sales/*` to a separate Nx app on a subdomain. **1 day.**

## Architectural smells

1. **Three parallel lender catalogs.** `lib/marketplace-data.ts` (UI), `lib/api-v1/shared.ts` (public API), `services/lender/src/adapters/` (NestJS scaffolds). No shared types. Drift silently.
2. **localStorage is the de-facto database.** 20 files write to it. With PR #80, applications now have 2 substrates AND an automatic fallback. No cutover criterion defined.
3. **Two `apps/`, one fate.** `apps/api` (NestJS) has real Prisma schema + AuditOutbox + billing service. `apps/partner-portal` doesn't import a single thing from it. The NestJS app could be deleted today with no UI change.
4. **Dual-write fallback with no exit.** `applications-client.ts:13-19` says "we'll delete the fallback once the API is verified" but defines no verified-criterion. Layer is destined for permanent residency.
5. **Cents accounting.** `master-data.ts:478` is `9_240_000_00` (units = ?). `page.tsx:104-108` formats it with `regex.replace(/\.\d+/, '').replace(',000,000', 'M')` — drops cents and substring-mangles into `$9M`. ADR-0012 mandates BigInt; schema uses `mode: 'number'` (opts out).

## PR #80 — honest assessment

What it shipped:

- Schema for `partners`, `applications`, `application_events` with sensible indexes ✓
- Idempotent migration with checksum-tracked migrator ✓
- POST `/api/v/<brand>/applications` with partner ↔ brand enforcement + unattributed sentinel ✓
- GET partner + admin endpoints with cursor pagination + tenant scoping ✓
- ADR-0020 explaining the design ✓

What it didn't ship:

- Any test covering the new write paths
- Any insert into `application_events` (the table is defined but never written to)
- Any PII encryption (consumer fields are plaintext)
- Any integration with `services/audit` for the outbox
- A `/api/health` route checking the DB connection
- A cutover criterion for removing the localStorage fallback

What it added to the trust deficit:

- Two more pages now read DB-or-localStorage, increasing the "which is real?" surface
- PII plaintext in a regulated context, with no documented migration to vault
- A `hasDb()` gate that silently falls back in prod if `DATABASE_URL` is unset

## Proposed stabilization track

Order matters. Each step unlocks the next.

### Week 1 — Don't deploy until these land

- **SS-1** Document env vars + split cookie secrets + fail-fast boot probe (2h)
- **SS-2** Add `project.json` so CI gates `partner-portal` (3h)
- **Source-of-truth banners.** Every page renders a `<DataSourceBadge>` (DB | fixture | synth). 1 day.
- **`/api/health` route + Sentry wire-up.** 1 day.

### Week 2 — Pick one source for applications

- Wire `DATABASE_URL` in Railway, run `db:migrate` (gated; no seed in prod).
- Delete the localStorage substrate. Make API mandatory; show "service unavailable" instead of fallback.
- Add `application_events` insert in the same transaction as `applications` insert. Hash-chain it.
- Build `/audit` off `application_events`.

### Week 3 — Make the decision engine real

- Promote `marketplace-data.ts` to `marketplace_lenders` Postgres table.
- Wire `services/orchestration/src/decision/` into the BFF routes.
- Add `routing_decisions` table (policy version + input snapshot + eligible-set + winner).

### Week 4 — PII vault + observability hardening

- Move PII columns to `bytea` + `data_key_id`.
- `pii_unmask_requests` + `pii_unmask_grants` tables.
- Every PII read emits `application_events` row.
- Replace 30+ silent `.catch()` blocks with `safeLog.error`.
- Sentry breadcrumbs on every route boundary.

### Week 5 — Cleanup

- Delete orphaned routes.
- Move sales decks to a separate Nx app + subdomain.
- Add `_down.sql` per migration.
- Lint-ban inline currency formatting; one shared formatter.
- Replace hardcoded KPIs on `/page.tsx` with DB-derived counts.

## What this document is not

This is not a roadmap commitment. It's an inventory + diagnosis. Each fix above has a sized estimate but no owner and no deadline yet. The point is to make the gap between "documented" and "built" visible enough that we stop guessing whether something is solid and start measuring.

## How to use this document

When someone asks "is X real?", check the surface inventory. If it says SEEDED / MOCKED / DEAD, that's your answer. If it says HYBRID, check which path is active right now (usually depends on `hasDb()` + session mode).

When prioritizing the next PR, anchor against the trust gaps (T1-T8) rather than feature requests. Closing a trust gap is leverage — it makes every downstream feature more credible. Adding another feature on top of T3 (no decision engine) is debt.
