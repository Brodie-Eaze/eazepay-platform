# @eazepay/service-risk

Composite risk scoring + RiskFlag taxonomy + decision policy hooks.

## Responsibilities

- Combine device, identity, and behavior signals into a single risk
  score per application
- Maintain the `RiskFlag` taxonomy (the canonical reason-code set)
- Provide a policy DSL (`policy.ts`) that the orchestration layer
  evaluates pre-lender
- Adapter ports for device-risk (Sift / Castle / Seon / Plaid Signal)
  and identity-risk (Emailage / Telesign / Ekata)

## Public API

- `RiskModule.forRoot(...)`
- `RiskService.evaluate(application)` → `RiskAssessment` with
  flags + score
- `risk.types.ts` — `RiskFlag`, `RiskScore`, `RiskAssessment`
- `policy.ts` — declarative risk rules
- Adapters: `MockDeviceRiskAdapter`, `MockIdentityRiskAdapter`
- Ports: `DeviceRiskPort`, `IdentityRiskPort`

## Dependencies

- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); third-party device + identity APIs

## Notes

- Reason codes here are *the* source of truth — `service-orchestration`
  and `service-compliance-doc` both import from this package
- Policy is data, not code branches — rules can be edited in the
  admin console without a deploy
- Scoring is pure for a given input; replay-from-snapshot is a
  hard requirement
