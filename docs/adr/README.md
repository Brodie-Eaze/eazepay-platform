# Architecture Decision Records (ADRs)

This directory holds the architectural decisions for the EazePay platform. Each ADR is a short, dated record of a single decision: context, the decision itself, alternatives considered, and consequences.

## How to write a new ADR

1. Copy `0000-template.md` to the next number, e.g. `0010-something.md`.
2. Fill in status, deciders, context, decision, alternatives, consequences, compliance notes.
3. PR the ADR alongside (or before) the change it describes.
4. Once accepted, never edit the substance of an old ADR — supersede with a new ADR that links back.

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
