# ADR-0002: NestJS (Node 20 LTS, TypeScript) for primary backend services

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

We need a backend stack that lets a small team move fast across many services (auth, user, merchant, application, orchestration, decisioning, payments, etc.), shares types with TypeScript frontends and React Native, and remains hireable in the US fintech market.

## Decision

- NestJS on Node 20 LTS with strict TypeScript for all services at MVP.
- Single deployable (modular monolith) at MVP with module boundaries enforced by Nx project graph and ESLint rules; services can be extracted later without contract change.
- Reserve Go for the orchestration engine and decisioning hot path _only if_ benchmarks demand it post-MVP. Default everywhere else is Node/Nest.

## Alternatives considered

- **Go everywhere:** stronger concurrency and a single binary, but slower iteration on CRUD-heavy services and a smaller US fintech engineering pool at our hire price point.
- **Java/Kotlin (Spring Boot):** mature in regulated industries but heavy ceremony and slow iteration for a sub-10-engineer team.
- **Python (FastAPI):** rejected for primary services — type-system parity with TS frontends is weaker, and Python's runtime safety story for money-touching services is harder to defend.

## Consequences

- Shared Zod schemas + generated TS clients across mobile, web, and backend.
- Single-threaded Node demands care for CPU-heavy work (e.g. document OCR, ML inference) — push those to workers / external services from day one.
- We will need to invest in OpenTelemetry, Pino structured logging, and PII-scrubbing pipelines explicitly; these are not free in Node.

## Compliance / risk notes

Money-touching code must use BigInt cents (no floats) — enforce via type wrapper in `@eazepay/shared-types`. All audit-relevant mutations go through the audit service via the outbox pattern (DynamoDB + S3 Object Lock).
