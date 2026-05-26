# ADR-0022: Graceful in-memory fallback when DB / Redis are absent

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

Postgres persistence (Builder A) and BullMQ queues (Builder G, see
ADR-0023) made DB and Redis part of the critical path. That's
correct for prod and hostile everywhere else: local dev without
Docker running, preview deploys without a DB attached, contractor
laptops on day one. We previously shipped the demo flow from
`localStorage` for exactly this reason (ADR-0020) and want every new
persistent module to inherit the same property: _dev boots without
infrastructure; prod refuses to boot without it._

We do not want runtime `if (db) ... else ...` branches sprinkled
through handlers. We want one decision at boot, a typed guard
helper, and a documented degraded mode.

## Decision

Every persistence layer detects its backing service at boot, exposes
a `hasX(): boolean` predicate, and degrades gracefully when the
service is absent:

- `lib/db/index.ts` — `hasDb()` returns true iff `DATABASE_URL` is
  set and a pool was constructed.
- `lib/queue/index.ts` — `hasQueue()` returns true iff `REDIS_URL`
  is set and BullMQ connected.
- Each orchestrator keeps an in-memory `Map<>` fallback that
  satisfies the same interface as the Postgres-backed store.
- API routes respond with `503 db_unavailable` (RFC-7807, per
  ADR-0014) when `hasDb()` is false rather than 500-ing.

Production safety: `lib/env.ts` ships a `REQUIRED` list including
`DATABASE_URL` and `REDIS_URL`. In `NODE_ENV=production`, missing
entries crash the boot process before the first request lands. The
fallback is only ever exercised in dev / preview / test.

## Options considered

1. **Hard-require DB + Redis everywhere** — simplest mental model;
   breaks every local dev path that doesn't have Docker running and
   makes preview links fragile.
2. **Branch at every call site** — scatters degradation logic
   across handlers, easy to drift, impossible to assert "no prod
   code path uses the in-memory store."
3. **`hasX()` guards + interface-symmetric fallbacks** _(chosen)_ —
   one decision at boot, one branch at the module entry, one
   prod-gate via `env.ts`.
4. **Test-only stubs (jest mocks)** — keeps prod code clean but
   doesn't help the actual case we care about: running the
   partner-portal app locally without Postgres.

## Consequences

**Positive:**

- Local dev works with `pnpm dev` and nothing else running.
- Preview deploys without a DB attached still render.
- Reusable pattern — every new persistent module ships its own
  `hasX()` + memory fallback.
- Prod boot fails fast on missing env vars; fallback never runs in
  prod.

**Negative / accepted trade-offs:**

- Two implementations of every store interface. The memory branch
  must keep behavioural parity with SQL or tests silently lie.
  Mitigated by a shared spec suite running against both backings.
- Data is lost on process restart in degraded mode. Acceptable
  because degraded mode is documented as dev-only.
- Subtle bug class: prod code accidentally reading from the memory
  map after a transient connection failure. Mitigation: boot
  `REQUIRED` check rejects a prod deploy without `DATABASE_URL`,
  and runtime connection errors throw rather than silently flipping
  to memory.
- Slightly harder to reason about which path a request took. We
  log `storage=postgres|memory` on every persisted state change.

**Reversibility:** Easy. The in-memory branch is intentionally
narrow; deletion is a single PR removing the fallback and the
`hasX()` callers.

## References

- `apps/partner-portal/lib/db/index.ts` — `hasDb()`
- `apps/partner-portal/lib/queue/index.ts` — `hasQueue()`
- `apps/partner-portal/lib/orchestrator/provision.ts`
- `apps/partner-portal/lib/orchestrator/migration.ts`
- `apps/partner-portal/lib/env.ts` — `REQUIRED` list
- ADR-0020 (applications data layer — same dual-write posture)
