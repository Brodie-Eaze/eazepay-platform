# @eazepay/service-featureflag

Feature flag evaluation.

## Responsibilities

- (Reserved) Evaluate boolean + multivariate feature flags scoped
  by user, merchant, brand, or environment
- Provide a `FeatureFlagPort` other services depend on without
  caring about the backing provider (Statsig, LaunchDarkly,
  Unleash, or in-house)

## Public API

- TBD — package is currently a placeholder directory.

## Dependencies

- Will depend on `@eazepay/shared-types`, `@eazepay/shared-utils`,
  and a flag provider SDK

## Notes

- Placeholder package — no source under `src/` yet.
  `libs/feature-flags-sdk` exists as the client-side hook surface;
  this service will own the *server-side* evaluation + targeting
  layer (rule storage, audience definitions).
