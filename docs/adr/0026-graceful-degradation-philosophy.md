# ADR-0026: Graceful degradation philosophy — every external dependency has a fallback

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

The partner-portal app has five external dependencies on the critical
path of the application → decision → provision flow:

1. **Postgres** — primary OLTP (ADR-0004, ADR-0020)
2. **Redis / BullMQ** — async job queue (ADR-0023)
3. **HighSale** — pre-qual + agency sub-accounts (`lib/highsale/client.ts`)
4. **MiCamp** — MID provisioning + payment processing (`lib/micamp/client.ts`)
5. **Trutopia** — optional cloud decision engine (ADR-0021)

ADR-0022 already documents the DB / Redis fallback at the persistence
layer. This ADR generalises the same pattern into a **cross-cutting
philosophy** for _every_ external dependency in the system. The trigger
for writing it as a separate record: Iteration 2 added HighSale and
MiCamp stub fallbacks alongside the existing DB / Redis / Trutopia
fallbacks, and the pattern is now general enough that the next builder
needs to know "this is how we treat external deps," not "this is how DB
happens to behave."

The forces in play:

- **Demo-loop integrity.** A new engineer needs to `pnpm dev` and see
  the application → offers → provisioning flow render end-to-end
  _without_ signing into MiCamp, signing an NDA with Trutopia, or
  standing up Postgres and Redis. Friction here destroys onboarding
  velocity and ad-hoc preview deploys.
- **Single-dep outages should not be full outages.** If Trutopia is
  down we should still serve offers. If HighSale is rate-limiting us
  we should still process applications, just without fresh credit
  pulls. Cascading failure is a fintech-killer.
- **Observability of degraded mode is non-negotiable.** Silent
  fallback is worse than no fallback — we'd ship "everything works"
  while quietly losing audit fidelity. Every fallback path must emit
  a structured log so we know when we're running degraded and for
  how long.
- **Prod must refuse to degrade where it would be unsafe.** The DB
  fallback (in-memory `Map`) loses data on restart. Running that in
  prod is catastrophic. We need a boot-time gate that hard-fails
  prod deploys missing the required dependencies, even though the
  same code path is degradable in dev.

## Decision

Every external dependency in the partner-portal app conforms to the
following shape:

1. **Configured by env var.** If the env var is unset, the dependency
   is considered unavailable. There is no fallback to "guess at a
   reasonable default URL" — explicit configuration is the contract.
2. **Has a degraded-mode fallback** that returns a deterministic,
   structurally-valid response so the rest of the platform can
   continue to operate against a stable interface:
   - **Postgres** → module-scoped `Map<>` store (per ADR-0022)
   - **Redis / BullMQ** → in-process `setImmediate` execution of the
     job handler (per ADR-0023, gated by `hasQueue()`)
   - **HighSale** → synthetic happy-path response (`lib/highsale/client.ts`)
   - **MiCamp** → synthetic happy-path response (`lib/micamp/client.ts`)
   - **Trutopia** → the internal decision engine (per ADR-0021)
3. **Emits a structured log on every degraded-mode call.** The log
   carries `dependency`, `reason: 'env_missing' | 'timeout' | 'connection_error'`,
   `organization_id`, and the correlation ID. Aggregating these logs
   tells us, per environment, how often we're hitting the degraded
   path. In prod, any non-zero count is an incident signal.
4. **Boot-time prod gate.** `lib/env.ts` ships a `REQUIRED` list of
   env vars that must be present in `NODE_ENV=production`. If any
   are missing, the process refuses to boot. The degraded path is
   never legitimately exercised in prod; if it is, that's a
   misconfigured deploy and we want it to fail loudly before serving
   the first request.
5. **Timeout-based fallback for live dependencies.** Trutopia (the
   only "live with a fallback" dep — the others are all-or-nothing on
   env vars) has an 800ms hard timeout. Past 800ms we abandon the call,
   log `reason: 'timeout'`, and serve the internal engine result. This
   bounds tail latency at the cost of giving up on Trutopia in degraded
   network conditions — a trade we explicitly want.

