# Webhook DLQ — Stuck or Failed Inbox Rows

> **TL;DR (60s):** Rows in `webhook_inbox` have `processing_status='failed'` AND `attempts >= 5`. Upstream (MiCamp/HighSale/Trutopia/Stripe) ack'd 200 but the worker cannot drain the row. First action: snapshot the DLQ (`SELECT … LIMIT 20`), classify the failure reason, and decide replay vs skip per category. **Do not** mass-replay without classifying — replaying signature failures will just re-fail.

## When this fires

- Alert: `webhook_inbox_failed_total{status="failed"} > 0 for 5m` (Prometheus rule, future iteration)
- Manual signal: `processInbox()` tick log shows non-zero `failed` count for 3 consecutive ticks
- Partner reports "I see the event in your provider's dashboard but nothing happened on my side"
- Provisioning hangs because a MiCamp settlement webhook never landed an offer / mid update

**Customer impact:** lender offers missing, partner settlement data stale, provisioning runs stuck waiting for an upstream ack. No money moves in error — the inbox is write-then-200 by design.

## Severity

- **Sev1** — `webhook_inbox` has >100 rows with `processing_status='failed'` and any are MiCamp settlement events. Money-flow visibility broken.
- **Sev2** — 10–100 failed rows OR DLQ growing for >15 min OR any failed row is older than 1 hr.
- **Sev3** — <10 failed rows, all stale (>24h), no business impact.

## Diagnosis (5 min)

### 1. Get the DLQ snapshot

```sql
SELECT id, provider, event_type, processing_status, attempts, failure_reason,
       received_at, processed_at
FROM webhook_inbox
WHERE processing_status = 'failed' AND attempts >= 5
ORDER BY received_at DESC
LIMIT 20;
```

Healthy: zero rows or stale rows that have been triaged (note in `audit_log`).
Sick: rows with `received_at` < 1 hr ago, or rows with `failure_reason LIKE '%signature%'`.

### 2. Group by failure_reason

```sql
SELECT provider, failure_reason, count(*) AS n,
       min(received_at) AS oldest, max(received_at) AS newest
FROM webhook_inbox
WHERE processing_status = 'failed' AND attempts >= 5
GROUP BY provider, failure_reason
ORDER BY n DESC;
```

Healthy: empty result set.
Sick: one cluster dominates — that is your root cause.

### 3. Check the live backlog

```sql
SELECT processing_status, count(*)
FROM webhook_inbox
WHERE received_at > now() - interval '1 hour'
GROUP BY processing_status;
```

Healthy: `pending` < 50, `done` growing, no `failed`.
Sick: `pending` growing faster than `done` → worker is wedged, not just DLQ.

### 4. Confirm worker is running

```bash
railway logs --service workers --tail 200 | grep webhook.processor
```

Healthy: `webhook.processor.tick.invoked` log lines every 30s with `backlogPending` decreasing.
Sick: no tick logs in 2+ min → worker process is dead; restart it (`railway restart --service workers`).

## Mitigation (do in order)

1. **Confirm the worker is running.** If not, restart `workers` service. Why: replaying into a dead worker just re-DLQs the rows. Verify: tick log lines resume.

2. **Classify the dominant failure_reason** (root-cause categories below) before touching any row. Why: each category has a different mitigation — replaying signature failures with the old key just refails them.

3. **Manual drain via admin endpoint.** The primary dispatcher is the BullMQ worker; this endpoint is the ops escape hatch for re-draining all `pending` rows after a handler bugfix.

   ```bash
   curl -fsS -X POST https://partner-portal.up.railway.app/api/admin/webhook-processor/tick \
     -H "Cookie: ${ADMIN_SESSION_COOKIE}" | jq .
   ```

   Why: requeues the BullMQ jobs for every `pending` row. Verify: response includes `{ "processed": N, "backlogPending": M }`; re-run `webhook_inbox` query — `pending` count should drop.

4. **For specific stuck rows — promote `failed` back to `pending`** (only after classification + fix):

   ```sql
   -- CAUTION: only after you have applied the fix that addresses the failure_reason.
   UPDATE webhook_inbox
   SET processing_status = 'pending', attempts = 0, failure_reason = NULL
   WHERE id IN ('<uuid>', '<uuid>')
     AND processing_status = 'failed';
   ```

   Then tick the processor (step 3).

