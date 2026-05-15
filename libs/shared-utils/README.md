# @eazepay/shared-utils

Cross-cutting utilities used by the backend services and the API. These exist as a separate package so that they can be consumed both by `@eazepay/service-*` modules and by `apps/api`, `apps/workers`, `apps/webhooks` without circular dependencies.

## What it exports

- **`Problem` / RFC 7807** — Problem Details builder + type guards. Every public endpoint returns errors in this shape. ([ADR-0014](../../docs/adr/0014-rfc-7807-problem-details.md))
- **`assert`** — small invariant helpers that throw `Problem`-shaped errors.
- **`hash`** — SHA-256, HMAC-SHA256, content-addressable hash helpers.
- **`crypto`** — AES-256-GCM envelope encryption + KMS-wrapped data-key helpers, used by `services/user` for the PII vault. ([ADR-0016](../../docs/adr/0016-pii-vault-envelope-encryption.md))
- **`ObjectStorage` port** + **`LocalFsStorage` adapter** — interface for blob storage (S3 in prod, local filesystem in dev/test). Used by `services/compliance-doc` for Adverse Action Notice retention.
- **`idempotent` decorator** — class-method decorator that wires write endpoints to the idempotency-key contract. ([ADR-0015](../../docs/adr/0015-idempotency-keys.md))

## Used by

`apps/api`, `apps/workers`, `apps/webhooks`, and every `@eazepay/service-*` package that handles regulated data or external I/O.

## Notes

- ESM-only.
- `LocalFsStorage` is the dev/test adapter; the S3 adapter is wired through `services/integration` (reserved) and configured via env in `apps/api`.
- The `crypto` module deliberately wraps the Node `crypto` primitives so that audit metadata (`kmsKeyId`, `dataKeyVersion`, `algorithm`) can be attached to every encrypted column without the caller having to remember.
