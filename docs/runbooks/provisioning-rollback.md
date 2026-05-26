# Provisioning Rollback — Half-Onboarded Partner

> **TL;DR (60s):** A `POST /api/onboarding/provision` run partially succeeded — some of the four steps (HighSale sub-account, marketplace defaults, MiCamp MID, partner-portal seed) ran, then a later one failed. The partner now exists in some upstream systems but not others. First action: identify the run in `/admin/provisioning`, decide retry vs full rollback via the decision tree, then execute per-step rollback in **reverse order**.

## When this fires

- Alert: `provisioning_runs WHERE status='failed'` with at least one step `done` in `steps_json`
- Admin manual signal: `/admin/provisioning` row shows mixed step states
- Partner reports "I got the welcome email but cannot log in" / "I can log in but no MID"
- Orchestrator stuck (`status='running'`, `started_at > 30 min ago`) — treat as failed for triage

**Customer impact:** new partner cannot transact. No live consumer data at risk (provisioning runs before any application traffic).

## Severity

- **Sev2** — partner expecting same-day go-live, blocked
- **Sev3** — partner in next-day batch, can be re-run next morning

A partner that has already taken any live application traffic is **NOT** a provisioning incident — see [`partner-suspension.md`](partner-suspension.md).

## Diagnosis (5 min)

### 1. Identify the failed run

Open `https://partner-portal.up.railway.app/admin/provisioning` and locate the row, OR:

```sql
SELECT id, partner_id, brand, status, started_at, completed_at, failure_reason,
       steps_json
FROM provisioning_runs
WHERE status IN ('failed', 'running')
  AND started_at > now() - interval '24 hours'
ORDER BY started_at DESC;
```

Healthy: no rows or all rows `status='completed'`.
Sick: `status='failed'` with one or more `done` entries in `steps_json`, OR `status='running'` for >30 min.

### 2. Pull the steps_json to see what landed

```sql
SELECT id, partner_id,
       steps_json::jsonb AS steps,
       failure_reason
FROM provisioning_runs
WHERE id = '<run-uuid>';
```

`steps_json` is an array `[{name, status, ...}]`. Status walks: `pending → running → done | failed`. Identify which steps say `done` — those need rollback.

### 3. Check downstream state matches steps_json

```sql
-- MiCamp MID step → check mids table
SELECT id, micamp_mid, provisioning_status, created_at
FROM mids
WHERE partner_id = '<partner-id>'
ORDER BY created_at DESC;

-- HighSale sub-account step → check partner_highsale_subaccounts
SELECT id, subaccount_id, bureau, created_at
FROM partner_highsale_subaccounts
WHERE partner_id = '<partner-id>';

-- Marketplace defaults → check partner_marketplaces
SELECT lender_id, state, reason, created_at
FROM partner_marketplaces
WHERE partner_id = '<partner-id>';

-- Partner-portal seed → check partners row
SELECT id, brand, legal_name, status, primary_contact_email, created_at
FROM partners
WHERE id = '<partner-id>';
```

Healthy: each table matches what `steps_json.done` claims.
Sick: a step says `done` but the corresponding table is empty (or vice versa) — orchestrator state drifted from reality.

### 4. Customer migration variant

If this partner came through the AI Funding → MedPay migration (July 1 batch), also check:

```sql
SELECT id, source_customer_id, target_partner_id, status, step_state_json, failure_reason
FROM customer_migrations
WHERE target_partner_id = '<partner-id>';
```

`step_state_json` mirrors `provisioning_runs.steps_json` semantics.

## Mitigation (do in order)

### Retry vs rollback decision tree

```
Was the failure caused by a transient upstream error? (5xx, timeout, rate limit)
├─ YES → RETRY. Re-POST /api/onboarding/provision with the same partnerId.
│         The orchestrator is idempotent per-step; done steps are skipped.
└─ NO ──→ Was the failure caused by bad config in the request body?
          ├─ YES → ROLLBACK COMPLETED STEPS, then re-POST with corrected body.
          └─ NO ──→ Was the failure inside a step's own logic (orchestrator bug)?
                    ├─ YES → ROLLBACK, ship orchestrator fix, then retry.
                    └─ NO ──→ Escalate; do not touch state until classified.
```

### Per-step rollback (reverse order of execution)

Rollback in reverse so each step removes the artifact the next would have read.

1. **Partner-portal seed → archive partner row.** Why: prevents the half-provisioned partner showing up in admin lists / consumer apply funnels.

   ```sql
   -- CAUTION: do NOT delete the row. partners.status='archived' preserves
   -- audit history (audit_log.target_id, provisioning_runs.partner_id).
   UPDATE partners
   SET status = 'archived', updated_at = now()
   WHERE id = '<partner-id>';

   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'partner.archived', 'partner', '<partner-id>',
           json_build_object(
             'reason', 'provisioning_rollback',
             'run_id', '<run-uuid>'
           )::text);
   ```

   Verify: `SELECT status FROM partners WHERE id='<partner-id>'` returns `'archived'`.

2. **Marketplace defaults → revoke per-partner overrides.** Why: prevents the marketplace exposing a partner that does not exist downstream.

   ```sql
   -- CAUTION: this only clears partner_marketplaces. The vertical_configs
   -- enabled_lender_ids is platform-level and untouched.
   DELETE FROM partner_marketplaces
   WHERE partner_id = '<partner-id>';
   ```

   Verify: `SELECT count(*) FROM partner_marketplaces WHERE partner_id='<partner-id>'` returns 0.

