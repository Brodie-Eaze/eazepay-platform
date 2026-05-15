# @eazepay/service-payment

Disbursement + repayment scheduling + daily collection cron.

## Responsibilities

- Issue disbursements (ACH / RTP / partner-bank rails) once a loan is
  funded by the chosen lender
- Build amortization + repayment schedules; recompute on prepayment
- Run the daily collection cron — debit upcoming installments,
  handle retries, return-code routing (NSF → retry rules, R10 →
  account close, etc.)
- Bank-account verification via pluggable provider (Plaid / MX /
  Finicity / mock)

## Public API

- `PaymentModule.forRoot({ provider, bankAccountProvider, collectionCronEnabled, ... })`
- `PaymentService` — disburse, schedule, collect, refund
- Controllers: `loan.controller.ts` (`/v1/loans/*`),
  `payment-method.controller.ts` (`/v1/payment-methods/*`)
- DTOs in `dto/`
- Ports: `PaymentProviderPort`, `BankAccountProviderPort`

## Dependencies

- `@eazepay/service-auth`, `@eazepay/service-notification`,
  `@eazepay/service-webhook`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma); payment provider (Stripe / Modern
  Treasury / partner bank), bank-account provider

## Notes

- All money in BigInt cents — never floats
- Collection cron must run on exactly one instance in production
  (`collectionCronEnabled: true` on that instance only)
- ACH return codes drive a deterministic retry ladder; manual review
  required before any second-time debit on hard returns
