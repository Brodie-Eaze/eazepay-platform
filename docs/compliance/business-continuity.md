# Business continuity + disaster recovery plan

> SOC 2 A1.2, A1.3 — Backup, recovery, and capacity to support
> commitments. Owner: Engineering lead + CCO. Last reviewed: 2026-05-15.

## RTO / RPO targets

| Tier                                    | RTO (recovery time) | RPO (recovery point) |
| --------------------------------------- | ------------------- | -------------------- |
| Baseline (today, single-region Railway) | 4 hours             | 24 hours             |
| Target (post multi-region rollout)      | 1 hour              | 1 hour               |

These targets are written into partner-bank service agreements once
those contracts go live. The baseline is honest about current
capability; the target requires the multi-region infrastructure under
`infra/terraform/envs/prod/` to be activated.

## Backup procedure

| Asset                                         | Backup method                                            | Retention                      | Restore-tested         |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------ | ---------------------- |
| Postgres (Railway)                            | Daily automated snapshot via Railway                     | 7 days hot + 4 weekly archives | Quarterly drill        |
| Audit sink (planned: DynamoDB cross-account)  | Point-in-time recovery enabled                           | 35 days                        | Quarterly drill        |
| Object storage (compliance docs, planned: S3) | S3 versioning + lifecycle to Glacier                     | 7 years FCRA                   | Annual restore         |
| Source code                                   | GitHub (`eazepay/*`) + local mirrors on engineer laptops | Indefinite                     | Continuously verified  |
| Environment configuration                     | Railway env var snapshot (manual)                        | 1 year                         | Quarterly drill        |
| KMS KEK (planned: AWS KMS)                    | AWS-managed multi-AZ                                     | Indefinite                     | Tested via JIT decrypt |

Local-fs sinks (`local-fs-audit-sink.adapter.ts`,
`LOCAL_FS_STORAGE_ROOT`) are dev-only and are NOT backed up. Their
production replacements (DynamoDB, S3) ARE.

## Restore drill cadence

**Quarterly** — Engineering lead schedules a drill on the 15th of
March, June, September, December.

Drill checklist:

1. Spin up a clean Railway preview environment from the latest
   Postgres snapshot.
2. Confirm migrations apply cleanly (`pnpm prisma migrate deploy`).
3. Replay the last 24h of audit-outbox rows against the verify-chain
   command; confirm hash chain validates end-to-end.
4. Restore a sample compliance document from object storage and
   confirm signed-URL access works.
5. Record findings in `docs/runbooks/dr-drills/YYYY-QN.md`.

A failed drill is treated as a SEV2 incident; remediation tracked in
Linear with a follow-up drill scheduled within 30 days.

## Failover

**Today (single-region Railway, US-East):**

- A Railway regional outage means EazePay is down. RTO 4h depends on
  Railway recovery; we accept this risk in the partner agreement.
- Mitigation during outage: status page open, partner banks notified
  per service agreement, and the IC follows the 5-step incident
  protocol in `docs/runbooks/incident-response.md`.

**Target (multi-region via `infra/terraform/envs/prod/`):**

- Active-active across two AWS regions (US-East + US-West).
- Aurora global database with cross-region replication.
- DNS failover via Route53 health checks (60-second TTL).
- Audit sink writes to a single Region-1 DynamoDB table with global
  tables replicating to Region-2 for read-only failover.

Activation of the multi-region plan is gated by:

1. Sponsor bank contract requiring it OR
2. Aggregate monthly revenue triggering the cost threshold.

Until activation, the baseline RTO/RPO above is the truthful target
and partners are told so explicitly.

## Communication plan during outage

| Audience                           | Channel                                    | When                                          | Owner                 |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------- | --------------------- |
| Internal team                      | Slack `#incident`                          | Immediately on SEV1 / SEV2 declaration        | IC                    |
| Consumers + merchants              | Status page (status.eazepay.com)           | Within 15 min of SEV1 declaration             | IC delegates to comms |
| Partner banks                      | Direct phone + email per service agreement | Within 2 hours of SEV1 if money flow affected | IC + CCO              |
| Regulators (CFPB, state AG, NYDFS) | Per statutory window                       | NYDFS 72h, GLBA per incident type             | CCO + legal counsel   |
| Press / external                   | Holding statement only, no detail          | Only on CCO instruction                       | CCO                   |

Communication templates live alongside this doc (planned:
`docs/runbooks/communication-templates.md`).
