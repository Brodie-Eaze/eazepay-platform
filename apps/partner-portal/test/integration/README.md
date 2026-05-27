# Partner-Enrollment Critical-Flow Tests

Characterization tests for the ten high-blast-radius flows on the
EazePay partner-enrollment surface.

## Where the tests live

| Flow | File | Stack |
| --- | --- | --- |
| 1. Consumer apply happy path | `apps/api/test/integration/pe-critical-flows.spec.ts` | NestJS apps/api + Prisma |
| 2. Consumer apply thin-file decline | `apps/api/test/integration/pe-critical-flows.spec.ts` | NestJS apps/api + Prisma |
| 3. Partner onboarding double-submit idempotency | `apps/partner-portal/test/integration/pe-portal-flows.spec.ts` | Next.js portal + Drizzle |
| 4. Partner onboarding PII → 501 | `apps/partner-portal/test/integration/pe-portal-flows.spec.ts` | Next.js portal + Drizzle |
| 5. F-001 IDOR on /v/medpay/applications/{id}/status | `apps/partner-portal/test/integration/pe-portal-flows.spec.ts` | Next.js portal + Drizzle |
| 6. MiCamp mid.activated webhook → DLQ | `apps/api/test/integration/pe-critical-flows.spec.ts` | NestJS apps/api + Prisma (pending) |
| 7. Lender loan.funded inbox dedupe | both files | both |
| 8. Operator suspends partner | `apps/api/test/integration/pe-critical-flows.spec.ts` | NestJS apps/api + Prisma (pending) |
| 9. Login rate-limit | `apps/partner-portal/test/integration/pe-portal-flows.spec.ts` | Next.js portal |
| 10. Welcome token consume | `apps/partner-portal/test/integration/pe-portal-flows.spec.ts` | Next.js portal + Drizzle |

## How to run

Both suites use Testcontainers Postgres. Docker must be running.

```sh
# Backend (NestJS apps/api) integration suite
pnpm vitest --config apps/api/vitest.integration.config.ts

# Partner-portal (Next.js) integration suite
pnpm vitest --config apps/partner-portal/vitest.integration.config.ts

# Single flow, watch mode
pnpm vitest --config apps/api/vitest.integration.config.ts \
  -t "PE Flow 1"
```

If Testcontainers fails to start (Docker not running, port collision),
the entire suite logs the reason and skips every test — it will NOT
silently green-pass. Look for `[pe-critical-flows] integration stack
unavailable — skipping:` in the run output.

## Test discipline (read this before adding a case)

This is a **characterization** suite. The legacy code is the oracle.

1. **Concrete inputs, literal outputs.** Every test must specify the
   exact request body / headers and assert the exact response status,
   code, and persisted DB state. No "should work correctly" — instead
   "given amountCents=50, returns status='declined' and offer count
   exactly 0".
2. **Cover every branch the legacy walks.** Read the route handler,
   list its `if`/`switch` arms, give each one a case.
3. **`it.skip` for target-only contracts.** When the PE backlog says
   "should do X" but the legacy doesn't yet, register the test as
   `it.skip("pending RULE-…")` with a docblock showing the assertions
   to wire when the change lands. NEVER delete.
4. **Pair every `it.skip` target with a legacy fence.** The fence
   asserts the current (often unsafe) behaviour. It goes RED the
   moment the rewrite owner half-wires the gate, forcing them to
   either ship the full target contract (and unskip the proper test)
   or revert. This is how the suite prevents partial fixes from
   slipping through.

## Adding a new case

1. Pick the right file (apps/api for Nest routes; partner-portal for
   Next.js routes).
2. Decide: target-contract `it.skip` or legacy-fence assertion? If the
   feature already works in production, write the assertion against
   live output. If it doesn't, write the `it.skip` with the assertion
   block in a comment AND the legacy fence below.
3. Use the existing helpers — `registerAndVerify`, `signWebhook`,
   `validOnboardingBody`. Don't reimplement.
4. Every DB-touching test must `await wipeDatabase(databaseUrl)` (Nest)
   or rely on the `beforeEach` truncate (portal) so the case is
   independent.
5. The test name reads as a spec: `"persists application → offers →
   contract → loan → outbox"` not `"should work"`.

## Pending RULE references

These appear as skip reasons throughout the suite. Each one maps to a
PE-backlog item that the rewrite owner must close before the
characterization suite turns fully green:

| Rule | What's missing |
| --- | --- |
| RULE-CONSENT-001 | consent_receipts table on apps/api side |
| RULE-LIFECYCLE-007 | cross-stack reconciler so applications.status reaches 'active' after loan.funded |
| RULE-DLQ-002 | decisioning_dlq table + write on thin-file decline |
| RULE-AAN-001 | compliance-doc service AAN generator wired to decline hook |
| RULE-MICAMP-001 | /v1/webhooks/micamp route + webhook_inbox table + BullMQ worker |
| RULE-INBOX-DEDUPE-001 | inbox dedupe on (lender_id, event_id) + `{duplicate:true}` response |
| RULE-PARTNER-SUSPEND-001 | partners.suspended_at column + audit_log table + admin route |
| RULE-IDEMPOTENCY-015 | server-side Idempotency-Key dedupe on partner onboarding submit |
| RULE-PII-VAULT-001 | ADR-0016 vault wiring + 501 gate on PII fields |
| RULE-IDOR-F001 | tenant gate on `/api/v/[brand]/applications/[id]/status` |
| RULE-RATE-LIMIT-AUTH-001 | 10/min auth-surface limit |
| RULE-RATE-LIMIT-IDENT-001 | identifier-keyed counter to block cross-IP brute force |
| RULE-WELCOME-TOKEN-001 | welcome_tokens table + token-consume semantics on set-password |
