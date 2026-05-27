# services/merchant — characterization tests

Pins the **current** `MerchantService` behaviour: SEC-017 admin gate,
SEC-019 beneficial-owner AAD binding, `PROHIBITED_NAICS_PREFIXES`,
KYB state-machine transitions for each `MockKybAdapter` return path,
OFAC field propagation, application-link issuance + idempotency.

## Running

```bash
pnpm exec vitest run --root services/merchant
pnpm exec vitest run --root services/merchant --coverage
```

Coverage thresholds in `vitest.config.ts` (branches: 50%) — current
actual: ~90% branch on `merchant.service.ts`.

## What we deliberately did NOT assert

Three behaviours referenced by the fraud/AML audit are **not yet
implemented in the service**. They are kept as live test names via
`it.skip(...)` rather than deleted — the test name is the spec:

1. **BO ≥25% coverage rule.** The service today accepts any
   ownership total. The skip in `merchant-service.spec.ts > addBeneficialOwner`
   reserves the assertion for when `startKyb` rejects insufficient
   coverage.
2. **OFAC `match` short-circuit.** The service propagates the OFAC
   field into audit but does not yet force `status=suspended` when
   the provider reports `match` with `outcome=approved`. Tracked as
   the second skip under `startKyb > OFAC field handling`.
3. **Merchant suspend / reactivate.** PR #149 shipped this at
   `apps/partner-portal/.../partners/[id]/status`, not on
   `services/merchant`. The skip reserves the assertion for when the
   service-layer `setStatus({ to, reason })` lands and writes
   `merchant.suspended` / `merchant.reactivated` audit rows.

## Layout

- `_helpers.ts` — in-memory Prisma fake (only what `MerchantService`
  reads/writes) + real `PiiVaultService` + `LocalKeyManager`.
  `LocalKeyManager` is imported via a relative path because it isn't
  on the public `@eazepay/service-user` surface.
- `merchant-service.spec.ts` — 32 specs covering create / admin gate /
  NAICS / slug, addBeneficialOwner / SEC-019 / role gate, startKyb /
  five return-path branches / OFAC propagation, application-link
  gating + token round-trip + idempotency, member-scoped reads.

## Adding a new case

Same rules as `services/user/test/README.md`:

1. Literal inputs, literal expected outputs.
2. Mock the `KybProvider` port — never reach for a real Middesk/Alloy
   network call.
3. If the behaviour isn't implemented yet, use `it.skip` with a
   reference to the audit / PR — keep the test name as a spec.
