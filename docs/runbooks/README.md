# Operational Runbooks

Production runbooks for EazePay / AUREANOS. Every runbook follows the same format (TL;DR → When it fires → Severity → Diagnosis → Mitigation → Root cause → Comms → Post-incident → Related). Each is written so an ops engineer can execute it cold at 2am without context.

**House rule:** if you reach for a runbook and it doesn't answer your question, file the gap in the postmortem. Runbooks are living documents.

## When in doubt — start here

Open [`incident-response.md`](incident-response.md). It is the umbrella runbook. It will route you to the specialized one once you know what you're looking at.

## Index

| Runbook                                                  | TL;DR                                                                                                                                                                 | When you reach for it                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [incident-response.md](incident-response.md)             | Master process — classify, snapshot, route to specialized runbook, communicate.                                                                                       | Any production-impacting signal you haven't classified yet.            |
| [webhook-dlq.md](webhook-dlq.md)                         | Rows in `webhook_inbox` are stuck `failed` with `attempts >= 5`. Classify the failure cluster, replay or discard, never mass-retry.                                   | MiCamp / HighSale / Trutopia / Stripe events not landing.              |
| [provisioning-rollback.md](provisioning-rollback.md)     | A partner's `POST /api/onboarding/provision` run partially completed. Decide retry vs rollback; reverse the steps that did complete.                                  | New-partner onboarding stuck mid-flow.                                 |
| [partner-suspension.md](partner-suspension.md)           | Stop a live partner safely — performance / fraud / regulator. Four-step sequence; **never delete the MID** (funds in flight). Regulatory hold variant: no pre-notify. | Need to halt traffic for a live partner, with or without prior notice. |
| [key-rotation.md](key-rotation.md)                       | Rotate a secret. Three triggers (scheduled / offboard / compromise). Dual-key window for planned, fast-cut for compromise. Always audit-log.                          | Quarterly rotation, personnel offboard, leak.                          |
| [disaster-recovery-drill.md](disaster-recovery-drill.md) | Quarterly DR exercise against staging. RTO 4 hr, RPO 15 min. Pre-drill announce → restore → smoke test → gap report.                                                  | Quarterly calendar trigger (Feb/May/Aug/Nov 15).                       |

## Severity matrix (cross-cutting)

| Sev  | Definition                                                        | Pager              | Comms cadence      | Resolve target |
| ---- | ----------------------------------------------------------------- | ------------------ | ------------------ | -------------- |
| Sev1 | Data loss / PII / regulatory / >25% users impacted / payment down | 5 min              | every 30 min       | 4 hr           |
| Sev2 | Service degradation / 5–25% users / single brand down             | next business hour | hourly             | 24 hr          |
| Sev3 | Minor / single partner / cosmetic / known issue with workaround   | next business day  | end-of-day summary | 5 day          |

## Who you page

Solo founder reality: Brodie holds all three incident roles — Incident Commander, Tech Lead, Comms Lead — until an external on-call rotation exists. Escalations:

| Situation                                    | Who                         | How                                 |
| -------------------------------------------- | --------------------------- | ----------------------------------- |
| Suspected PII breach                         | Legal counsel               | Phone — 1Password → Legal contacts  |
| Payment processing / MiCamp issue            | Steven (MiCamp ISO sponsor) | Phone — 1Password → Vendor contacts |
| Pre-qual / HighSale issue                    | Tim (HighSale)              | Phone — 1Password → Vendor contacts |
| Bank-partner notification (Sev1 money-flow)  | ISO sponsor liaison         | Per service agreement — within 2 hr |
| Regulator inbound (CFPB / state DFI / NYDFS) | Legal counsel               | Within 1 hr; do not self-respond    |

## Conventions

- All times in **UTC** in logs and timelines.
- Money in **integer cents**; APR in **basis points**. Never floats.
- Every state-changing operation logs to `audit_log` with `actor`, `action`, `target_type`, `target_id`, `payload_json`.
- Tenant scope: every query is scoped to `partner_id` (or `organization_id` once auth lands the broader concept). Never trust an ID from a request body.
- Idempotency: every retryable write checks `idempotency_keys` first.

## Tables referenced by these runbooks

All defined in `apps/partner-portal/lib/db/schema.ts`:

`partners`, `applications`, `application_events`, `offers`, `lenders`, `vertical_configs`, `partner_marketplaces`, `mids`, `decisions`, `audit_log`, `customer_migrations`, `provisioning_runs`, `webhook_inbox`, `idempotency_keys`, `partner_highsale_subaccounts`.

## Last-reviewed tracking

| Runbook                    | Last reviewed | Owner  | Next review |
| -------------------------- | ------------- | ------ | ----------- |
| incident-response.md       | 2026-05-26    | Brodie | 2026-08-26  |
| webhook-dlq.md             | 2026-05-26    | Brodie | 2026-08-26  |
| provisioning-rollback.md   | 2026-05-26    | Brodie | 2026-08-26  |
| partner-suspension.md      | 2026-05-26    | Brodie | 2026-08-26  |
| key-rotation.md            | 2026-05-26    | Brodie | 2026-08-26  |
| disaster-recovery-drill.md | 2026-05-26    | Brodie | 2026-08-26  |

Runbooks must be reviewed **every 90 days** OR after any postmortem that touched them. Whichever is sooner.

---

_This index is the entry point. Click through._
