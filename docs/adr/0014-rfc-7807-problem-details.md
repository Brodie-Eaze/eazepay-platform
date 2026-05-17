# ADR-0014: RFC 7807 Problem Details for HTTP API Errors

- **Status:** Accepted
- **Date:** 2026-03-04
- **Deciders:** Head of Engineering, API Lead
- **Supersedes:** —

## Context

EazePay's HTTP surface is consumed by four first-party frontends, three
classes of merchant integration (link, widget, server-to-server), every
lender adapter, and every webhook receiver. Every one of those callers
needs to react to errors deterministically.

Common ad-hoc shapes — `{ ok: false, message: "..." }`, NestJS's
default exception body, or a plain HTTP status with no body — fail at
scale because:

1. Error fields are inconsistent across endpoints.
2. There is no stable machine identifier per error (callers parse
   `message`, which is exactly what breaks first).
3. Sensitive information leaks into messages.
4. There is no way to safely include hints, retry guidance, or
   correlation IDs.

## Decision

Every non-2xx response is serialised as
[RFC 7807 Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807),
with the EazePay extensions described below.

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "code": "idempotency_key_invalid",
  "detail": "Idempotency-Key must match /^[A-Za-z0-9_-]{16,128}$/",
  "instance": "/v1/auth/register",
  "request_id": "req_8KvR2NQp",
  "errors": [{ "field": "Idempotency-Key", "code": "invalid_format" }]
}
```

EazePay extensions on top of RFC 7807:

| Field         | Required       | Purpose                                                       |
| ------------- | -------------- | ------------------------------------------------------------- |
| `code`        | yes            | Stable, snake_case machine identifier. Never localised.       |
| `request_id`  | yes            | Correlation ID also present on `X-EazePay-Request-Id` header. |
| `errors`      | when 422       | Array of field-level violations from the Zod parser.          |
| `retry_after` | when 429 / 503 | Seconds until the caller may retry. Mirrors `Retry-After`.    |

Implementation lives in
[`apps/api/src/common/filters/problem-exception.filter.ts`](../../apps/api/src/common/filters/problem-exception.filter.ts)
and the helper constructors in `@eazepay/shared-utils/problem`
(`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`,
`UnprocessableEntity`, `TooManyRequests`, `Internal`).

The `code` taxonomy is owned by Engineering and reviewed quarterly by
Risk + Compliance. New codes are added in the same PR that throws
them; no `code` may be silently changed once it has shipped to live
callers.

## Alternatives considered

- **JSON:API errors.** Strong spec, but the rest of our stack is not
  JSON:API and the error envelope alone would be inconsistent.
- **GraphQL-style errors-in-200.** Rejected — incompatible with HTTP
  status semantics, breaks every middlebox we rely on (WAF, CDN,
  ALB metrics).
- **Plain HTTP status, no body.** Rejected — debugging across four
  frontends becomes guesswork.
- **NestJS default exception body.** Rejected — leaks framework
  internals and lacks `code` + `request_id`.

## Consequences

- Easier: every caller has the same parser and the same retry logic.
- Easier: incidents — `request_id` ties a customer-facing failure to a
  precise log entry.
- Easier: i18n later — `title` and `detail` are translatable; `code`
  is not.
- Harder: discipline. New codes must be added to the registry, not
  invented inline. Reviewers enforce this at code review.

## Compliance / risk notes

- **PII safety:** `detail` and `errors` are constructed via helpers
  that strip PII; the Pino redactor is the second line of defense.
  Never echo back raw request bodies in `detail`.
- **CFPB consumer-comm rules:** consumer-facing error messages must
  be plain English; the frontend maps `code` → friendly copy. The API
  itself returns the canonical machine form.
- **Audit:** every 4xx and 5xx surface emits `request_id` to the audit
  chain when the request touches money, identity, or decisioning.
