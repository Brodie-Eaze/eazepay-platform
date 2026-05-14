# @eazepay/service-lender

Lender adapter port + registry + concrete adapters.

## Responsibilities

- Define the `LenderAdapterPort` interface every lender must implement
  (price, decision, sign, fund, repay status callbacks)
- Maintain the lender registry — order, eligibility filters, per-product
  knobs
- Ship in-house adapters: `BuzzPayAdapter` (the internal lender, by
  TrueTopia) and `MockPrimeAdapter` for dev / tests

## Public API

- `LenderModule.forRoot(...)`
- `LenderRegistryService` — `eligibleLenders(application)` returns the
  ordered list orchestration walks
- Adapters: `BuzzPayAdapter`, `MockPrimeAdapter`
- Port: `LenderAdapterPort`
- Types: `LenderQuote`, `LenderDecision`, `OfferTerms`

## Dependencies

- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); future: outbound HTTPS to external lenders

## Notes

- Adapters are pure: no DB writes, no audit calls — they translate
  the EazePay application shape into a lender's API and back
- Adding a lender = new file in `adapters/`, register in
  `LenderRegistryService`, write a contract test
- Real adapters use signed mTLS + per-lender API keys held in secrets
  manager
