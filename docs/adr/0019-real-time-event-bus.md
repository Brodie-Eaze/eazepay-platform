# ADR-0019 — Real-time event bus

**Status:** Accepted · 2026-05-17

## Context

PRs #21–#24 stood up the billing surface end-to-end. The next user
ask is real-time visibility: salespeople in partner portals need to
see lender offers stream in while they're on the phone with a client,
and the master operator's command-centre needs a live activity feed
that surfaces everything happening across every tenant — invoice
events, lender offers, dispute decisions, etc. — without page
refreshes.

Two design tensions:

1. **Per-tenant isolation vs. master visibility.** A partner must
   only see events scoped to their merchant. A master operator must
   see everything. Same underlying event stream, two filter rules.
2. **PII compliance.** Event payloads cross network boundaries
   (Redis pub/sub + SSE). Carrying free-text consumer data (names,
   emails, addresses, SSN, DOB) on that wire is a data-flow risk —
   especially for the partner-scoped channel where a misrouted event
   would expose another tenant's customer.

The repo already has:

- Redis (used by Throttler) — so a pub/sub channel is free.
- `PiiVaultService` (ADR-0016) with AAD-bound envelope encryption.
- `audit_outbox` table — but it's a different abstraction (one-shot
  webhook deliveries, not subscriber fan-out).
- JWT auth + AdminGuard + Throttler already in place at the controller layer.

## Decision

Add a new `services/events` package + `event_log` Prisma table that:

1. **Append-only Postgres source of truth.** Every event published
   writes a row to `event_log` inside the publishing service's
   existing `$transaction`. Invariant: no state change ships
   without its event row, and no event row exists without its
   state change.
2. **Redis pub/sub for low-latency fan-out.** After the row is
   written (best-effort, before the transaction commits), the
   `EventsService.publish()` fires a JSON broadcast on the
   `eaze.events` channel. A per-process `EventsSubscriber`
   listens and dispatches to registered SSE handlers.
3. **Two SSE controllers, two scope rules:**
   - `GET /v1/events/stream` — admin-only (`@AdminOnly()` +
     `@UseGuards(AdminGuard)`). Sees every event in the channel.
   - `GET /v1/applications/:id/stream` — partner-scoped
     (`@UseGuards(JwtAuthGuard)` + a server-side `MerchantUser`
     check + per-event re-filter on `merchantId === application.merchantId
&& targetType === 'Application' && targetId === id`). The
     per-event re-filter is defence in depth: even if the connect-
     time authz somehow drifted, every published event is checked
     again before send.
4. **Payload sanitiser at the publish boundary.** `assertSafePayload()`
   allowlists primitive shapes — UUIDs, period IDs, invoice
   numbers, status enums, ISO timestamps, short labels (≤60 chars,
   ASCII-only) — and rejects deny-listed property names (`ssn`,
   `dob`, `firstName`, `lastName`, `email`, `phone`, `address`,
   `pan`, `cvv`, `password`, `secret`, `token`, `consumerName`,
   etc.). Anything that looks like raw consumer PII throws
   synchronously, failing the transaction. Free-text PII (dispute
   reasons, support notes) must ride in the separate `payloadPii`
   field which is envelope-encrypted with AAD bound to the event
   uuid before persist.
5. **Replay via Last-Event-ID.** On SSE reconnect, the browser's
   built-in `EventSource` sends the last id it saw. The handler
   queries `event_log WHERE id > last AND <scope filter>` (cap
   500 rows) and replays before subscribing to the live channel.
   This makes the wire-level dropped-message problem invisible to
   the client — every reconnect catches up automatically.
6. **Feature gate.** `EventsModule.forRoot({ enabled })` defaults
   to `false`. When off, no SSE controllers register, no Redis
   subscription is opened, and `EventsService.publish()` calls
   from publisher services become no-ops via `@Optional()`
   constructor injection. Operators flip `EVENTS_ENABLED=true`
   in Railway env when ready.
