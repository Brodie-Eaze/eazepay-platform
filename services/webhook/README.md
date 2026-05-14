# @eazepay/service-webhook

Outbound merchant webhooks + dispatcher cron.

## Responsibilities

- Endpoint CRUD: a merchant registers HTTPS URLs subscribed to
  event types (`application.submitted`, `offer.accepted`, `loan.funded`,
  etc.)
- Signing: every dispatched payload is HMAC-SHA256 signed with the
  per-endpoint secret
- Dispatcher cron: pull pending deliveries, deliver with timeout +
  exponential backoff, persist attempt history, dead-letter on
  permanent failure

## Public API

- `WebhookModule.forRoot({ prismaToken, dispatcherEnabled })`
- `WebhookService` — endpoint registration, secret rotation,
  `publish(eventType, payload, scope)`
- Controller: `/v1/webhooks/endpoints/*`
- DTOs in `dto/`
- Port: `WebhookPublisherPort` (so other services emit events without
  importing the dispatcher)

## Dependencies

- `@eazepay/service-auth`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); outbound HTTPS to merchant endpoints

## Notes

- Run `dispatcherEnabled: true` only in `@eazepay/workers`
- Each delivery carries an `X-EazePay-Signature` header + a replay
  nonce; merchants verify with the endpoint secret
- The dead-letter queue is the source of truth for "this endpoint is
  broken" — surfaced in the merchant dashboard for self-service
  inspection