3. **MiCamp MID → mark canceled, do NOT delete.** Why: MiCamp keeps the MID issued upstream; we must reconcile. Funds-in-flight risk: if any settlement is mid-flight we need the row to receive the webhook and credit/refund correctly.

   ```sql
   -- CAUTION: do NOT delete. partners → mids has ON DELETE RESTRICT for
   -- exactly this reason. Use the canceled provisioning_status instead.
   UPDATE mids
   SET provisioning_status = 'rejected', updated_at = now()
   WHERE partner_id = '<partner-id>';

   INSERT INTO audit_log (actor, action, target_type, target_id, payload_json)
   VALUES ('brodie', 'mid.canceled', 'mid',
           (SELECT id::text FROM mids WHERE partner_id='<partner-id>' LIMIT 1),
           json_build_object('reason', 'provisioning_rollback')::text);
   ```

   Then **call MiCamp** (Steven) to confirm upstream cancellation. The local UPDATE alone does not cancel the MID at the processor.
   Verify: `mids.provisioning_status = 'rejected'` locally + MiCamp portal shows MID canceled.

4. **HighSale sub-account → archive upstream.** Why: a live HighSale sub-account against a non-existent partner can be used by a guess-the-id attacker (SEC-001 territory).

   ```sql
   -- Local mapping table cleanup first
   DELETE FROM partner_highsale_subaccounts
   WHERE partner_id = '<partner-id>';
   ```

   Then call HighSale (Tim) or use their admin UI to archive the `hs_*` sub-account ID. The local DELETE alone does **not** remove the upstream sub-account.
   Verify: HighSale dashboard shows sub-account archived.

5. **Mark the provisioning run rolled_back.**

   ```sql
   UPDATE provisioning_runs
   SET status = 'failed',
       failure_reason = COALESCE(failure_reason, '') || ' [rolled_back]',
       completed_at = now()
   WHERE id = '<run-uuid>';
   ```

6. **If this was a customer_migration row, also mark it rolled_back.**

   ```sql
   UPDATE customer_migrations
   SET status = 'rolled_back', updated_at = now(),
       failure_reason = COALESCE(failure_reason, '') || ' [rolled_back]'
   WHERE target_partner_id = '<partner-id>';
   ```

7. **Re-run provisioning with corrected inputs** (if applicable):
   ```bash
   curl -fsS -X POST https://partner-portal.up.railway.app/api/onboarding/provision \
     -H "Cookie: ${ADMIN_SESSION_COOKIE}" \
     -H 'Content-Type: application/json' \
     -d @/tmp/provision-config.json
   ```
   Use a **new** `partnerId`. Reusing the archived id is fine technically (status='archived' lets a new run reuse it after re-activation) but generates confusing audit trails — prefer a new id.

## Root cause categories

| Category                               | Disambiguation test                                           | Action                                                 |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Upstream 5xx (transient)               | `failure_reason LIKE '%503%' OR '%timeout%'`                  | Retry — orchestrator is idempotent per-step            |
| Bad request body (validator caught)    | `failure_reason LIKE '%invalid_provision_config%'`            | Rollback + re-submit with fixed body                   |
| MiCamp underwriting rejected           | `failure_reason LIKE '%underwriting%'`                        | Rollback; partner does not qualify — escalate to sales |
| HighSale sub-account collision         | `failure_reason LIKE '%subaccount%exists%'`                   | Investigate id collision; rollback the duplicate run   |
| Orchestrator bug (regression)          | Stack trace in `failure_reason`; multiple recent runs failing | Roll back orchestrator deploy; rollback affected runs  |
| Worker dead (status='running' forever) | `started_at > 30 min ago` AND status='running'                | Restart workers service; force run to `failed`; re-run |

## Communication template

### Internal Slack

```
SEV-{N} | Provisioning rollback — {partner_id} | run={run-uuid}
Stuck step: {step_name}
Rollback progress: portal=done | marketplace=done | mid=pending | highsale=pending
Retry plan: {immediate | waiting on upstream | bug-fix-needed}
Next update: {HH:MM UTC}
```

### Partner email

```
Subject: EazePay onboarding — {partner legal name} — temporary delay

Hi {first name},

Your account setup hit a snag at the {step description} step. We are
backing out the partial setup now and will re-run a clean provisioning
once {one-line reason — "we confirm the underwriting hold with our
processor" or "we ship a fix"}.

You do not need to do anything. We will email when your account is live.
ETA: {next business day | within N hours}.

— EazePay Onboarding
```

## Post-incident

| Item                                                                                           | Owner  | Timing       |
| ---------------------------------------------------------------------------------------------- | ------ | ------------ |
| Postmortem (Sev2 only)                                                                         | Brodie | Within 72 hr |
| Confirm upstream cancellation (MiCamp + HighSale)                                              | Brodie | Within 24 hr |
| 48h action: add idempotent re-run guard on orchestrator if same partnerId hits twice in <5 min | Brodie | Within 48 hr |
| 7d follow-up: confirm partner is live and transacting                                          | Brodie | Day 7        |

## Related runbooks

- [`incident-response.md`](incident-response.md) — master
- [`webhook-dlq.md`](webhook-dlq.md) — if provisioning hangs waiting on a MiCamp settlement webhook
- [`partner-suspension.md`](partner-suspension.md) — partner already live and needs to be stopped

---

_Last reviewed: 2026-05-26 — Owner: Brodie_
