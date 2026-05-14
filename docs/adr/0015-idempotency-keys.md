# ADR-0015: Idempotency Keys on Every Write

- **Status:** Accepted
- **Date:** 2026-03-05
- **Deciders:** API Lead, Head of Engineering, Payment Lead
- **Supersedes:** —

## Context

EazePay creates applications, generates offers, accepts contracts,
disburses funds, schedules repayments, and triggers webhooks — most of
those over HTTP from networks we don't control. Network failures,
proxy retries, and aggressive client retry policies make at-least-once
delivery the realistic floor.

A second `POST /v1/applications` for the same applicant could create a
duplicate application. A retried `POST /v1/offers/:id/accept` could
double-fund a loan. A retried webhook could trigger two settlement
emails. None of those are acceptable.

## Decision

Every POST / PUT / PATCH / DELETE on a route that **creates state**,
**moves money**, **emits a domain event**, or **sends to a third
party** requires an `Idempotency-Key` header.

```
Idempotency-Key: 8KvR2NQp-2026-05-04-app-create
```

Rules:

1. Keys are caller-chosen, opaque strings matching `^[A-Za-z0-9_-]{16,128}$`.
2. Keys are scoped to (`api_key_or_user_id`, `method`, `route`). A key
   value is unique only inside that scope; collisions across scopes
   are not collisions.
3. The first request inside a 24-hour window is processed normally; the
   response (status + headers + body) is hashed and stored alongside
   the key.
4. Any subsequent request with the same key inside that 24h window
   returns the **stored response verbatim** — same status, same body,
   same `Idempotency-Replayed: true` header.
5. If the second request body's SHA-256 differs from the first body's
   SHA-256, we return `409 Conflict` with code
   `idempotency_key_mismatch` — preventing a key from being reused on
   a different payload.
6. Keys expire after 24h. Beyond that, a reused key is a new request.

The implementation is
[`apps/api/src/common/interceptors/idempotency.interceptor.ts`](../../apps/api/src/common/interceptors/idempotency.interceptor.ts).
Key store is Redis (low-latency, single-region), backed up to DynamoDB
for the audit pack.

Internal callers (cron jobs, the audit drain, the webhook dispatcher)
also use the same interceptor. Each generates a deterministic key from
the work-item identity so the same retry semantics apply.

## Alternatives considered

- **Server-generated request IDs.** Insufficient — the caller doesn't
  know the ID until after the request, so they can't make their retry
  idempotent.
- **Optimistic concurrency tokens** (e.g. `If-Match: <etag>`). Useful
  for updates, doesn't help create operations.
- **Distinguishing by request hash alone.** Fragile — two legitimate
  identical creates (a second loan for the same applicant) collide.
- **Letting callers handle it.** They don't. They didn't with Stripe,
  they don't with us.

## Consequences

- Easier: external integrations. Every server-to-server caller has the
  same retry semantics as Stripe / Plaid / Modern Treasury / etc.
- Easier: webhooks. Receivers can replay safely.
- Easier: incident response. Re-running a failed batch is trivial.
- Harder: forgetting to send the header. The interceptor returns a 400
  with `code=idempotency_key_required` on first violation, which is
  caught in integration tests.
- Harder: storage. Redis key cardinality is bounded (24h TTL × peak
  write rate) and the dominant cost is the cached body. Capacity
  reviewed quarterly.

## Compliance / risk notes

- **Nacha Operating Rules:** ACH originators must avoid duplicate
  debits. Idempotency keys are the engineering control behind that
  policy.
- **Reg E:** preventing duplicate authorised debits closes a path to
  unauthorised-debit complaints.
- **Audit:** the interceptor writes `idempotency.replayed` events to
  the audit chain, so postmortems can distinguish a re-fired retry
  from a genuine duplicate intent.
- **Bank-partner expectations:** every modern partner-bank
  technology-integration questionnaire asks about idempotency. The
  answer is this ADR.
