# Incident Response Runbook

Severity classification, on-call paths, communication, and the four
playbooks that cover ~85% of fintech incidents at our scale.

## Severity matrix

| Sev | Symptom | Response SLA | Comms |
|-----|---------|--------------|-------|
| SEV1 | Production down OR consumer money at risk OR PII breach | 15 min ack, 4 hr resolution target | StatusPage open, partner banks notified within 2 hr per service agreement |
| SEV2 | Major feature broken (orchestration / disbursement / collection cron) | 30 min ack, 24 hr | StatusPage open, internal Slack thread |
| SEV3 | Single-customer or non-money-path issue | 4 hr ack, 5 day | Internal only |
| SEV4 | Cosmetic / known-issue | Next sprint | Triage queue |

## Common playbooks

### 1. Disbursement cron broke

Symptoms: Stripe/Modern Treasury return-rate spike, or `Loan.status`
stuck at `funding_pending` for >2h.

1. Check `apps/workers` health (ECS service events).
2. Query `loans` for stuck rows: `WHERE status='funding_pending' AND updatedAt < now() - interval '2 hours'`.
3. Check the `Transaction` table for matching disbursement attempts. If
   none exist, the dispatcher never ran — restart the workers service.
4. If they exist with `status='failed'`, look at `failure_reason`.
   Provider outage → wait + retry; consumer-bank closure → contact CS;
   our error → fix + retry idempotency-keyed by loanId.
5. **Do not manually move state.** All transitions go through
   `PaymentService.disburseAndSchedule`.

### 2. Webhook deliveries dead-lettering

Symptoms: merchant reports they're not receiving events, or
`webhook_deliveries.status='dead_letter'` count climbs.

1. Check the endpoint URL is reachable from outside (curl from a
   bastion). Customer-side firewall changes are a common cause.
2. Look at recent attempts: `SELECT lastStatusCode, lastError FROM
   webhook_deliveries WHERE endpointId=? ORDER BY updatedAt DESC LIMIT 20`.
3. If consecutive failures hit 20, the endpoint auto-paused. Tell the
   merchant; they unpause via the dashboard after fixing.
4. Bulk-replay via the merchant dashboard's retry CTA, OR
   `service-webhook` admin endpoint for ops-side replay.

### 3. Risk gate over-declining

Symptoms: approval rate drops; manual review queue empties; consumer
complaints about "instant decline".

1. Check policy version on recent declines: `SELECT policyVersion,
   recommendation, COUNT(*) FROM risk_assessments WHERE createdAt >
   now() - interval '24 hours' GROUP BY 1,2`.
2. If the version changed recently, suspect a recent deploy. Roll back
   `RISK_*_THRESHOLD` env vars and observe.
3. Check upstream risk providers for outage (Sift / Plaid Signal
   status pages).
4. Risk service fail-OPEN by design — provider degradation should not
   cause spike. If it does, look for code-path divergence.

### 4. Audit chain mismatch

Symptoms: an admin-side verify-chain run reports `expected hash X,
got Y` for a date range. Treat as SEV1.

1. **Stop the audit drain immediately.**
2. Snapshot the affected `audit_outbox` rows + the sink JSONL files.
3. Compare canonicalJson(row) hashes between Postgres and sink. The
   first divergence point identifies whether tampering is in
   Postgres (live row mutated post-drain) or in the sink (file
   modified). Either is a SEV1 incident.
4. Notify CCO. The chain mismatch itself is a reportable matter
   under bank-partner agreements.

## Communication

- **Internal:** Slack `#incident` channel, severity prefix in the
  topic, IC named explicitly.
- **External (consumer):** StatusPage. Templates in
  `docs/runbooks/communication-templates.md`.
- **Partner banks:** per service agreement, typically within 2 hours
  for SEV1 affecting money flow.
- **CFPB / state AG / NYDFS:** legal counsel decision; default
  posture is the relevant statutory window (NYDFS 72-hour, GLBA
  notification thresholds).
