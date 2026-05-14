# @eazepay/service-compliance

FCRA / ECOA / TILA enforcement + audit hooks.

## Responsibilities

- (Reserved) Enforce cross-cutting compliance invariants that span
  multiple services — e.g. ECOA 30-day adverse-action window, TILA
  Reg Z disclosure timing, FCRA permissible-purpose checks
- Provide a compliance API that ops can query from the admin console
  ("which applications are nearing their AAN deadline?")
- Hook into `service-audit` to produce regulator-ready packets on
  demand

## Public API

- TBD — package is currently a placeholder directory.

## Dependencies

- Will depend on `@eazepay/service-audit`,
  `@eazepay/service-compliance-doc`, `@eazepay/shared-types`,
  `@eazepay/shared-utils`

## Notes

- Placeholder package — no source under `src/` yet. Today the
  related logic lives inside `service-compliance-doc` (AAN render +
  store) and `service-admin` (manual reviews). This package is
  reserved for the *enforcement* layer.
- Distinct from `service-compliance-doc`: doc renders artifacts,
  compliance enforces the rules.