5. **Skip / discard events that should never succeed** (e.g. test events from a sandbox key that leaked into prod):

   ```sql
   -- CAUTION: audit the IDs first. This is destructive — keep a CSV export.
   \copy (SELECT * FROM webhook_inbox WHERE id IN ('<uuid>', '<uuid>'))
     TO '/tmp/discarded-webhooks.csv' CSV HEADER;

   DELETE FROM webhook_inbox
   WHERE id IN ('<uuid>', '<uuid>')
     AND processing_status = 'failed';
   ```

   Always log the discard in `audit_log`:

   ```sql
   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'webhook.inbox.discarded', 'webhook_inbox', '<uuid>',
           '{"reason": "sandbox event in prod", "discarded_at": "<iso>"}');
   ```

6. **Verify drain completed.** Re-run the diagnosis queries; `pending` and `failed` should both be near zero.

## Root cause categories

| Category                                                  | Disambiguation test                                                                                    | Fix                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Bad signature (sender key rotated)**                    | `failure_reason LIKE '%signature%' OR '%hmac%'`, all from one `provider` after a known rotation        | Roll the new secret into env, dual-key window per [`key-rotation.md`](key-rotation.md), then promote rows to `pending` |
| **Schema mismatch (provider deployed a breaking change)** | `failure_reason LIKE '%zod%' OR '%parse%' OR '%missing field%'`; spot-check `raw_body` for a new field | Ship handler fix; promote rows                                                                                         |
| **Downstream service down**                               | `failure_reason LIKE '%ECONN%' OR '%timeout%' OR '%503%'`; upstream status page red                    | Wait for upstream; promote rows after recovery                                                                         |
| **Idempotency conflict**                                  | `failure_reason LIKE '%duplicate%' OR '%unique%'`; row already done under a different `event_id`       | Discard — already processed                                                                                            |
| **Worker bug**                                            | `failure_reason` includes a stack trace at a specific commit; no upstream change                       | Roll back partner-portal/workers deploy; promote rows                                                                  |
| **Provider replayed an old event**                        | `received_at` clusters around an upstream incident window; events older than 30d                       | Discard — already processed in original window                                                                         |

## Communication template

### Internal Slack (every 30 min for Sev1, hourly for Sev2)

```
SEV-{N} | Webhook DLQ — {provider} | {N} failed rows
Symptom: {failure_reason cluster}
Mitigation: {drain in progress | waiting on upstream | handler fix in deploy}
Backlog: pending={N} failed={N}
Next update: {HH:MM UTC}
```

### Partner email (when a partner-specific event is stuck)

```
Subject: EazePay — webhook delivery delay — {partner / brand}

Hi {first name},

We had a delay processing a {provider} event for your account on {date}.
The event arrived correctly; our worker couldn't drain it for {duration}
because {one-line cause — "an upstream provider deployed a schema change"
or "an internal signature verification key was rolled"}.

No customer money moved in error. We have replayed the event and your
dashboard should now reflect the correct state. If anything still looks
off, reply to this email.

— EazePay Engineering
```

## Post-incident

| Item                                                                                          | Owner  | Timing                   |
| --------------------------------------------------------------------------------------------- | ------ | ------------------------ |
| Postmortem owner                                                                              | Brodie | Within 48 hr (Sev1/Sev2) |
| Discarded rows logged to `audit_log` with reason                                              | Brodie | At discard time          |
| 48h action: Add Prometheus alert on `webhook_inbox` failed-row count if missing               | Brodie | Within 48 hr             |
| 48h action: Add per-event manual replay endpoint (currently only bulk drain) — see Gaps below | Brodie | File as issue            |
| 7d follow-up: Verify alert fires correctly with a synthetic test event                        | Brodie | Day 7                    |

## Gaps flagged

- **No per-event replay endpoint exists.** `/api/admin/webhook-processor/tick` re-drains _all_ `pending` rows; there is no `POST /api/admin/webhook-inbox/:id/replay`. Today the workaround is the SQL `UPDATE … SET processing_status='pending'` in step 4. File: add `POST /api/admin/webhook-inbox/[id]/replay` with admin auth + audit-log write.
- **No DLQ table.** "DLQ" today is `webhook_inbox WHERE processing_status='failed' AND attempts >= 5`. Working as designed (single source of truth) but a dedicated `webhook_dlq` view + Grafana panel would simplify ops.

## Related runbooks

- [`incident-response.md`](incident-response.md) — master process
- [`key-rotation.md`](key-rotation.md) — if cause is signature failure post-rotation
- [`provisioning-rollback.md`](provisioning-rollback.md) — if provisioning is stuck waiting on a MiCamp webhook

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
