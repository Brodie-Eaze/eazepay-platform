# Service Level Objectives (SLOs)

> Targets the platform commits to. Each SLO has a measurement window,
> an error budget, an action-when-breached, and a named owner.
> Owner of this doc: Engineering lead. Last reviewed: 2026-05-15.

These are operational SLOs. They are NOT bank-partner SLAs (those live
in the partner-bank service agreements and inherit from these).

## 1. API availability

| Field                | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Target               | 99.5% over 30 days, rolling                                                                      |
| Measurement          | Successful `GET /v1/health/ready` responses on the Railway health probe, divided by total probes |
| Exclusions           | Pre-announced maintenance windows (≤2 hr, ≤2 per quarter)                                        |
| Error budget         | 3.6 hours of downtime per 30 days                                                                |
| Action when breached | SEV2 follow-up review within 7 days; remediation tracked in Linear                               |
| Owner                | Engineering lead                                                                                 |

## 2. /v1/auth/login latency

| Field                | Value                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Target               | p95 < 800 ms over 7 days, rolling                                                              |
| Measurement          | OTEL span `http.server.duration` filtered by `http.route='/v1/auth/login'`                     |
| Exclusions           | None                                                                                           |
| Error budget         | 5% of 7-day window may exceed 800 ms (~8 h)                                                    |
| Action when breached | SEV3 follow-up; check Argon2 cost factor, Postgres connection pool, rate-limiter Redis latency |
| Owner                | Auth service owner (`services/auth`)                                                           |

## 3. /v1/applications/submit latency

| Field                | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Target               | p95 < 1500 ms over 7 days, rolling                                                                   |
| Measurement          | OTEL span `http.server.duration` for the submit route. Includes synchronous orchestration evaluation |
| Exclusions           | Requests that hit a downstream provider outage (provider-tagged span attribute)                      |
| Error budget         | 5% of 7-day window                                                                                   |
| Action when breached | SEV3; check orchestration policy execution time, provider HTTP latency, audit-outbox write time      |
| Owner                | Application service owner (`services/application`)                                                   |

## 4. /v1/admin/audit-logs latency

| Field                | Value                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Target               | p95 < 500 ms over 7 days, rolling                                                                   |
| Measurement          | OTEL span `http.server.duration` for any route under `/v1/admin/audit-logs/*`                       |
| Exclusions           | Time-window queries longer than 30 days (those are explicitly slow)                                 |
| Error budget         | 5% of 7-day window                                                                                  |
| Action when breached | SEV3; check `audit_outbox` GIN index (`20260515120100_audit_outbox_after_gin`), Postgres query plan |
| Owner                | Audit service owner (`services/audit`)                                                              |

## 5. Outbound webhook dispatch — first-attempt success

| Field                | Value                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Target               | > 95% of first-attempt deliveries succeed over 7 days, rolling                                                                        |
| Measurement          | `webhook_deliveries` table: `COUNT(*) FILTER (WHERE attempt = 1 AND status IN ('delivered'))` ÷ `COUNT(*) FILTER (WHERE attempt = 1)` |
| Exclusions           | Endpoints in `consecutive_failures` auto-pause state (these have already breached)                                                    |
| Error budget         | 5% of 7-day window                                                                                                                    |
| Action when breached | SEV3; inspect endpoint health, SSRF blocklist hits, signing-key rotation events                                                       |
| Owner                | Webhook service owner (`services/webhook`)                                                                                            |

## How error budgets are spent

When the rolling error budget for an SLO is exhausted:

1. New feature work touching that surface is paused.
2. Engineering lead opens a reliability ticket in Linear.
3. The next two-week cycle prioritises remediation.
4. Once the rolling window heals (and the SLO is green for 7 days),
   feature work resumes.

## Reporting cadence

- Weekly snapshot in `#engineering` Slack — IC posts a one-line
  green/yellow/red for each of the 5 SLOs.
- Quarterly SLO review with CCO — captured in
  `docs/runbooks/slo-reviews/YYYY-QN.md`.
- Annual review of the targets themselves — adjusted upward only
  after two consecutive quarters of comfortable headroom.
