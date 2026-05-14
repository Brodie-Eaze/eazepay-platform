# @eazepay/service-application

Application lifecycle state machine (XState v5).

## Responsibilities

- Application CRUD scoped to a consumer + merchant
- State machine: draft → submitted → in-orchestration → offered →
  accepted → signed → funded (or declined / expired / withdrawn)
- E-sign envelope orchestration via pluggable provider (mock /
  DocuSign / Dropbox Sign)
- Post-submit + contracted-hook ports so the orchestration layer can
  plug in without circular dependencies

## Public API

- `ApplicationModule.forRoot(...)`
- `ApplicationService` — create, update, submit, accept-offer, sign,
  withdraw
- `state-machine.ts` — XState v5 machine definition (`applicationMachine`)
- DTOs: `CreateApplicationDto`, `UpdateApplicationDto`
- Ports: `PostSubmitPort`, `ContractedHookPort`, `ESignProviderPort`

## Dependencies

- `@eazepay/service-auth`, `@eazepay/service-notification`,
  `@eazepay/service-webhook`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma)

## Notes

- Every state transition writes an audit row in the same TX —
  regulators need a complete state history
- The machine is purely declarative; side effects live in service
  methods called by `entry`/`exit` actions
- `PostSubmitPort` is the seam that orchestration plugs into;
  application has zero awareness of the lender layer
