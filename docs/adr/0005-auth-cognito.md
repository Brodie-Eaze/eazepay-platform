# ADR-0005: AWS Cognito + custom session/device layer for consumer & merchant auth

- **Status:** Accepted
- **Date:** 2026-05-02
- **Deciders:** Brodie (founder/CTO)

## Context

Consumer + merchant auth must support OAuth2/OIDC, MFA (TOTP + SMS fallback), WebAuthn (V1), device-bound refresh tokens, anomaly detection, and merchant SSO (SAML/OIDC) at V1. We will not roll our own password hashing or OAuth — too much regulatory risk for too little upside.

## Decision

- AWS Cognito user pools for the heavy lifting (registration, OAuth2 flows, MFA, OIDC federation).
- Custom session service on top for: device binding, refresh-token rotation, risk-based step-up, just-in-time elevation for admin.
- Workforce auth (admin console) uses Okta or Google Workspace SSO — _not_ Cognito — with hardware keys for prod data access.

## Alternatives considered

- **Auth0:** more polished DX, but more expensive at scale and adds a critical-path third-party we can't fail-over from.
- **Clerk / Stytch:** moving fast, but neither has the regulatory pedigree we need on day one.
- **Roll-your-own:** rejected outright. Password hashing, OAuth, MFA are commodity; risk is our reason to outsource.

## Consequences

- Cognito has rough edges (custom claims, hosted UI styling, attribute updates) — we accept these in exchange for AWS-native posture.
- Migration off Cognito later is non-trivial; this is a deliberate lock-in.
- Workforce + customer auth domains are completely separate — no shared identity provider.

## Compliance / risk notes

GLBA Safeguards Rule + NYDFS Part 500 (if NY in scope) require MFA — Cognito gives us this out of the box. Session service writes every login + step-up to the audit log. Argon2id for any passwords we store ourselves outside Cognito (e.g. service accounts).
