# @eazepay/service-compliance-doc

Adverse Action Notice renderer + retention-tagged document store.

## Responsibilities

- Build Adverse Action Notices from a typed input (applicant,
  decision, reason codes, bureau-disclosed factors)
- Render notices to PDF
- Store generated documents with retention tags so the audit team can
  prove compliance with FCRA 615(a), ECOA Reg B 1002.9 timing
- Surface signed-URL downloads for admin + consumer access

## Public API

- `ComplianceDocModule.forRoot(...)`
- `ComplianceDocService` — `buildAdverseActionNotice(input)` →
  stored doc + signed URL
- `notices/adverse-action.types.ts` — typed input shape + reason-code
  enum
- `notices/adverse-action-builder.ts` — pure builder, no IO
- `render/adverse-action-pdf.ts` — PDF rendering

## Dependencies

- `@eazepay/service-admin`, `@eazepay/service-auth`,
  `@eazepay/service-notification`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); ObjectStorage (S3 in prod, LocalFs in dev)

## Notes

- Notices must be delivered within 30 days of adverse action — the
  cron in `service-notification` is the deliverer; this package only
  builds + stores
- Reason codes are the canonical Reg B / FCRA taxonomy in
  `service-risk` — never invent ad-hoc strings
- Documents are retention-tagged at write time; deletes require a
  legal-hold check
