# Disaster Recovery Drill — Quarterly

> **TL;DR (60s):** Quarterly DR drill against the staging environment. Targets: **RTO 4 hr, RPO 15 min**. The drill walks a simulated full region loss — restore Postgres from the most recent snapshot, redeploy every service, verify auth/payments/decision-engine/webhooks resume, then file a gap report. Pass criteria: full restore + smoke test completes in ≤4 hr with no live customer impact. **Always run against staging.** Never drill against prod.

## When this fires

- Calendar: every 90 days (Q1: Feb 15, Q2: May 15, Q3: Aug 15, Q4: Nov 15)
- Trigger event: an actual prod incident where DR could have been needed (informal drill within 30 days)
- New service added: drill within 30 days of any new long-running service joining the stack
- Vendor change: MiCamp, HighSale, Railway, or Postgres-host migration

**Customer impact during drill:** zero — drill runs against staging. If staging is shared with anything customer-facing (it shouldn't be), pause that traffic first.

## Severity

This runbook is a **planned exercise**, not a Sev. If during a drill you discover a real prod bug, fork to the relevant runbook and re-classify (typically Sev2 because it's discovered, not triggered).

## Targets

| Metric                             | Definition                                                   | Target       |
| ---------------------------------- | ------------------------------------------------------------ | ------------ |
| **RTO** (Recovery Time Objective)  | Wall-clock from "region declared lost" to "smoke test green" | **≤ 4 hr**   |
| **RPO** (Recovery Point Objective) | Max data loss measured in clock time                         | **≤ 15 min** |
| Smoke-test pass rate               | % of critical-path checks green post-restore                 | 100%         |
| Backup integrity                   | Last successful Postgres snapshot age                        | ≤ 24 hr      |

## Pre-drill (T minus 1 week)

### 1. Announce

```
Slack #ops-alerts and #eng one week before:

DR drill — staging — {date} {start UTC} → {end UTC}
Scope: full region-loss simulation.
Impact: zero customer impact (staging only).
Run-book: docs/runbooks/disaster-recovery-drill.md
Drill commander: Brodie
```

### 2. Confirm staging is in a known-good baseline

```bash
# Staging health check
curl -fsS https://partner-portal-staging.up.railway.app/api/health | jq .
```

Healthy: `{"ok": true, "db": "ok", "redis": "ok"}` on every service.
Sick: fix staging FIRST. Do not drill against a broken baseline.

### 3. Snapshot prod (independent of automated backup)

```bash
# Manual prod snapshot — labelled, retained 90 days
pg_dump "$PROD_DATABASE_URL" -Fc -Z 6 \
  -f /tmp/pre-drill-prod-snapshot-$(date +%Y%m%d).dump

# Upload to long-term backup bucket
aws s3 cp /tmp/pre-drill-prod-snapshot-*.dump \
  s3://eazepay-backups/manual/dr-drill/
```

Healthy: dump file >100MB, S3 PUT returns 200.
Sick: pg_dump fails — investigate prod DB before drilling.

### 4. Pre-drill comms to vendors (optional, recommended)

Email Steven (MiCamp) and Tim (HighSale): "We are running a quarterly DR drill against our staging environment on {date}. You may see a brief uptick in webhook retries to staging. No prod traffic affected."

## Drill steps (T = 0)

### 1. Declare region lost (simulated)

Start a timer. T0 is now.

```
Slack #ops-alerts:
DR DRILL T0 | region us-east-1 declared lost | RTO target 4 hr
Commander: Brodie
```

### 2. Restore DB to a fresh staging instance (T0+0 to T0+90 min)

```bash
# Provision a fresh Postgres instance in the recovery region
railway service create --name eazepay-staging-recovery --plugin postgresql

# Get its DATABASE_URL
RECOVERY_URL=$(railway variables --service eazepay-staging-recovery --json | jq -r .DATABASE_URL)

# Restore from the most recent automated snapshot
LATEST_SNAPSHOT=$(aws s3 ls s3://eazepay-backups/automated/ | tail -1 | awk '{print $4}')
aws s3 cp "s3://eazepay-backups/automated/$LATEST_SNAPSHOT" /tmp/restore.dump

pg_restore --dbname="$RECOVERY_URL" \
  --no-owner --no-acl --clean --if-exists \
  -j 4 /tmp/restore.dump

# Verify row counts
psql "$RECOVERY_URL" -c "
  SELECT 'partners' AS table, count(*) FROM partners
  UNION ALL SELECT 'applications', count(*) FROM applications
  UNION ALL SELECT 'mids', count(*) FROM mids
  UNION ALL SELECT 'provisioning_runs', count(*) FROM provisioning_runs
  UNION ALL SELECT 'webhook_inbox', count(*) FROM webhook_inbox
  UNION ALL SELECT 'audit_log', count(*) FROM audit_log
  UNION ALL SELECT 'customer_migrations', count(*) FROM customer_migrations;
"
```

Healthy: row counts within 1% of prod (snapshot was ≤24 hr old). Restore completes in <90 min for ~10GB DB.
Sick: restore errors, missing tables, or row counts off by >10% — abort drill, file as Sev2 (backup integrity).

Record the actual elapsed time at this checkpoint.

### 3. Redeploy services pointed at recovered DB (T0+90 to T0+150)

```bash
railway variables set DATABASE_URL="$RECOVERY_URL" --service partner-portal-staging
railway variables set DATABASE_URL="$RECOVERY_URL" --service eazepay-api-staging
railway variables set DATABASE_URL="$RECOVERY_URL" --service workers-staging

railway redeploy --service partner-portal-staging
railway redeploy --service eazepay-api-staging
railway redeploy --service workers-staging

# Wait for healthchecks
for svc in partner-portal-staging eazepay-api-staging workers-staging; do
  until curl -fsS "https://${svc}.up.railway.app/api/health" > /dev/null; do
    sleep 5
  done
  echo "$svc healthy"
done
```

Healthy: all three healthchecks green within 10 minutes of redeploy.
Sick: a service fails to boot against the recovered DB — capture logs, abort drill, file as Sev2.

### 4. Smoke test critical paths (T0+150 to T0+210)

Run the checks in this order. Each must pass before the next starts.

| #   | Check                        | Command                                                                          | Pass criteria                                         |
| --- | ---------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Auth                         | `curl /api/session` with valid cookie                                            | 200, `mode` field present                             |
| 2   | DB read                      | `SELECT count(*) FROM applications WHERE created_at > now() - interval '7 days'` | row returns within 500ms                              |
| 3   | Payments — issue test charge | `POST /api/test/charge` (staging-only route, $1 ping)                            | 200, transaction id returned                          |
| 4   | Decision engine              | `POST /api/decision-engine/evaluate` with fixture                                | 200, ranked lenders array non-empty                   |
| 5   | Webhook inbox drain          | `POST /api/admin/webhook-processor/tick`                                         | 200, `backlogPending` returned                        |
| 6   | Orchestrator resumes         | `POST /api/onboarding/provision` with fixture                                    | 202, run id returned; `provisioning_runs` row appears |
| 7   | BullMQ workers               | `railway logs --service workers-staging --tail 50`                               | tick lines every 30s                                  |

Healthy: 7/7 pass.
Sick: any failure → record in gap report, do not retry within the drill (the drill is about discovering gaps, not papering over them).

### 5. Record time-to-recover

```
Drill end time: {HH:MM UTC}
Actual elapsed: {HH:MM:SS}
Target: 4:00:00
Pass: {yes | no}
Checkpoints:
  - DB restore complete: T0+{HH:MM:SS}
  - Services healthy: T0+{HH:MM:SS}
  - Smoke test green: T0+{HH:MM:SS}
```

## Post-drill (T0+4hr to T+7d)

### 1. Tear down recovery environment

```bash
# Don't leave the recovery DB lingering — it costs money and drifts from prod.
railway service delete --name eazepay-staging-recovery --confirm
```

### 2. Restore staging to its pre-drill state

```bash
# Point staging services back at the original staging DB
railway variables set DATABASE_URL="$ORIGINAL_STAGING_URL" --service partner-portal-staging
railway redeploy --service partner-portal-staging
# ...repeat for eazepay-api-staging, workers-staging
```

### 3. File the gap report

Save as `docs/dr-drills/{date}-gap-report.md`:

```
# DR Drill — {date}

Commander: Brodie
RTO target: 4 hr   |   Actual: {HH:MM}
RPO target: 15 min |   Actual: {N min} (based on snapshot age)
Pass: {yes | no}

## What worked
- {bullets}

## What failed
- {bullets — each must produce an action item}

## Action items
| # | Action | Owner | Due | Ticket |
| - | --- | --- | --- | --- |
| 1 | {specific, dated, owned} | Brodie | YYYY-MM-DD | EAZ-### |

## Next drill: {date + 90d}
```

### 4. File follow-up tickets

Each "what failed" bullet becomes a GH issue with a due date inside the next 90 days (before the next drill). Track in the SOC2 evidence map.

## Pass criteria

The drill passes when **all** are true:

- DB restore from snapshot completed without errors
- All services booted against the recovered DB
- All 7 smoke-test checks green
- Total elapsed time ≤ 4 hr
- Snapshot age was ≤ 24 hr (RPO derived)
- Gap report filed within 7 d of drill end
- Action items filed as GH issues within 7 d

If any are missing → drill **fails**. File as Sev2 — DR readiness is a SOC2 control.

## Root cause categories (for failed drills)

| Category                           | Disambiguation                                         | Action                                                       |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Snapshot too old                   | RPO > 15 min                                           | Increase automated snapshot frequency                        |
| Restore too slow                   | RTO checkpoint 1 > 90 min                              | Tune pg_restore parallelism; consider point-in-time recovery |
| Service won't boot on recovered DB | Schema drift between staging and snapshot              | Force staging to track prod migrations                       |
| Smoke test fails on auth/payments  | Secret mismatch on recovery env                        | Document env-restore alongside DB-restore in this runbook    |
| Orchestrator doesn't resume        | `provisioning_runs.status='running'` rows wedge worker | Add resume-on-boot guard to orchestrator                     |

## Communication template

### Internal Slack (T0, mid, end)

```
DR DRILL T0    | staging | RTO target 4 hr | commander: Brodie
DR DRILL T+90m | restore complete | smoke test starting
DR DRILL END   | PASS/FAIL | actual {HH:MM} | gap report: <link>
```

### External (none)

DR drills are staging-only — no customer or partner notification required. If a prod-impacting incident emerges from the drill, fork to [`incident-response.md`](incident-response.md).

## Post-incident

This is a planned exercise. The post-drill checklist (gap report + action items + tear-down) **is** the post-incident process. Next drill is auto-scheduled +90 days.

## Related runbooks

- [`incident-response.md`](incident-response.md) — if the drill uncovers a real prod issue
- [`webhook-dlq.md`](webhook-dlq.md) — smoke test step 5 leans on this
- [`provisioning-rollback.md`](provisioning-rollback.md) — smoke test step 6 leans on this

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
