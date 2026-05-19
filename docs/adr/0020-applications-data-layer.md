# ADR-0020: Applications data layer — Postgres + Drizzle + dual-write cutover

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** Brodie (Founder), Head of Engineering, Platform Lead
- **Supersedes:** —

## Context

Until this change, every consumer application submitted through
`/apply/<brand>` lived only in the browser's `localStorage`. That was
fine for the demo path but doesn't scale and isn't real data:

- **Volume:** the production target is roughly **22,500 applications
  per day** — three verticals, ~500 partners on MedPay alone,
  10–20 apps/partner/day. `localStorage` holds only the submitter's own
  rows on a single device.
- **Multi-tenancy:** every partner portal must see real-time only **its
  own** applications. With the substrate sitting in each user's
  browser, the master view literally cannot count what a partner saw.
- **Audit / billing:** revenue (the $3/lead and 4% origination) is
  computed off application + settlement state. Numbers that live in
  browser storage aren't auditable and can't drive payouts.
- **Real-time:** partners expect new applications to land in their
  dashboard within seconds. That requires a server of record we can
  fan out from.

We need a server-side store, a write API the apply pages can dual-write
to, a read API both dashboards can query, and an upgrade path that is
**reversible** — we cannot ship a change that breaks the existing demo
flow if `DATABASE_URL` is missing or the schema migration is mid-roll.

## Decision

Introduce a Postgres-backed applications store with three layered
guarantees: tenant isolation, idempotency, and graceful degradation.
Concretely:

### 1. Storage

A single `applications` table in Postgres (Aurora in prod, per
ADR-0004), accessed through Drizzle ORM with the `node-postgres`
driver. Schema lives in
`apps/partner-portal/lib/db/schema.ts` and includes:

- `id uuid primary key default gen_random_uuid()`
- `brand applications_brand_enum not null`
  (`medpay | tradepay | coachpay`)
- `partner_id text not null` — soft FK; matches the canonical roster
  IDs in `master-data.ts` and the `partners` table seeded from it.
- consumer PII columns (`first`, `last`, `email`, `phone`) — see
  the compliance note below.
- `amount_cents bigint not null` (per ADR-0012).
- `tier`, `selected_lender`, `status` — nullable until the
  waterfall lands a match; status uses an enum
  (`submitted|in_review|approved|funded|declined`).
- `request_id text` with a **partial unique index** WHERE NOT NULL —
  the idempotency anchor.
- `created_at`, `updated_at` (trigger-maintained).

Three indexes drive the read paths:

- `(partner_id, created_at desc, id desc)` — per-partner dashboard.
- `(brand, created_at desc, id desc)` — admin view by vertical.
- `(brand, status, created_at desc, id desc)` — admin status filter.

A `partners` table holds the legal-name / email / niche roster, and
an `application_events` table is reserved for the SSE fanout work that
follows this PR (LISTEN/NOTIFY topic per partner_id).

### 2. Write API

`POST /api/v/<brand>/applications` is **public** (consumer-facing) and:

1. Validates the body with Zod.
2. Looks up `partnerId` in the `partners` table and confirms it
   belongs to the same `brand`. **Cross-brand or unknown
   partnerIds get downgraded to the `UNATTRIBUTED_PARTNER_ID`
   sentinel rather than silently attaching to a real partner.**
3. INSERTs `ON CONFLICT (request_id) DO NOTHING` for idempotency
   (per ADR-0015) — a retried POST returns the original row with
   `duplicate: true`.
4. Returns `201 Created` (or `200 OK` on the dedup branch).

### 3. Read APIs

Two read endpoints, both session-required:

- `GET /api/v/<brand>/applications` — partner-scoped, filtered to
  `partner_id IN (allowedPartnerIdsForBrand(session, brand))`. This
  is the same per-brand, per-session allowlist that closed the
  tenant-isolation gap in ADR-NN / PR #79.
- `GET /api/admin/applications` — operator-only
  (`session.mode === 'demo' && session.isOperator`). Non-operators
  receive `403 forbidden`.

Both use cursor pagination on `(created_at, id)` for stable ordering
at scale — required because at 22,500 inserts/day, offset paging
would be wrong by the second page during peak hours. Consumer names
returned to the wire are masked (`First L.`) on the partner endpoint;
the admin endpoint returns the full first-name + last initial, the
same mask the legacy table used.

### 4. Dual-write cutover

