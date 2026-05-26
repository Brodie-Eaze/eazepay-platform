# Incident Response — Master Runbook

> **TL;DR (60s):** Something looks wrong in production. Classify severity in the first 5 minutes (matrix below), open `#incident-YYYY-MM-DD`, take a state snapshot, then open the matching specialized runbook. As a solo founder you hold all three incident roles — Incident Commander, Tech Lead, and Comms Lead — so write everything down. The default order is **stop the bleeding, restore service, then root-cause**.

## When this fires

- Synthetic probe of `/api/health` or `/api/admin/webhook-processor/tick` returns non-2xx twice in 5 minutes
- A consumer or partner reports a production-impacting bug
- Any unexplained spike in 5xx, decline rate, or `webhook_inbox.processing_status='failed'` depth
- A partner-bank (MiCamp) or lender (HighSale, Trutopia) API returns 5xx for more than 5 minutes
- A SEV-X label appears in a customer-support ticket
- Suspected PII exposure, suspected fraud, or any regulator inbound

Customer-visible impact ranges from "consumer cannot complete `/apply/<brand>`" (Sev1/Sev2) to "partner dashboard chart misaligned" (Sev3).

## Severity

| Sev      | Definition                                                                                       | Pager              | Comms cadence      | Resolve target |
| -------- | ------------------------------------------------------------------------------------------------ | ------------------ | ------------------ | -------------- |
| **Sev1** | Data loss / PII exposure / regulatory inbound / payment processing down / >25% of users impacted | 5 min              | every 30 min       | 4 hr           |
| **Sev2** | Service degradation / 5–25% users impacted / single brand down / webhook DLQ growing for >15 min | next business hour | hourly             | 24 hr          |
| **Sev3** | Minor — single partner issue, cosmetic on core UI, known issue with workaround                   | next business day  | end-of-day summary | 5 day          |

Err one tier high. Downgrading is cheap; upgrading mid-incident loses minutes.

## Diagnosis (5 min)

### 1. Classify and announce

```
# Open the channel
/channel-create #incident-2026-05-26

# Pin to channel
Sev: SEV-{1|2|3}
Commander: Brodie (sole role-holder)
Started: {HH:MM UTC}
Symptom: {one line}
Customer impact: {scope}
```

Healthy: channel exists, severity is set, start time recorded.
Sick: incident running for 10+ min without a channel — stop and create it.

### 2. Snapshot before you touch anything

```bash
# Logs from each Railway service
railway logs --service partner-portal --tail 1000 > /tmp/incident-portal.log
railway logs --service eazepay-api    --tail 1000 > /tmp/incident-api.log
railway logs --service workers        --tail 1000 > /tmp/incident-workers.log

# Webhook inbox state (last 2 hours)
psql "$DATABASE_URL" -c "\copy (
  SELECT id, provider, event_type, processing_status, attempts, failure_reason, received_at
  FROM webhook_inbox
  WHERE received_at > now() - interval '2 hours'
  ORDER BY received_at DESC
) TO '/tmp/webhook-inbox-snapshot.csv' CSV HEADER"

# In-flight provisioning runs
psql "$DATABASE_URL" -c "\copy (
  SELECT id, partner_id, brand, status, started_at, failure_reason
  FROM provisioning_runs
  WHERE started_at > now() - interval '4 hours'
) TO '/tmp/provisioning-snapshot.csv' CSV HEADER"
```

Upload all four to the incident channel — they survive any service restart.

### 3. Health probe

```bash
curl -fsS https://partner-portal.up.railway.app/api/health | jq .
```

Healthy: `{"ok": true, "db": "ok", "redis": "ok"}`.
Sick: any field `"error"` or non-200 — go directly to mitigation.

## Mitigation (do in order)

1. **Roll back to the last known good deploy.** Do not try to fix the underlying bug while the site is on fire.

   ```bash
   railway rollback --service partner-portal
   railway rollback --service eazepay-api
   railway rollback --service workers
   ```

   _Why:_ a bad deploy is the most common Sev1 cause; rollback restores service in <2 min. _Verify:_ health probe green for 3 consecutive minutes.

2. **Open the specialized runbook** matching the symptom and execute its Mitigation block.

   | Symptom                                               | Runbook                                                    |
   | ----------------------------------------------------- | ---------------------------------------------------------- |
   | Webhook DLQ depth climbing / processing stuck         | [`webhook-dlq.md`](webhook-dlq.md)                         |
   | Provisioning stuck mid-flow / partner half-onboarded  | [`provisioning-rollback.md`](provisioning-rollback.md)     |
   | Partner doing harm / suspected fraud / regulator hold | [`partner-suspension.md`](partner-suspension.md)           |
   | Secret compromise / quarterly rotation                | [`key-rotation.md`](key-rotation.md)                       |
   | DR / full region loss                                 | [`disaster-recovery-drill.md`](disaster-recovery-drill.md) |

3. **If symptom does not fit a runbook:** declare Sev1, escalate (see tree below), and document the manual mitigation in the incident channel as you go.

4. **Verify exit conditions** (see Verification below). Do not close the incident until all are met.

