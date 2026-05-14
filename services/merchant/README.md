# @eazepay/service-merchant

Merchant onboarding (KYB) + beneficial owners + application links.

## Responsibilities

- Merchant CRUD (legal name, EIN, MCC, beneficial ownership)
- Pluggable KYB provider: mock / Middesk / Alloy
- Beneficial-owner PII handling (delegates to `service-user` vault)
- Application-link issuance (signed URLs for consumer apply flows)
- DTOs + controllers for `/v1/merchants/*`

## Public API

- `MerchantModule.forRoot(...)`
- `MerchantService` — onboard, KYB submission, BO add/remove, link
  issuance
- DTOs: `CreateMerchantDto`, `AddBeneficialOwnerDto`,
  `CreateApplicationLinkDto`
- Ports: `KybProviderPort`

## Dependencies

- `@eazepay/service-auth`, `@eazepay/service-user`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma)

## Notes

- EIN format validated against `\d{2}-\d{7}` (federal format)
- KYB result drives merchant `status` machine; final approval is a
  manual review with audit row
- Application links are signed (HMAC) and carry brand + partner-ref
  for attribution
