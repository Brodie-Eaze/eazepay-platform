# ADR-0027: Decision engine placement — module-first, standalone-ready

- **Status:** Accepted
- **Date:** 2026-05-31
- **Deciders:** Brodie + Builder Council
- **Supersedes:** ADR-0021 (decision engine — internal scorer default, Trutopia opt-in)

## Context

We are building EazePay's own lender-waterfall + decision engine to beat Skeps
and anything like it, at a 0.001% bar. This replaces the hardcoded
`scoreLender()` in `apps/partner-portal/lib/decision-engine.ts` (908 lines, three
hardcoded rules, float math, no versioning) with a data-driven, versioned,
snapshot-backed, reproducible engine.

ADR-0021 framed the choice as "our internal scorer vs Tim @ Trutopia's cloud
engine." That framing is dead: we are owning the engine outright (Trutopia is no
longer a provider — "I'm building our own version"). The live question became
**where the engine runs**.

The initial direction was a standalone cloud service. An adversarial architecture
review returned a grounded P0 against that: it inverts the current in-process
reality (partner-portal calls `evaluateDecision()` directly today, in-process —
`route.ts:160`), contradicts ADR-0010 ("extraction earns its weight") and ADR-0021,
and is the single largest reversibility trap on the table — a second deploy target
and network boundary stood up before any trigger justifies it. On reconfirmation,
the decision flipped to module-first.

## Decision

Build the engine as a first-class, versioned, snapshot-backed `DecisionModule`
**inside `services/orchestration`, behind a port**. The call stays a **TypeScript
import** per ADR-0010 — no network hop today.

Define, now, two contracts that make extraction a ~1-day non-event when a real
trigger appears:

1. The `POST /v1/decide` **HTTP contract** (request/response shape, RFC-7807
   errors per ADR-0014, idempotency per ADR-0015) — written and contract-tested
   even though nothing crosses the wire yet.
2. The vendor-neutral `CreditPullPort` (see ADR-0030).

We do **not** cut `apps/decision-engine`, a Dockerfile, or a second Railway
service now. `railway.toml` stays a single Next.js service.

## Alternatives considered

1. **Standalone cloud service now** — rejected. No trigger from ADR-0010's
   extraction test exists today: no independent scaling shape, no regulatory
   boundary not already met in-process, no blast-radius isolation need. It adds a
   network hop, a second deploy + Railway service to operate, and cross-process
   tracing/timeout/retry plumbing — ceremony with no scale problem to solve, and
   it inverts the current in-process reality.
2. **Leave it in `apps/partner-portal/lib/decision-engine.ts` as-is** — rejected.
   Regulator-facing credit-decision logic in a Next.js `lib/` folder, unversioned,
   float math, carrying the brand→GEOGRAPHY redlining defect (see ADR-0029). Not
   the 0.001% bar.
3. **Module-first, standalone-ready** _(chosen)_ — engine behind a port in
   `services/orchestration`, versioned + snapshot-backed, with the HTTP contract
   and credit-pull port defined now so extraction is the cheap non-event ADR-0010
   promises.

## Consequences

- **Positive:** engine lives behind a port, versioned, snapshot-backed;
  TS import = zero network hop today; extraction documented + cheap; engine IP
  fully in-house; decision system-of-record moves to Prisma with the ADR-0011
  hash-chained audit outbox written in the same transaction.
- **Negative / accepted:** discipline to NOT leak orchestration internals through
  the port; the `/v1/decide` contract + `CreditPullPort` are written and tested
  before anything crosses the wire (small upfront cost, the price of cheap
  extraction).
- **Reversibility:** High. Extraction is the ADR-0010 non-event (import the
  package behind an HTTP client adapter, deploy separately). Folding back is
  deleting an adapter.

## Compliance / risk notes

The engine remains in a process we operate and can show an examiner without an
NDA — preserving ADR-0021's examinability posture, which was its strongest point.
Adverse-action reason codes and the decision basis live in our own repo and
database, not a vendor's.

## Revisit when

`orchestration` develops an independent scaling shape (e.g. runs hot during
marketing pushes and needs separate autoscaling); a partner needs to call
`/v1/decide` directly over the wire; or a regulatory boundary demands separate
deployment or access controls. Any one of those is the trigger to execute the
documented extraction.
