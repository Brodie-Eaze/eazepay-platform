# ADR-0023: BullMQ for async orchestration

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

Three workloads in the partner-portal app are async by nature: MID
provisioning (seconds-to-minutes, chains MiCamp + EZ-Check + Highsale
calls), the July 1 migration cutover (~500 merchants moving off the
legacy stack), and webhook processing (per ADR-0025).

Until Builder G's pass, these ran inline via `setImmediate` or a
`setInterval` poller. `setImmediate` dies with the request process,
has no retry, no visibility, and saturates the API node when queue
depth grows. The cron poller had no DLQ — a job that failed three
times in a row had to be re-discovered manually.

We need durable jobs, retries, a dead-letter path, and workers that
scale independently of the web tier.

## Decision

Adopt **BullMQ** as the queue layer. Three queues:

- `provisioning` — `lib/queue/provisioning.ts`
- `migrations` — `lib/queue/migrations.ts`
- `webhooks` — `lib/queue/webhooks.ts`

Each has a typed `enqueueXxx()` helper, a worker in
`lib/workers/*`, and a DLQ surface in `lib/queue/dlq-inspector.ts`.
Workers are deployed as a **separate Railway service**
(`railway.workers.toml`) booted from `scripts/start-workers.ts`. The
web tier never runs workers in-process in prod.

Retry policy: 3 attempts with exponential backoff (1s / 5s / 25s).
After the third failure, BullMQ's `'failed'` event moves the job to
a per-queue DLQ inspectable from the admin console. Idempotency-key
handling lives in the job payload (per ADR-0015) so redelivery is
safe.

## Options considered

1. **Keep `setImmediate` / setInterval** — no infra change but no
   durability, retry, or visibility. Catastrophic at the migration
   cutover where ~500 jobs need reliable completion.
2. **Postgres-backed queue (pg-boss, graphile-worker)** — reuses
   the existing Postgres dependency. Real option. Rejected because
   we already have Redis for idempotency-key storage (ADR-0015),
   job-state churn would compete with transactional traffic on the
   same DB, and BullMQ's tooling ecosystem is more mature.
3. **BullMQ** _(chosen)_ — Redis-backed, simple Job API, DLQ via
   the standard `'failed'` event, plays nicely with existing
   connection patterns.
4. **Temporal / Inngest** — better fit for long-running stateful
   workflows. Overkill for seconds-to-minutes jobs; new vendor, new
   SDK, new operational learning right before a cutover.
5. **SQS + Lambda** — would scale to zero but introduces a new
   platform (we're on Railway), new IAM, and moves us away from the
   unified Node monolith (ADR-0010).

## Consequences

**Positive:**

- Durable job state. A worker crash mid-migration is recoverable.
- Independent scaling. The July 1 cutover can run 20 migration
  workers in parallel without touching the web tier.
- Real DLQ. Failed jobs are inspectable and re-runnable from the
  admin console.
- Retry semantics live in the queue, not in every handler.

**Negative / accepted trade-offs:**

- Redis is now a hard production dependency. Mitigated by
  ADR-0022's graceful degradation and a boot guard that rejects a
  prod deploy without `REDIS_URL`.
- Two deploy targets. The workers service has its own Dockerfile,
  env vars, and rollback story. Engineers have to remember "deploy"
  means both.
- Local end-to-end tests of queue paths need a Redis container.
- BullMQ-specific quirks (active/waiting/delayed states,
  job-completion polling) are now load-bearing knowledge for
  on-call.
- Worker memory leaks are an operational concern; we restart
  worker pods on schedule and alert on RSS growth.

**Reversibility:** Medium. The enqueue / worker interface is narrow
enough that swapping backends is a focused refactor (~1 week). The
operational muscle memory and BullMQ-introspection dashboards would
all need rewrites.

## References

- `apps/partner-portal/lib/queue/index.ts`
- `apps/partner-portal/lib/queue/{provisioning,migrations,webhooks}.ts`
- `apps/partner-portal/lib/queue/dlq.ts` / `dlq-inspector.ts`
- `apps/partner-portal/lib/workers/`
- `apps/partner-portal/scripts/start-workers.ts`
- `railway.workers.toml`
- ADR-0015 (idempotency keys)
- ADR-0022 (graceful degradation — `hasQueue()`)
- ADR-0025 (webhook inbox — primary consumer)
