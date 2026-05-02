# ADR-0008: Lending model — bank-partner first, with state-licensed fallback

- **Status:** Proposed (gating decision; final selection pending counsel + partner-bank term sheet)
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO) + outside fintech counsel + BSA/AML counsel
- **Open questions:** Open Q #1 in `docs/ARCHITECTURE.md`

## Context

EazePay must originate consumer loans across the US. Two recognised models exist:

1. **Bank-partner / true-lender model** — a chartered partner bank (Cross River, WebBank, FinWise, Celtic, Lead Bank, etc.) is the lender of record; EazePay markets, services, and (often) purchases receivables under a bank-service-provider agreement. Provides nationwide reach via federal preemption, subject to True Lender + Madden-risk doctrines.
2. **State-by-state licensed direct-lender model** — EazePay obtains consumer-lending / installment / sales-finance licences via NMLS in each state of operation. Slower (12–18+ months for nationwide), more capital-intensive, but full independence.

Most modern fintech lenders run (1) for nationwide reach with (2) as a selective fallback in states where bank-partner economics fail (e.g. CO, NY, DC under recent state-AG actions).

## Decision (proposed)

- **Primary:** Bank-partner model. Open conversations with 2–3 partner banks in parallel given 6–12-month onboarding timelines.
- **Fallback:** Selective state licences for high-volume states where bank-partner pricing or state-AG posture makes (1) untenable.
- **Architectural implication (firm regardless of final pick):** every `Loan` carries a `lenderOfRecordId` foreign key — the partner bank or licensed entity that owns the credit decision in form and substance. Orchestration, disclosures, and Adverse Action notices all branch off this field.

## Alternatives considered

- **State-licensed first:** rejected for MVP — cost, time, and capital-reserve requirements crush an early-stage budget.
- **Marketplace-only (no balance-sheet lending):** rejected — BuzzPay's PE-backed thesis requires us to issue (or fund) loans, not just refer.

## Consequences

- Bank-partner diligence + onboarding is the longest critical-path item to MVP launch — start in parallel with any code.
- Partner bank imposes its own program (policies, MIS, model risk per SR 11-7, complaints handling, change management, audit rights). The "bank-partner audit pack" is a first-class artifact.
- True Lender and Madden risk require the partner bank to actually own the credit decision — architecture must reflect this, not just paperwork.

## Compliance / risk notes

Recent state AG actions (CO, NY, DC, IL) have challenged bank-partner programs that look like rent-a-charter. Build TrueTopia / BuzzPay's underwriting governance so the bank's involvement is structural: bank approves decisioning policy, retains material economic interest where applicable, owns the loan agreement. Document substance over form.
