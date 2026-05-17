# @eazepay/service-user

Consumer profile + PII vault with envelope encryption.

## Responsibilities

- `ConsumerProfile` CRUD (name, contact, address, employment)
- PII vault: envelope encryption for SSN, DOB, full address — per-row
  DEK wrapped by a process-scoped KEK
- KYC start + result handling (pluggable provider: mock / Alloy /
  Persona)
- KeyManager port (`local` dev / `kms` prod) for the KEK
- DTOs + Zod-validated controllers for `/v1/users/*`

## Public API

- `UserModule.forRoot(...)`
- `UserService` — profile read/write, masked vs unmasked reads,
  `decryptForAuthorizedRead` (gated by audit + admin approval)
- `PiiVaultService` — `encrypt(value, fieldName)` / `decrypt(...)`
- DTOs: `UpdateProfileDto`, `StartKycDto`
- Ports: `KeyManagerPort`, `KycProviderPort`

## Dependencies

- `@eazepay/service-auth`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); AWS KMS in prod, AES-256-GCM locally

## Notes

- Default reads return _masked_ values (`***-**-1234`); a clear-text
  read writes an audit row in the same TX
- DEK rotation is per-row — replace ciphertext + new wrapped DEK,
  KEK rotation is a separate ceremony
- Field-name binding via AAD (Additional Authenticated Data) prevents
  ciphertext-swapping across fields
