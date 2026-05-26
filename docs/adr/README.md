# Architecture Decision Records (ADRs)

This directory holds the architectural decisions for the EazePay
platform. Each ADR is a short, dated record of a single decision: the
context that forced the choice, the decision itself, the alternatives
that were considered and rejected, and the consequences we now live
with.

## What an ADR is for

ADRs exist so that the **next engineer** (often a future Brodie) can
read a single document and understand _why_ a load-bearing choice was
made — not just _what_ the code does. Code shows the "what." Tests
show the "how." ADRs are the only place the "why" survives.

Write an ADR when you are making a **near-irreversible architectural
commitment**: a new platform, a new data model, a new external
dependency, a new security posture, a contract with an external
partner. Don't write an ADR for routine refactors, library upgrades,
or reversible-in-a-day implementation choices.

## How to write a new ADR

1. Copy `0000-template.md` to the next 4-digit zero-padded number,
   e.g. `0027-something.md`.
2. Fill in status, deciders, context, decision, alternatives,
   consequences, compliance notes. Use Michael Nygard's classic shape;
   `0000-template.md` is the canonical form.
3. Cite the code paths and prior ADRs the decision touches. Future
   readers will use these as the entry point.
4. Open a PR with the ADR alongside (or before) the change it
   describes. ADRs that document a _retroactive_ decision (i.e. the
   code already shipped) are still welcome — note that in the context.
5. Once an ADR is `Accepted`, do **not** edit the substance. If the
   decision changes, write a new ADR that explicitly supersedes the
   old one and update the old one's status to `Superseded by ADR-NNNN`.

## Status lifecycle

| Status     | Meaning                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Proposed   | Drafted, under discussion. Not yet load-bearing; may change shape before acceptance.                  |
| Accepted   | Decided. The codebase reflects this choice. Substance is now immutable; only metadata may be updated. |
| Deprecated | The decision no longer applies, but no replacement has been written. The code may still reflect it.   |
| Superseded | A newer ADR has explicitly replaced this one. The old ADR points forward; the new one points back.    |

## Numbering convention

- 4-digit zero-padded, monotonically increasing (`0001`, `0027`, …).
- Numbers are never reused. If an ADR is superseded, the new ADR gets
  the next free number and links back.
- Filename: `NNNN-kebab-case-summary.md`. Keep the summary short
  (under ~50 chars) — it shows up in directory listings.

## Index

| #    | Title                                                                  | Status   |
| ---- | ---------------------------------------------------------------------- | -------- |
| 0001 | Hybrid monorepo (Nx) + separate infra and design-system repos          | Accepted |
| 0002 | NestJS (Node 20 LTS, TypeScript) for backend services                  | Accepted |
| 0003 | React Native + TypeScript for mobile                                   | Accepted |
| 0004 | Aurora PostgreSQL 16 as primary OLTP                                   | Accepted |
| 0005 | AWS Cognito + custom session/device layer for consumer & merchant auth | Accepted |
| 0006 | Terraform for infrastructure-as-code on AWS                            | Accepted |
| 0007 | Hybrid lender orchestration (parallel within tier, waterfall across)   | Accepted |
| 0008 | Lending model — bank-partner first, with state-licensed fallback       | Proposed |
| 0009 | ACH origination via Modern Treasury (or partner-bank direct)           | Proposed |
| 0010 | Modular monolith with explicit extraction paths                        | Accepted |
| 0011 | Audit via transactional outbox + hash-chained sink                     | Accepted |
| 0012 | Money is integer cents (BigInt), serialised as string-of-integer       | Accepted |
| 0013 | Fair routing as the default lender-ordering policy                     | Accepted |
| 0014 | RFC-7807 problem details for all API error responses                   | Accepted |
| 0015 | Idempotency keys for state-mutating API calls                          | Accepted |
| 0016 | PII vault with envelope encryption                                     | Accepted |
| 0017 | Just-in-time PII unmask with audit trail                               | Accepted |
| 0018 | Billing service (rating + invoicing) as a separate module              | Accepted |
| 0019 | Real-time event bus for partner-portal UI updates                      | Accepted |
| 0020 | Applications data layer — Postgres + Drizzle + dual-write cutover      | Accepted |
| 0021 | Decision engine — internal scorer as default, Trutopia opt-in          | Accepted |
| 0022 | Graceful in-memory fallback when DB / Redis are absent                 | Accepted |
| 0023 | BullMQ for async orchestration                                         | Accepted |
| 0024 | Resource ownership mismatch returns 404, not 403                       | Accepted |
| 0025 | Write-then-200 webhook inbox with idempotency                          | Accepted |
| 0026 | Graceful degradation philosophy — every external dep has a fallback    | Accepted |

## Conventions for code references

Every ADR cites the load-bearing files. When code moves, update the
references inline (this is metadata, not substance). When code is
deleted such that an ADR no longer corresponds to anything in the
tree, mark the ADR `Deprecated` and write a follow-up explaining
what replaced it.
