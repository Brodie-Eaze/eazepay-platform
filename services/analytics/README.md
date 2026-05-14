# @eazepay/service-analytics

Aggregations + reporting reads.

## Responsibilities

- (Reserved) Build reporting-grade aggregations (cohort, funnel,
  cohort-revenue) on top of the operational store
- Serve read endpoints behind `/v1/analytics/*` consumed by the
  merchant dashboard and admin console
- Own the materialized-view + scheduled-refresh pattern (Postgres
  refresh job today, warehouse ETL later)

## Public API

- TBD — package is currently a placeholder directory. The first
  module to land will expose `AnalyticsModule.forRoot(...)` and a
  read-only `AnalyticsService`.

## Dependencies

- Will depend on `@eazepay/shared-types`, `@eazepay/shared-utils`,
  and read-replica Postgres

## Notes

- Placeholder package — no source under `src/` yet. Reserved for the
  analytics workstream described in
  [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
- Writes go to the operational store; this service is read-only on a
  read replica so heavy aggregations never impact the request path.
