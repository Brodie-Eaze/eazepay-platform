# @eazepay/service-integration

External system integration (Plaid, Persona, Middesk, etc.).

## Responsibilities

- (Reserved) Centralize the outbound integration layer that today
  lives in per-service adapters (`service-merchant/adapters/`,
  `service-user/adapters/`, `service-payment/adapters/`)
- Provide a single place for partner credential rotation, retry
  policies, circuit breakers, and rate-limit accounting

## Public API

- TBD — package is currently a placeholder directory.

## Dependencies

- Will depend on `@eazepay/shared-types`, `@eazepay/shared-utils`,
  and the per-vendor SDKs

## Notes

- Placeholder package — no source under `src/` yet. The current
  pattern is: each business service owns its adapter port + concrete
  adapters. This package is reserved for the consolidation pass once
  cross-cutting integration concerns (e.g. one shared rate-limit
  budget per vendor) become first-class.
