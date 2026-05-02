# ADR-0009: ACH origination via Modern Treasury (or partner-bank direct)

- **Status:** Proposed (final pick deferred to bank-partner selection)
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)
- **Open questions:** Open Q #5 in `docs/ARCHITECTURE.md`

## Context

We need ACH origination for both repayment debits (consumer → EazePay) and disbursements (EazePay → merchant), plus same-day ACH and an RTP/FedNow path for V1. Card debit (Reg E coverage) is the consumer repayment fallback via Stripe.

## Decision (proposed)

- **Primary:** Modern Treasury as the abstraction layer over the partner bank's ACH (and RTP/FedNow) rails — gives us provider portability, idempotent APIs, retry + return monitoring, and Reg E + Nacha-aligned authorisation flows.
- **Alternative:** direct integration to partner bank's ACH gateway if Modern Treasury margins or features don't fit. Decision finalised when bank partner is signed (ADR-0008).
- **Backups:** Column or Increase as drop-in alternatives if Modern Treasury becomes a single-vendor risk.
- **Card path:** Stripe for debit-card-on-file repayments; SAQ A path (no PAN ever touches our infra).

## Alternatives considered

- **Stripe Treasury for everything:** simple, but ties us to Stripe across two distinct critical paths (cards + ACH) with no diversification.
- **Roll-our-own NACHA submission:** rejected — return-rate monitoring, addenda formatting, NOC handling, and bank-of-record relationship are not differentiating work.

## Consequences

- We must build Reg E recurring-debit authorisation flow correctly (separate consent step, retention of authorisation, error-resolution within 60 days).
- Nacha return-rate thresholds must be monitored and dashboarded from day one (Unauthorized ≤0.5%, Administrative ≤3%, Overall ≤15%). Exceeding them shuts down origination.
- Account verification at authorization time: Plaid Auth as primary, micro-deposit fallback, never raw routing/account input without one.

## Compliance / risk notes

Reg E governs unauthorised consumer transactions; we must surface error-resolution UX in-app and via support. Reg E + Nacha + GLBA all require retention of authorisation evidence for the longer of 2 years or per partner-bank contract.
