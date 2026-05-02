## Summary

<!-- What changed and why. Link to ADR / issue / spec. -->

## Type of change

- [ ] Feature
- [ ] Fix
- [ ] Refactor / chore
- [ ] Docs
- [ ] Infra / CI
- [ ] Security
- [ ] Compliance / regulatory

## Surfaces touched

- [ ] consumer-mobile
- [ ] consumer-web
- [ ] merchant-dashboard
- [ ] admin-console
- [ ] partner-portal
- [ ] api
- [ ] workers
- [ ] webhooks
- [ ] services/* (list which)
- [ ] libs/* (list which)
- [ ] design-system
- [ ] docs only

## Test plan

<!-- How was this verified? Unit, integration, manual, sandbox lender, e2e? -->

## Risk + rollout

- [ ] Behind feature flag
- [ ] Canary-safe (5% → 25% → 100%)
- [ ] Backwards-compatible DB migration (additive only / no rename / no drop)
- [ ] Touches money flow → requires payment-team review
- [ ] Touches credit decision / disclosure → requires compliance review

## Security checklist

- [ ] No new secrets committed
- [ ] No new PII fields added without classification + encryption
- [ ] No new external dependencies, OR the new dependency is reviewed
- [ ] AuthZ / RBAC verified for any new endpoint
- [ ] No new public endpoint without rate limiting
- [ ] Audit log entries added for any new mutation on regulated entities

## Compliance notes

<!-- TILA / Reg Z / ECOA / FCRA / GLBA / Reg E / MLA / SCRA / state-rules / partner-bank policy implications. -->
