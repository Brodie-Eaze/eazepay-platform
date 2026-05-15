# @eazepay/testing

**Status:** Reserved — no implementation yet.

Shared test utilities + fixtures. Lives as its own lib so every package can import the same builders, factories, and stub providers without each test suite re-inventing the basics.

## What it will export (planned)

- **Builders / factories** — typed builders for `Application`, `Offer`, `Loan`, `Merchant`, `ConsumerProfile`, `LenderProduct`, etc. ULID-stable seeds so tests can be deterministic without sharing global state.
- **Stub providers** — in-memory `LenderAdapter` implementations, in-memory `ObjectStorage`, in-memory `AuditOutbox` drain, fake clock, fake KMS.
- **Vitest helpers** — `withApp(testFn)`, `withDb(testFn)` wrappers that compose a minimal NestJS app for integration tests.
- **Compliance assertions** — `expectAuditRow(spec)`, `expectAdverseActionNotice(spec)`, `expectIdempotent(call)` — assertion helpers tied to the regulated invariants in `docs/ARCHITECTURE.md`.

## Used by

(When implemented) Every package with a `test/` directory — `services/application`, `services/orchestration`, `services/payment`, `services/risk`, `services/webhook`, `services/admin`, `libs/shared-types`, `libs/shared-utils`.

## Notes

- Directory + workspace entry only. No `src/` yet.
- The contracts in `docs/adr/` (especially audit outbox, idempotency, RFC 7807) are the test-design source of truth. Builders here must produce data that satisfies those invariants by default.
