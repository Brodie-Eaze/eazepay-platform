# ADR-0018 — Billing service

**Status:** Accepted · 2026-05-17

## Context

Platform-fee invoicing was scaffolded in the partner-portal as a
client-only feature (PR #21, #22): localStorage-backed state, mailto
sends, no server enforcement. To put it in front of the accounts
team for real use and to handle merchant PII (recipient emails,
dispute reasons, IP/UA forensics), the workflow needs a hardened
server.

The repo already has the primitives we need — NestJS modular monolith,
Prisma + Postgres, JWT + Admin guards, nestjs-zod DTOs, Throttler
backed by Redis, the `@Idempotent` interceptor for write replay
safety, and `PiiVaultService` envelope encryption with per-row AAD
binding. The goal of this ADR is to specify how the billing surface
plugs into those primitives and what the threat model looks like.

## Decision

Add a new `services/billing` package (`@eazepay/service-billing`)
that:

1. **Owns five Prisma models**: `BillingConfig`, `Invoice`,
   `InvoicePayment`, `InvoiceActivity`, `ConfirmToken`. New enums:
   `BillingCycle`, `InvoiceStatus`, `InvoicePaymentMethod`,
   `InvoiceActivityKind`, `ConfirmState`.
2. **Exposes two controllers**, mounted on the BFF:
   - `BillingController` at `/billing/*` — admin-only, JWT + Admin
     guard via `@AdminOnly() + @UseGuards(AdminGuard)`. Tight default
     throttle (60 req/min); generate-batch is further tightened to
     6/min.
   - `BillingConfirmController` at `/public/billing/confirm/*` —
     no auth (token IS the credential). GET 10/min/IP, POST 5/min/IP.
3. **Validates inputs at the boundary** with Zod DTOs (`.strict()`
   so unknown fields are rejected — no risk of mass-assignment).
4. **Idempotency** on every write endpoint via `@Idempotent` so
   retries by the partner-portal client are safe across the wire.
5. **Atomic activity writes** — every mutation lives in the same
   `$transaction` as the corresponding `InvoiceActivity` row. There
   is no code path that changes state without writing audit. This
   is the auditability invariant the SOC2 mapping leans on.
6. **PII encryption at rest** for the only field that warrants it:
   `BillingConfig.sendToEmailEnc`. Uses `PiiVaultService.sealOpaque`
   with AAD `{ entity: 'billing_config', field: 'sendToEmail',
merchantId }`. Swapping ciphertext between rows fails the GCM
   auth-tag check (same pattern as ADR-0016 §AAD).
7. **Confirm tokens** are 32-byte cryptographically random
   base64url strings stored on a unique-indexed column. Single-use:
   any state ≠ `pending` rejects further decisions (409). Expiry is
   enforced server-side (default 30 days, configurable). Recipient
   IP + UA are captured on the decision for forensic audit.
8. **Activity source is pluggable**: today a `MockActivitySource`
   adapter returns deterministic per-merchant cents (dev-only, the
   module refuses to boot it in non-development). The settlements
   ledger adapter lands in the next PR.

The partner-portal gets `lib/billing-api.ts` — a typed fetch client
that calls the BFF when reachable (probed once per session via
`/health/liveness`) and falls back to the localStorage adapters
when not, so the demo keeps working offline.

## Threat model

| Threat                                                                                | Mitigation                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stolen admin JWT used to mass-mutate before incident response                         | Per-endpoint Throttler + per-controller default. Generate-batch tightened to 6/min (1 every 10s) so an attacker can't burn through every period before alarms fire. |
| Replay of a write request (network drop + retry)                                      | `@Idempotent` interceptor keys on `idempotency-key` header → returns the prior response. Partner-portal client mints a fresh key per call.                          |
| Field-injection via JSON body (e.g. patch sets `voidedAt` directly)                   | All DTOs use `z.object().strict()` — unknown keys throw at the boundary. Service methods take typed inputs, never spread untyped DTO directly into Prisma writes.   |
| Mass-assignment of `voidedAt` via the status endpoint                                 | Status DTO is `enum(['draft','sent','paid','overdue'])` — `voided` requires hitting the dedicated `/void` endpoint which writes the reason.                         |
| Recipient confirm link replay (token leaked to logs/email forwards)                   | Decision endpoint rejects any state ≠ `pending` with 409. Token expiry capped at 30 days. POST is throttled at 5/min/IP.                                            |
| Brute force of confirm token                                                          | 256-bit entropy from `crypto.randomBytes`; brute force is computationally infeasible. Throttle is belt + braces.                                                    |
| Ciphertext swap of `send_to_email_enc` between rows by a compromised KMS key or admin | AAD binds ciphertext to `merchantId + field + entity`; auth-tag check fails on swap.                                                                                |
| Audit row dropped while the state change committed                                    | Both writes share a single `$transaction`; either both commit or neither.                                                                                           |
| Forensic anchor missing for dispute (e.g. "did the actual merchant click confirm?")   | `confirm_tokens.remote_ip` + `user_agent` captured on decision and mirrored to `invoice_activity` for the audit chain.                                              |
| Voided invoice gets a payment recorded (or fee edited)                                | Service `mutateInvoice()` helper rejects state-changing operations on voided invoices with 409. Recording a payment also rejects voided.                            |
| `Generate from activity` accidentally double-creates invoices for a period            | Unique constraint `(merchant_id, period_id)` plus a per-merchant existence check in the runGenerate loop.                                                           |

## Consequences

**Pros**

- The accounts team can run real billing operations end-to-end, with
  every change audited, every PII field encrypted with row-bound AAD,
  every write replay-safe, and every external (recipient) endpoint
  throttle- and entropy-protected.
- The fence between "admin can mutate" and "recipient can decide" is
  enforced by being in two different controllers with different
  guards.
- BigInt cents storage avoids float drift on long-tail aggregations.
- Drop-in pluggability of the activity source means moving from the
  mock to the real settlements query is a single adapter swap.

**Cons / open items**

- Email send is still `mailto:` from the partner-portal — needs
  Resend integration (`RESEND_API_KEY`) in a follow-up PR.
- Payment link is still a pasted URL template — needs Stripe
  Payment Link creation + webhook (`STRIPE_SECRET_KEY`) to auto-mark
  paid on `payment.succeeded`. Tracked separately.
- Cron-driven auto-generate uses no cron yet — the Automation tab
  computes the "next run" date for display only. Needs Railway cron
  in a follow-up PR.
- `MockActivitySource` is wired in app.module today; the next PR
  swaps to the real settlements adapter and the module's non-dev
  guard becomes meaningful.

## Migrations

- `apps/api/prisma/migrations/20260517_billing_service/migration.sql`
  creates the 5 tables + 5 enums + indexes. Run via
  `pnpm --filter @eazepay/api prisma:migrate:dev`.

## References

- ADR-0016 — PII vault envelope encryption
- ADR-0017 — JIT PII unmask
- SOC2 evidence map § billing
- `services/billing/src/billing.service.ts` — domain logic
- `services/billing/src/billing.controller.ts` — admin surface
- `services/billing/src/billing-confirm.controller.ts` — public surface
