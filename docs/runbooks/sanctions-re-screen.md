# Sanctions Re-Screening Runbook

OFAC SDN screening: onboarding controls + weekly re-screen cadence. This document is owned by the BSA/AML officer. Engineering changes to the screening pipeline require sign-off from compliance.

## Regulatory anchors

- 31 CFR §501 — OFAC reporting + recordkeeping
- 31 CFR §1010.230 — FinCEN CDD Rule (beneficial-owner identification)
- BSA §5318(h) — AML program requirements (incl. recurring screening)
- Retention floor: 5 years from the end of the merchant relationship

## Scope

Every legal entity, beneficial owner (≥25% ownership prong), and controlling individual (control prong) onboarded through the partner-portal merchant onboarding flow is screened against OFAC SDN at:

1. KYB initiation (`MerchantService.startKyb`)
2. Weekly recurring sweep (`SanctionsRescreenScheduler.runWeekly` — Monday 09:00 UTC)
3. Ad-hoc, on operator request from the compliance console

A non-cleared result on ANY subject halts onboarding (or, post-onboarding, flips the merchant to `manual_review`). The system NEVER auto-clears a `review`, `match`, or `error` result.

## Decision matrix

| Adapter result | Merchant state after                                        | Operator action                                                                            | SLA                                       |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `cleared`      | unchanged (proceed to KYB)                                  | none                                                                                       | n/a                                       |
| `review`       | `kyb_manual_review`                                         | reviewer compares match details vs. declared identity; clear or escalate                   | **24 business hours**                     |
| `match`        | `kyb_manual_review` + immediate notification to BSA officer | BSA officer files OFAC report if confirmed; relationship blocked pending Treasury guidance | **immediate (same business day)**         |
| `error`        | `kyb_manual_review` (fail-closed)                           | retry with backoff; if vendor down >2h escalate to engineering on-call                     | **2 hours to retry, 4 hours to escalate** |

## Evidence

Every screen writes ONE row to `sanctions_screen_log` (migration 0015). The table is append-only at the database role level. Each row carries:

- `subject_kind` + `subject_id` (merchant / BO / consumer)
- `legal_name_hash` — plaintext name is NEVER stored here (lives in the encrypted BO blob)
- `provider` — which adapter ran the screen
- `list_version` — OFAC SDN publish date or vendor snapshot id
- `status` + `matches_json` + `screened_at`

Retention: 5 years post-merchant-offboarding. Crypto-shred of underlying PII is permitted under RTBF; the evidence row survives.

## Escalation path

| Severity | Trigger                                    | Notify                                                                                                              |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| P0       | confirmed OFAC SDN match                   | BSA officer (text + email) + General Counsel + Engineering on-call. File SAR / OFAC report within statutory window. |
| P1       | `review` result, > 24h unresolved          | BSA officer + Compliance lead                                                                                       |
| P1       | vendor adapter `error` rate >5% over 15min | Engineering on-call (sanctions pager rotation)                                                                      |
| P2       | weekly re-screen cron missed a tick        | Engineering on-call next business day; re-run manually via `/admin/sanctions/rescreen`                              |

## Provider configuration

The platform integrates via the `SanctionsScreen` port (`libs/integrations-core/src/sanctions-screen.ts`). One adapter is wired per environment:

| Env           | Adapter                          | Source                                                   | Notes                                                                                                                  |
| ------------- | -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `development` | `MockOfacAdapter`                | `apps/partner-portal/lib/sanctions/mock-ofac-adapter.ts` | Returns `cleared` for every input. Synthetic `listVersion=mock-sdn-0000-00-00`. Audit-rows every call. **NEVER PROD.** |
| `staging`     | TBD (real provider, sandbox key) | LexisNexis Bridger sandbox OR ComplyAdvantage staging    | Pinned to test SDN snapshot; must produce a non-mock `listVersion`.                                                    |
| `production`  | Real OFAC provider               | Selected vendor + signed BAA                             | See go-live checklist below.                                                                                           |

## Go-live checklist

Compliance + Engineering must BOTH sign off before flipping the production launch flag.

- [ ] Real OFAC provider contract signed (LexisNexis Bridger / ComplyAdvantage / direct Treasury ingest)
- [ ] BAA / DPA executed if the provider receives any PII (legal name + DOB qualifies)
- [ ] Production `MerchantModule.forRoot({ sanctionsScreen })` factory swapped from `MockOfacAdapter` to the real adapter — **MockOfacAdapter MUST NOT be importable from any production code path**
- [ ] `provider` enum value for the new adapter added to `libs/integrations-core/src/sanctions-screen.ts` if missing
- [ ] Database migration 0015 applied in production (`sanctions_screen_log`)
- [ ] Append-only role grant verified in production (`REVOKE UPDATE, DELETE ON sanctions_screen_log FROM authenticated;` returns success)
- [ ] Sanctions pager rotation defined in PagerDuty / Opsgenie
- [ ] First end-to-end screen against production SDN reviewed by BSA officer
- [ ] Weekly cron leader-lock verified across replicas (exactly-one execution test)
- [ ] Retention policy job verified (5y; no automatic deletion before that)
- [ ] BSA officer signs off on this runbook

## What this runbook does NOT cover

- Consumer CIP screening (lives in `services/user` — separate runbook to be written when CIP ships)
- Trade-based money-laundering controls
- Country / geographic risk scoring (covered under the merchant risk scorecard)

## Change log

- 2026-05-27 — initial version. Port + mock adapter shipped. Production provider selection deferred to go-live milestone.
