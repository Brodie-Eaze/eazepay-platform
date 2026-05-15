# @eazepay/api-client

A framework-free HTTP client for the EazePay BFF + public API. Every frontend (mobile, web, partner-portal) consumes the API through this single typed surface so behaviour — token refresh, idempotency keys, RFC 7807 error mapping, device-fingerprint propagation — stays consistent across runtimes.

## What it exports

- **`EazePayApiClient`** — class with typed methods per backend domain (auth, consumer, merchant, application, offer, repayment, notification).
- **`TokenStore`** interface — pluggable token persistence. The host app supplies an implementation (Keychain on iOS, KeyStore on Android, secure cookie or IndexedDB on web).
- **`ApiClientOptions`** — base URL, token store, device id, optional device fingerprint, `onAuthLost` hook.
- **`ApiError`** + **`isProblem`** — error type that wraps a `Problem` (RFC 7807) from the server.
- **DTOs / type re-exports** — `ApplicationSnapshot`, `AuthChallenge`, `AuthTokens`, `NotificationItem`, `Offer`, `Repayment`, `Problem`.

## Used by

- `apps/consumer-mobile` (React Native)
- `apps/consumer-web`, `apps/partner-portal`, `apps/merchant-dashboard`, `apps/admin-console` (Next.js)

## Notes

- Uses the native `fetch` API — no Axios, no `node-fetch`. ESM-only.
- Idempotency key generation is built in for write endpoints ([ADR-0015](../../docs/adr/0015-idempotency-keys.md)).
- Token refresh is handled inside the client; on terminal refresh failure the `onAuthLost` callback fires and the host app routes back to login.
- Depends on `@eazepay/shared-types` for `Problem`, branded IDs, and `Money`.
- Today the client is hand-rolled and aligned to the BFF contract in [`docs/bff-contract.md`](../../docs/bff-contract.md). It is **not** OpenAPI-generated — keep the hand-rolled ergonomics until the BFF stabilises, then revisit.
