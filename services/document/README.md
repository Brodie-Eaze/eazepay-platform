# @eazepay/service-document

Document store + KYC / KYB artifact storage.

## Responsibilities

- (Reserved) Generic document storage for non-compliance artifacts —
  KYC selfies, ID front/back, KYB articles-of-organization, bank
  statements
- Lifecycle management: upload, classify, retention-tag, expire
- Adapter port over `@eazepay/shared-utils` `ObjectStorage` (LocalFs
  in dev, S3 in prod)

## Public API

- TBD — package is currently a placeholder directory.

## Dependencies

- Will depend on `@eazepay/service-auth`, `@eazepay/shared-utils`'s
  `ObjectStorage` port, `@eazepay/shared-types`

## Notes

- Placeholder package — no source under `src/` yet. Today
  compliance documents (AANs) are handled in `service-compliance-doc`;
  KYC / KYB artifacts are uploaded direct-to-provider. This package is
  the eventual home for the platform-owned document layer.
- Distinct from `service-compliance-doc`: that one renders regulated
  artifacts the platform produces; this one stores artifacts the
  consumer or merchant uploads.
