# ADR-0001: Hybrid monorepo (Nx) for product code; separate repos for infra and design system

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

EazePay ships multiple product surfaces (iOS, Android, three web apps, public API, workers, webhooks) plus internal services that share types, an OpenAPI client, and a UI library. Cross-cutting changes are common (e.g. add a field on Application: type → API → mobile UI). Infra (Terraform) and the design system have different review cadences, blast radii, and approver sets.

## Decision

- One Nx-managed monorepo (`eazepay/platform`) for all product code: apps, services (modules), and shared libs.
- Separate repos for `eazepay/infra` (Terraform) and `eazepay/design-system` (tokens + Figma sync + RN/React component packages).
- Public-facing repos (`eazepay/integrations`, `eazepay/sdk`, `eazepay/docs`) live as their own repos with their own release cadence.

## Alternatives considered

- **Pure multi-repo:** rejected — every cross-cutting change becomes a multi-PR dance with version drift; types lie.
- **Single mega-repo including infra:** rejected — infra needs slower reviews, different approvers, and tighter blast control than product code.

## Consequences

- Types and contracts can be shared and changed atomically across FE/BE/mobile.
- Nx's project graph + affected-builds keeps CI fast.
- We pay the cost of an Nx workspace setup and need discipline on module boundaries (enforced via Nx project boundaries + ESLint rules).
- Infra reviewers and product reviewers can have different policies without crossing wires.

## Compliance / risk notes

Audit and SOC 2 evidence collection benefits from clear repo separation: change management for infra is distinct from product. Design-system is publicly-visible-eligible later if we choose, without exposing application code.
