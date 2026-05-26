# ADR-0025: Write-then-200 webhook inbox with idempotency

**Status:** Accepted
**Date:** 2026-05-26
**Deciders:** Brodie + Builder Council

## Context

Before this change, every webhook handler in the partner-portal
(`/api/integrations/micamp/webhook`, `/api/integrations/highsale/webhook`,
and friends) verified the HMAC, then returned `200 OK` with a TODO
body. No persistence, no processing, no audit trail. Builder D's
pass replaced that with a real receive path.

The constraints we are designing against:

- **Senders retry aggressively.** MiCamp and Highsale both follow
  the standard "if you don't return 2xx within N seconds, we redeliver"
  pattern. We have observed real duplicate deliveries of the same
  `event_id` in production logs.
- **Processing can be slow.** Some events trigger lender lookups, DB
  writes across multiple tables, and email/SMS fanout. Doing all of
  that inline blocks the sender and increases the chance of a retry
  while we're already processing the first delivery.
- **A 5xx is recoverable, dropping is not.** If we ack and crash
  before processing, the event is lost. The sender thinks we have it.
- **Compliance:** every webhook is a record of a state transition
  somewhere upstream. We must be able to show the original payload,
  the HMAC, and our processing outcome to an auditor.

## Decision

Webhook routes follow the **write-then-200** pattern:

1. **Verify** the HMAC signature against the raw body (per-provider
   shared secret). Failure → `401 invalid_signature` (RFC-7807, per
   ADR-0014) and **no log of the body** — we don't want unsigned
   payloads polluting our DB.
2. **Insert** into `webhook_inbox` with `ON CONFLICT (provider,
event_id) DO NOTHING`. The table holds `provider`, `event_id`,
   `event_type`, the raw payload (jsonb), `signature`, `received_at`,
   and a `status` column (`pending|processing|processed|failed`).
3. **On insert success** → enqueue an async processing job onto the
   `webhooks` BullMQ queue (per ADR-0023). Return `200 OK` with
   `{ received: true, duplicate: false }`.
4. **On insert conflict** (we've already seen this `event_id`) →
   skip the enqueue. Return `200 OK` with `{ received: true,
duplicate: true }`. The sender treats this identically to a
   first-delivery ack; replays are safe by construction.
5. **On DB failure** → return `503 webhook_inbox_unavailable`. The
   sender retries. We never partial-write.

The async worker
(`lib/workers/webhook-processor.ts`) picks the job up, transitions
`status: pending → processing`, runs the handler, transitions to
`processed` on success or `failed` with an error column on failure.
Failed jobs hit the DLQ after the retry policy in ADR-0023 exhausts;
they're inspectable from the admin console.

The uniqueness contract is enforced at the DB layer:
`uniqueIndex('webhook_inbox_provider_event_unique')` on
`(provider, event_id)`. That index is the last line of defence — even
if the application code regresses, the DB cannot double-process.

## Options considered

1. **Process inline, return 200 after processing** — simplest mental
   model. Rejected: blocks the sender for seconds (or longer if a
   downstream API is slow), increases retry rate, and means a crash
   mid-handler loses the event with no recovery.
2. **Enqueue without persisting (Redis-only)** — fast ack, but a
   Redis outage or worker crash before the job is durable loses the
   event silently. Audit story is also weak — we'd have no DB record
   of having received it.
3. **Persist to a write-ahead log (Kafka / Kinesis)** — over-engineered
   for our scale. We're at thousands of events/day, not millions/sec,
   and we'd be paying for a new platform to solve a problem Postgres
   already solves.
4. **Write-then-200** _(chosen)_ — DB INSERT is the durability
   boundary. Once the row exists, the event is ours; the queue is
   just a notification mechanism for the worker. Crash recovery is a
   single SQL query (`SELECT ... WHERE status IN ('pending','processing')`).

## Consequences

**Positive:**

- Replay-safe. Senders can redeliver the same event 100 times; only
  the first becomes work.
- Auditable. Every event we have ever acknowledged is in the
  `webhook_inbox` table with its raw payload and signature, queryable
  for any time range.
- Sender-friendly. We ack in tens of milliseconds (one INSERT + one
  enqueue), regardless of how long the actual processing takes.
- Crash-safe. A worker crash mid-handler leaves the row in
  `processing` state, and the next worker startup sweep can resume.
- Honest 5xx behaviour. If we can't durably accept the event, we
  refuse rather than silently drop.

**Negative / accepted trade-offs:**

- Storage cost. Every webhook payload is persisted in jsonb. At
  current scale this is negligible; at 10x growth we'll add a
  retention policy that archives `processed` rows older than 90 days
  to cold storage. Tracked, not solved.
- Two-phase latency. The sender's ack is fast, but the partner-facing
  "this lender approved your applicant" notification depends on the
  worker, not the inbox. Realtime SLA is a worker-side concern now.
- Worker backlog is a thing. If processing slows down, the inbox
  grows. We monitor queue depth and emit an alert at >1000 pending
  rows.
- The DB-layer uniqueness index assumes every sender provides a
  stable `event_id`. MiCamp and Highsale both do. If a future
  provider doesn't, we have to synthesise one (likely a content hash
  of the canonicalised payload) and document the choice per-provider.

**Reversibility:** Medium. The route → inbox → worker pattern is a
clean interface; replacing it with inline processing is a focused
refactor per route. What is _not_ reversible is the audit-trail
expectation — we can't go back to "no record of acknowledged events"
without breaking the compliance story.

## References

- `apps/partner-portal/lib/db/schema.ts` — `webhookInbox` table +
  `webhook_inbox_provider_event_unique` index
- `apps/partner-portal/app/api/integrations/micamp/webhook/route.ts`
- `apps/partner-portal/app/api/integrations/highsale/webhook/route.ts`
- `apps/partner-portal/lib/workers/webhook-processor.ts`
- `apps/partner-portal/lib/queue/webhooks.ts`
- ADR-0011 (audit via transactional outbox — same durability
  philosophy applied to outbound events)
- ADR-0014 (RFC-7807 problem details — error body shape)
- ADR-0015 (idempotency keys — same property enforced at the API
  layer for inbound HTTP)
- ADR-0023 (BullMQ — backing queue for async processing)
