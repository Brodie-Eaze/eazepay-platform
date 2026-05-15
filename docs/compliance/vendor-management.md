# Vendor management policy

> SOC 2 CC9.2 — Third-party / sub-processor lifecycle.
> Owner: CCO + Engineering. Last reviewed: 2026-05-15.

## Scope

Every external service the platform sends data to OR depends on for
availability is a vendor. Sub-processors (vendors that touch consumer
PII) carry the highest review burden.

## In-scope vendors

| Vendor                   | Category                       | Data classification                | SOC 2 status                | DPA on file   | Annual review |
| ------------------------ | ------------------------------ | ---------------------------------- | --------------------------- | ------------- | ------------- |
| Railway                  | Infra (hosting + Postgres)     | PII (encrypted at rest), secrets   | Type II — collected 2026-02 | Yes           | 2026-12       |
| GitHub                   | Source control, CI             | Non-PII (code), secrets in Actions | Type II — collected 2026-01 | Yes           | 2026-12       |
| Anthropic                | LLM (operator-side)            | Non-PII (no consumer data sent)    | Type II — collected 2026-03 | Yes           | 2027-01       |
| Highsale                 | Inbound application source     | PII (consumer applications)        | Requested 2026-04           | Pending       | 2027-01       |
| Cross River Bank         | Sponsor bank (pending)         | PII, NPI                           | TBD on integration          | Pending       | TBD           |
| US Bank                  | Lender adapter (pending)       | PII, NPI                           | TBD on integration          | Pending       | TBD           |
| Engine.Tech              | Lender adapter (pending)       | PII                                | TBD on integration          | Pending       | TBD           |
| Queen Street             | Lender adapter (pending, AU)   | PII                                | TBD on integration          | Pending       | TBD           |
| AWS KMS                  | Key management (planned)       | Secrets (KEK)                      | Type II — public report     | N/A (AWS DPA) | 2027-01       |
| DynamoDB                 | Audit sink (planned)           | Audit rows (hashed PII refs)       | Type II — public report     | N/A (AWS DPA) | 2027-01       |
| Stripe / Modern Treasury | Payment rail (planned)         | PII, NPI, financial                | Type II — public            | Pending       | TBD           |
| Plaid                    | Bank-account linking (planned) | NPI (bank tokens)                  | Type II — collected         | Pending       | TBD           |
| Alloy / Persona          | KYC (planned)                  | PII (full identity)                | Type II — public            | Pending       | TBD           |
| Sift / Castle            | Device risk (planned)          | Device telemetry                   | Type II — public            | Pending       | TBD           |

## New-vendor onboarding checklist

1. Document the use case + data classification in this file.
2. Collect the vendor's latest SOC 2 Type II report (or ISO 27001).
3. Execute DPA / sub-processor agreement before any prod data flows.
4. Wire the integration behind a feature flag with KEY_MANAGER-backed
   credential vault (`services/lender/src/internal/credential-vault.service.ts`).
5. Add the vendor's webhook source to the HMAC verification path
   (`services/webhook/src/internal/webhook-signing.ts`).

## Annual review

Each vendor's "Annual review" date in the table above is a calendar
trigger. The CCO walks the matrix in Q4 each year and:

- Re-collects the latest SOC 2.
- Re-confirms DPA is current.
- Confirms data classification still matches actual use.
- Records the review outcome in `docs/compliance/` git history.

## Termination procedure

1. Disable the integration via environment variable (every adapter is
   gated by its provider selector — see `apps/api/.env.example`).
2. Revoke credentials at the vendor + rotate any shared HMAC secrets.
3. Send a documented data-deletion request and file the response.