## Options considered

1. **Hard-fail on any missing dependency** — simplest mental model,
   clean prod story. Rejected because it destroys the demo loop and
   makes preview deploys (which often lack one or more dependencies)
   unusable. Onboarding cost dominates the upside.
2. **Silent fallback** — degrade quietly to keep "uptime" high. Strongly
   rejected. The whole point of having a fallback is so we can choose
   when to live with reduced fidelity; silent fallback removes the
   choice and means we'd ship audit-incomplete data without knowing.
3. **Degraded mode toggled by an env flag (`DEGRADED=true`)** — explicit
   but ergonomically poor. Engineers forget to set it locally, then
   spend an hour debugging "why isn't HighSale responding" when the
   real problem is no `HIGHSALE_AGENCY_KEY`. The env-var-presence
   approach is self-documenting.
4. **Per-dependency philosophy with no shared rules** — what we had
   before this ADR. Each dependency had its own ad-hoc fallback (or
   none), engineers had to read each client to find out what was
   degradable. The pattern is now common enough to codify.
5. **Loud fallback with shared structured-log contract** _(chosen)_ —
   one mental model across every dependency, one log shape for ops to
   alert on, one boot gate to keep prod honest.

## Consequences

**Positive:**

- New engineer can run `pnpm dev` and see the full demo flow with zero
  external setup. Every degraded path emits a log line they can grep
  to understand what's stubbed.
- Single-dep outages degrade gracefully in prod: Trutopia timeout →
  internal engine, no end-user impact. We observe the timeout via
  logs and can decide whether to investigate or just live with it.
- The shape is reusable. The next external dependency we add (say, a
  KYC vendor or a credit-bureau direct connection) ships with the
  same shape: env-gated, fallback-defined, log-on-degraded,
  boot-required-in-prod.
- The audit story is honest. Every fallback invocation is logged with
  its reason; an examiner asking "did your decision engine ever run
  degraded during the period?" gets a queryable answer.

**Negative / accepted trade-offs:**

- Two implementations per dependency to keep aligned. The synthetic
  HighSale / MiCamp clients have to evolve alongside the real
  contracts, or local tests pass while integration fails. Mitigated
  by the same fixtures driving both code paths in tests.
- Degraded-mode logs are noisy in dev. Acceptable — that noise _is_
  the signal that something is stubbed. We don't filter it out.
- Risk that a prod incident silently flips to degraded mode and stays
  there. Mitigated by the boot-time gate (degraded mode can only be
  entered for `live` dependencies that timeout / error, not via
  missing env vars) and an alert at >0 degraded-mode invocations per
  hour in prod for each dependency.
- A future regression where a new dep is added without a fallback is
  invisible until someone tries to demo without it. Mitigated by
  documenting this ADR as the contract for "adding an external
  dependency" in the contributor guide.

**Reversibility:** Easy at the code level — the fallback branches are
narrow and removable per-dependency. Hard at the cultural level: once
contributors expect `pnpm dev` to "just work," removing the demo loop
would re-introduce onboarding friction we'd then have to absorb.

## References

- `apps/partner-portal/lib/env.ts` — `REQUIRED` list + boot gate
- `apps/partner-portal/lib/db/index.ts` — `hasDb()` + memory fallback
- `apps/partner-portal/lib/queue/index.ts` — `hasQueue()` + setImmediate fallback
- `apps/partner-portal/lib/highsale/client.ts` — synthetic stub when
  `HIGHSALE_AGENCY_KEY` unset
- `apps/partner-portal/lib/micamp/client.ts` — synthetic stub when
  `MICAMP_API_KEY` unset
- `apps/partner-portal/lib/decision-engine.ts` — internal scorer as
  fallback when Trutopia is unconfigured or times out
- ADR-0021 (decision engine — internal default, Trutopia opt-in)
- ADR-0022 (graceful in-memory fallback when DB / Redis are absent)
- ADR-0023 (BullMQ async orchestration + `hasQueue()`)
