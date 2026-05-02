# ADR-0010: Modular monolith with explicit extraction paths

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Brodie

## Context

We have 11 internal services (`auth`, `user`, `merchant`, `application`,
`orchestration`, `decision` (in-orchestration), `lender`, `payment`,
`notification`, `document/compliance-doc`, `risk`, `audit`, `webhook`,
`admin`) and four deployable processes (`api`, `workers`,
`webhooks-app`, plus the three frontends). The team is small. Premature
microservice topology is the largest architectural failure mode at
this stage.

## Decision

Run a **modular monolith** in production: one Aurora cluster, one
process tier (`api`) for the user-facing API, one process tier
(`workers`) for the cron drain, and one process tier
(`webhooks-app`) for inbound provider webhooks. Service code lives in
`@eazepay/service-*` packages with strict module boundaries (Nx tags
forbid wrong-direction deps; @Optional() deps everywhere; ports +
adapters at every external boundary).

**Extraction is a non-event.** Each service's port surface is a
package boundary today; a service moves to its own process by
importing the package over an HTTP / gRPC client adapter and
deploying separately. No code change inside the service itself.

## When extraction earns its weight

- A service has a different scaling shape (e.g. `orchestration` runs
  hot during marketing pushes and needs independent autoscaling).
- A service has a stricter regulatory boundary that justifies
  separate deployment and access controls (e.g. `payment` once card
  data lands in scope — though we've tokenised it out).
- A service's failure mode would otherwise take down the platform
  (`webhooks-app` is already extracted for this reason).

## Alternatives considered

- **Microservices from day one** — rejected. Too much operational
  ceremony for a 5-7 person team. Distributed tracing, deploy
  pipelines per service, and cross-service contract testing are
  expensive without a corresponding scale problem to solve.
- **Single process for everything** — rejected for `webhooks-app`
  blast radius. Inbound partner webhooks must not be able to
  trigger an OOM that takes down consumer-facing API.

## Consequences

- Deploy is one ECS service for `api` plus `workers` and
  `webhooks-app`. Three CloudFront distributions for the web apps.
- Cross-service calls are TypeScript imports, not HTTP — no
  per-hop tracing complexity, no per-call timeout / retry plumbing.
- The Nx project graph + dep-direction lint becomes load-bearing.
  Wrong-direction imports (e.g. `service-auth` importing
  `service-payment`) would couple unrelated services. CI enforces.

## Compliance / risk notes

Bank-partner audits sometimes ask "what are your services and how
isolated are they?" The answer here is: one process for security
boundary purposes, with distinct package + module + DI scope per
domain. ARCHITECTURE.md §10 documents the topology — this ADR is
the rationale.
