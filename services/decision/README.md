# @eazepay/service-decision

Standalone decisioning engine (separate from orchestration).

## Responsibilities

- (Reserved) Host the decisioning engine as a standalone service
  once it outgrows `@eazepay/service-orchestration/decision/*`
- Versioned policy bundles + champion-challenger A/B routing
- Replay-from-snapshot: every decision is reproducible from the
  inputs + policy version it ran against

## Public API

- TBD — package is currently a placeholder directory. The first
  module to land will expose `DecisionModule.forRoot(...)` and a
  `DecisionService.evaluate(application, policyVersion?)`.

## Dependencies

- Will depend on `@eazepay/service-risk`, `@eazepay/shared-types`,
  `@eazepay/shared-utils`

## Notes

- Placeholder package — no source under `src/` yet. Today decisioning
  lives at `services/orchestration/src/decision/`. This package is
  the eventual home once the policy DSL needs an independent release
  cadence.
