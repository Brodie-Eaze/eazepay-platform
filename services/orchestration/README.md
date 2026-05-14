# @eazepay/service-orchestration

Multi-lender waterfall + decisioning + risk gate.

## Responsibilities

- Orchestrate the full submit pipeline: decision policy → risk gate
  → lender waterfall → offer ranking
- Decisioning engine: composite rules + scorecards
- Lender adapter selection + ordered fan-out with timeout + circuit
  breaker behavior
- Adverse Action Notice trigger when no lender approves

## Public API

- `OrchestrationModule.forRoot(...)`
- `OrchestrationService` — `submit(applicationId)` returns
  `OrchestrationResult` (offer set or AAN with reason codes)
- `DecisionService` — pure-function decision policy evaluation
- `policy.ts` — decision rule definitions

## Dependencies

- `@eazepay/service-compliance-doc` (AAN trigger),
  `@eazepay/service-lender`, `@eazepay/service-notification`,
  `@eazepay/service-risk`, `@eazepay/service-webhook`
- `@eazepay/shared-types`, `@eazepay/shared-utils`

## Notes

- Stateless coordinator — durable state lives in
  `service-application` (the state machine) and `service-lender`
  (offer rows)
- Per-lender timeouts are hard caps; a slow lender is treated as a
  decline and the waterfall continues
- Reason codes follow Reg B / FCRA taxonomy in `service-risk`