7. **Retention.** 90 days hot in `event_log` (Postgres),
   archived to S3 after via a daily cron (lands in a follow-up
   PR; the schema's `at` index already supports the sweep query).
   90 days covers the dunning + dispute window in our billing
   model and the SOC2 audit-trail review cadence.

The browser frontend gets:

- `lib/event-stream.ts` — `useEventStream(stream)` hook with
  buffer cap, sessionStorage-backed Last-Event-ID resume, and a
  one-shot `onFirstMatch` callback used for the sales-rep chime.
- `components/LiveActivityStrip.tsx` — collapsible top-of-page
  band on every master surface streaming the fleet feed; hidden
  for per-brand portals (defence against accidental cross-tenant
  surface).
- `app/activity/page.tsx` — dedicated master Live Activity page
  with filter chips (Applications / Offers / Billing / Auth /
  Config / All).
- `components/LiveOfferTicker.tsx` — per-application offer
  ticker consuming `/v1/applications/:id/stream`, with a
  "Waiting for offers… N/52" empty state and a soft chime on
  first `offer_received` event.

## Threat model

| Threat                                                                            | Mitigation                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partner sees another tenant's events (cross-tenant leak)                          | Two-layer check: connect-time `MerchantUser` row check against the application's `merchantId`, then per-event re-filter on `event.merchantId === application.merchantId && event.targetId === pathId`. A buggy publisher emitting under a wrong merchantId still drops at the handler. |
| Anonymous user opens an SSE stream (auth bypass)                                  | `@UseGuards(JwtAuthGuard)` on the per-app controller; `@AdminOnly() + @UseGuards(AdminGuard)` on the master controller. The auth guard rejects unsigned + signed-by-other-issuer tokens before the SSE upgrade.                                                                        |
| Stale JWT keeps the stream open after token expiry                                | 60s heartbeat comments + EventSource auto-reconnect — on each reconnect the JWT is re-validated by the guard. Stream gets closed within one reconnect cycle of expiry. (Background re-check inside the connection is a follow-up.)                                                     |
| Replay attack: client crafts `Last-Event-ID` to read a different tenant's history | `parseLastEventId()` rejects anything that isn't a decimal BigInt. The replay query is scoped by `merchantId === jwt.merchantId` (partner) or no-scope (master). Even with a forged id, a partner only sees rows their JWT entitles them to.                                           |
| PII leaks via payload                                                             | Publisher-side sanitiser rejects free-text, deny-listed keys, oversized strings, deep nesting, non-plain objects, NaN/Infinity. Free-text PII goes through `payloadPii` → envelope-encrypted with AAD bound to event uuid; partner SSE never surfaces the encrypted field.             |
| Audit row written but state change rolled back (or vice versa)                    | Both writes share a single `$transaction`. If the publish throws (e.g., sanitiser violation), the whole mutation rolls back.                                                                                                                                                           |
| Redis broadcast lost (network blip, Redis restart)                                | DB row was already written. Reconnecting subscribers replay via `event_log` query. Redis is best-effort fan-out, not the source of truth.                                                                                                                                              |
| Subscriber overwhelmed (slow client, kernel buffer full)                          | `sse-writer.ts` swallows write errors and stops emitting; client reconnects with Last-Event-ID and catches up. No unbounded server-side queue.                                                                                                                                         |
| DOS via too many open SSE streams                                                 | Per-controller Throttler caps stream-OPEN calls (6/min/IP). Once open, the stream is push-only with bounded heartbeat overhead. Each replica caps concurrent listeners by available kernel sockets; horizontal scaling adds capacity.                                                  |
| Forged event injected into Redis channel                                          | Only the BFF process has the channel credentials (same Redis the app already uses). A hostile network actor would have to compromise the Redis ACL — out of scope; Redis is internal-VPC only in production.                                                                           |
| Lost-rollback phantom event (best-effort publish before commit)                   | On rollback, subscribers may have seen the event briefly. On reconnect, the catchup query won't return it (the row never committed), so the UI's source-of-truth on refresh reconciles. Documented + acceptable for activity-feed UX where a phantom for ~50ms is invisible.           |
| Listener throws and kills the subscriber                                          | `EventsSubscriber` wraps each listener in try/catch and logs; the loop keeps running. SSE controllers also wrap their own write in try/catch so a closed client doesn't blow up the dispatch loop.                                                                                     |
| Encrypted PII envelope swapped between event rows                                 | AAD = `{entity:event_log, field:payloadPii, eventUuid:<uuid>}`. Swapping ciphertext between rows fails the GCM auth-tag check. Same pattern as ADR-0016.                                                                                                                               |

## Consequences

**Pros**

- One Redis channel + one DB table powers both the operator
  command-centre live feed and the per-application sales-rep
  ticker. Adding new event consumers later is a matter of
  registering another listener; the pub/sub already scales it.
- Publisher services don't need to know about subscribers —
  they call `EventsService.publish(tx, {...})` once and the bus
  fans it out. Cross-cutting concern stays cross-cutting.
- DB-backed source of truth means SSE drops don't lose data —
  reconnect always catches up.
- Per-row encryption with AAD binding makes a Redis snapshot
  exfiltration limited to ID-only payloads. Free-text PII is
  only readable inside the API process holding the KEK.

**Cons / open items**

- **No per-quote events from orchestration yet.** The
  orchestration service still resolves all lender quotes in
  one batch transaction. To get the "rep watches offers stream
  in" UX in production, orchestration needs to be refactored to
  publish `offer_received` events per-adapter rather than all-
  at-once. Tracked as carryover; the bus + UI surface are ready
  the moment that lands.
- **Cron-driven retention sweep not implemented.** Adding a
  daily cron that deletes `event_log` rows older than 90 days
  and archives to S3 lands in a follow-up. Until then, the
  table grows unbounded — acceptable while volumes are low,
  must ship before staging-scale traffic.
- **Cross-replica fan-out scales linearly with subscriber
  count.** Every replica subscribes to the same Redis channel,
  so N replicas fan out to (sum of listeners across replicas).
  Fine up to a few thousand concurrent connections. Beyond that
  we'd shard the channel by merchant or move to a dedicated
  pub/sub fabric (NATS / Kafka).
- **Background JWT re-check inside an open stream is not yet
  wired.** Stream stays open until reconnect; if a token is
  revoked mid-stream, the partner keeps receiving events until
  their next reconnect cycle. Acceptable for v1 (revocation
  rare, blast radius limited by per-event filter); harden in a
  follow-up.

## References

- ADR-0016 — PII vault envelope encryption
- ADR-0017 — JIT PII unmask
- ADR-0018 — Billing service
- `services/events/src/events.service.ts` — domain logic
- `services/events/src/internal/sanitiser.ts` — PII allowlist
- `services/events/src/event-stream.controller.ts` — master SSE
- `services/events/src/application-stream.controller.ts` — per-app SSE
- `apps/partner-portal/lib/event-stream.ts` — browser hook
- `apps/partner-portal/components/LiveActivityStrip.tsx`
- `apps/partner-portal/components/LiveOfferTicker.tsx`
- `apps/partner-portal/app/activity/page.tsx`
- `apps/api/prisma/migrations/20260517_events_bus/migration.sql`