## Root cause categories

| Category                    | Disambiguation test                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Bad deploy                  | `git log --oneline -10` shows a deploy in the last hour; rollback fixed it                  |
| Upstream provider outage    | MiCamp / HighSale / Trutopia status page red; their support confirms                        |
| DB capacity / lock          | `pg_stat_activity` shows >20 `idle in transaction` rows; `pg_locks` shows waits             |
| Webhook backlog             | `SELECT count(*) FROM webhook_inbox WHERE processing_status='pending'` > 500                |
| Secret rotation gone wrong  | 401s from upstream right after a rotation window — see [`key-rotation.md`](key-rotation.md) |
| Misconfigured tenant cutoff | `partners.status='suspended'` flipped unexpectedly; check `audit_log`                       |
| Cron / orchestrator wedge   | `provisioning_runs.status='running'` with `started_at > 30 min ago`                         |

## Communication template

### Internal Slack (initial post)

```
SEV-{N} | {one-line symptom}
Commander: Brodie
Channel: #incident-{date}
Status: investigating | mitigating | monitoring | resolved
Customer impact: {all partners | one brand | one partner | internal-only}
Started: {HH:MM UTC}
Next update: {HH:MM UTC} ({30 min for Sev1 | 60 min for Sev2})
```

### Status page (Statuspage.io — wire-up pending)

```
Investigating — We are investigating reports of {symptom} affecting {scope}.
We will provide an update by {HH:MM UTC}. No action required from you.
```

### Customer email (Sev1 with named impact)

```
Subject: EazePay incident — {brand} — {date}

Hi {first name},

We had a production incident affecting {scope} from {start UTC} to {end UTC}.
Impact: {one sentence on what stopped working, what kept working}.
Mitigation: {one sentence on what we did}.
Root cause: {one sentence; "still under investigation" is acceptable for Sev2+}.
Next steps: full postmortem within 72 hours, shared directly.

If you saw downstream impact we have not yet noticed, please reply so we
capture it in the postmortem.

— EazePay Engineering
```

### Partner Slack (when partner-specific)

```
Heads up — we paused {capability} for {partner / brand} from {start} to {end}
while we resolved {symptom}. No customer money moved in error. Full
postmortem to follow within 72 hours.
```

## Post-incident

| Item                                                               | Owner     | Due                                |
| ------------------------------------------------------------------ | --------- | ---------------------------------- |
| Resolved status on status page                                     | Commander | At resolution                      |
| Postmortem doc stub created at `docs/postmortems/{date}-{slug}.md` | Commander | Within 24 hr                       |
| Full postmortem (timeline, RCA, action items table)                | Commander | Within 48 hr (Sev1) / 72 hr (Sev2) |
| Action items filed as GH issues with owners + due dates            | Commander | Within 7 d                         |
| 7-day follow-up: have action items shipped?                        | Commander | Day 7                              |

Use this postmortem skeleton:

```
# Postmortem — {short title}

Date: {YYYY-MM-DD}     Severity: SEV-{N}
Duration: {HH:MM UTC} → {HH:MM UTC} ({minutes} min)
Commander: Brodie

## Summary
{Two sentences: what happened, what the impact was.}

## Timeline (UTC)
- HH:MM — {event}

## Impact
- Customers affected: {count or scope}
- Partners affected: {list}
- Money at risk / moved in error: {USD or "none"}
- Data exposed: {none / list}

## Root cause
{Why. Avoid "human error" — ask "what allowed the human error to reach prod?"}

## What went well / What went poorly
- {bullets}

## Action items
| Owner | Action | Due | Ticket |
| --- | --- | --- | --- |
| @brodie | {specific, dated, owned} | YYYY-MM-DD | EAZ-### |
```

## Escalation tree

Solo-founder reality: you are the entire on-call rotation. The tree below is who you _call out to_ — not internal staff.

1. **Engineering lead (yourself):** classify, command, scribe, comms. Set timers on phone for next-update cadence.
2. **Legal counsel:** wake immediately on any _suspected_ PII breach or regulator inbound. Do not wait for confirmation. (Contact card: 1Password → Legal contacts.)
3. **MiCamp** (Steven, ISO sponsor): money-flow incidents within 30 min. (1Password → Vendor contacts.)
4. **HighSale** (Tim): pre-qual / soft-pull incidents within 30 min.
5. **Bank partner notification:** required within 2 hr for Sev1 affecting money flow per ISO sponsor agreement.
6. **Regulator notification:** legal-counsel decision. Default to statutory clock — NYDFS 23 NYCRR 500 = 72 hr; GLBA notification thresholds; state DFI per-state. Do not self-disclose without counsel.

## Related runbooks

- [`webhook-dlq.md`](webhook-dlq.md) — webhook inbox stuck
- [`provisioning-rollback.md`](provisioning-rollback.md) — half-onboarded partner
- [`partner-suspension.md`](partner-suspension.md) — partner doing harm / regulator hold
- [`key-rotation.md`](key-rotation.md) — secret compromise / quarterly rotation
- [`disaster-recovery-drill.md`](disaster-recovery-drill.md) — region loss / DB corruption

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
