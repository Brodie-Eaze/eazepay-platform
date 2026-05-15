# @eazepay/feature-flags-sdk

**Status:** Reserved — no implementation yet.

The client-side half of the flag-evaluation story. The server-side half lives in `services/featureflag` (also reserved). When implemented, this lib will ship the React hook + framework-free evaluator that every frontend consumes; the server-side service will own flag state, targeting rules, and audit.

## What it will export (planned)

- `FeatureFlagsProvider` — React context provider, hydrated from the BFF on app boot.
- `useFlag(key, defaultValue)` — React hook returning the current evaluation for the signed-in user / merchant / brand context.
- `evaluate(key, context)` — pure evaluator (for non-React surfaces such as `consumer-mobile` background tasks).
- Targeting context types — userId, merchantId, brandCode, environment, locale.

## Used by

(When implemented) Every Next.js app, plus `consumer-mobile`.

## Notes

- Directory + workspace entry only. No `src/` yet. Reserved to keep the import path stable so flags can be introduced incrementally without a churn migration.
- Provider choice TBD — likely Unleash (self-hosted) or LaunchDarkly. See `docs/ARCHITECTURE.md` §10.4 + §18.