For the cutover window:

- Apply pages call **both** `saveSubmittedApp(...)` (synchronous,
  localStorage) **and** `submitApplicationToApi(...)` (fire-and-forget,
  POSTs to the API). The localStorage write never blocks on the API
  and the API write never blocks the apply flow.
- Dashboards call `fetchApplicationsForPartner` /
  `fetchAdminSubmittedApps`, which prefer the API and fall back to
  the localStorage substrate on `503 db_unavailable`, `403`, or any
  network error. The helper returns `{ source: 'api' | 'local', rows
}` so the UI can flip a "demo data" banner.
- A `hasDb()` guard means every API route returns `503` with a
  Problem-Details body when `DATABASE_URL` is unset, instead of
  500-ing on connection failure. That's what makes the cutover
  reversible: unset the env var, dashboards revert to localStorage
  with no UI change.

### 5. Operational scaffolding

- A custom checksum-tracked migrator (`scripts/migrate.ts`) keeps a
  `__drizzle_migrations` ledger and refuses to run if a previously
  applied file's SHA changed on disk.
- A seed script (`scripts/seed.ts`) UPSERTs the master partner
  roster from `lib/master-data.ts` so the FK target is always
  populated.
- The `pg` pool is a singleton stashed on `globalThis` to survive
  Next.js HMR without leaking connections.

## Alternatives considered

- **Move directly to the NestJS API service (per ADR-0002).**
  That's the long-term home, but the apply pages and dashboards
  live in the partner-portal Next.js app; routing every read
  through cross-service calls during the demo phase adds latency
  without value. The Next.js route handlers are temporary — they
  proxy the eventual NestJS endpoints with the same contract.
- **Use a serverless KV store (DynamoDB / Vercel KV).** Rejected;
  per-partner sort-key access patterns are a natural fit for
  Postgres indexes, the same DB hosts billing + audit (ADR-0004 /
  ADR-0011), and we already need relational joins for the master
  view.
- **Cut over without the localStorage fallback.** Rejected; the
  demo path is shipped on every preview link and a `DATABASE_URL`
  outage during sales calls would be unrecoverable. The dual-write
  cost is one HTTP request per submit and ~30 lines of helper code.
- **Synchronous server-side write only.** Would block the apply
  flow on any network blip. Fire-and-forget plus idempotency-key
  retry is the documented Stripe pattern (and ADR-0015).
- **Server-generated request IDs.** As in ADR-0015 — caller-supplied
  is the only shape that gives the client retry semantics. The
  apply page uses its in-form session id, which is stable across
  retries within the same form lifecycle.

## Consequences

**Easier:**

- Real-time partner dashboards become a single LISTEN/NOTIFY
  follow-up — the data is already in Postgres.
- Auditable application counts for billing.
- Multi-device partner access — partner sees their apps from any
  browser, not just the one that submitted them.
- Idempotent retries from flaky mobile uplinks.

**Harder:**

- One more service (Postgres) on the critical path. Mitigated by
  the localStorage fallback and the `503` graceful degradation.
- Schema migrations now have to be coordinated with deploys. The
  checksum migrator + idempotent migration SQL is the safety net.
- PII now lives in Postgres rather than on the device. See the
  compliance note.

## Compliance / risk notes

- **PII residency.** Consumer first / last / email / phone are
  stored unencrypted in this initial cut so the demo path stays
  intact. ADR-0016 (PII vault, envelope encryption) and ADR-0017
  (JIT unmask) are the production target — the `applications` table
  will move those columns into the vault as part of the next ADR
  and replace them with token references. This ADR is the
  pre-condition; the migration itself is a separate ADR + PR.
- **Tenant isolation.** The read path enforces partner allowlists
  computed from the session (`allowedPartnerIdsForBrand`); the
  write path validates partner ↔ brand and downgrades mismatches
  to the unattributed sentinel rather than letting them attach to
  a real partner. Same posture as PR #79's hardening.
- **Audit.** Every state transition will land on the
  transactional outbox (ADR-0011) once the SSE / event-bus
  follow-up ships. The `application_events` table is a placeholder
  for that wiring.
- **Idempotency.** `request_id` partial-unique index enforces the
  property at the storage layer — even if the API interceptor in
  ADR-0015 is bypassed, the DB won't accept a duplicate.
- **Backups.** Inherits ADR-0004's Aurora backup posture (PITR,
  cross-region snapshots).
