# services/user — characterization tests

These tests pin the **current behaviour** of `UserService` and
`PiiVaultService` so a future rewrite can be proven equivalent. Where
the legacy code does something we may eventually want to change, the
test asserts what the code **does today** and flags the discrepancy in
a comment / `it.todo` — not by failing the build.

## Running

```bash
# from repo root
pnpm exec vitest run --root services/user             # tests only
pnpm exec vitest run --root services/user --coverage  # + v8 branch coverage
```

Coverage thresholds in `vitest.config.ts` (branches: 50%) — current
actual: ~90% branch.

## Layout

- `_helpers.ts` — in-memory Prisma fake + `LocalKeyManager` + sample PII.
  We deliberately do NOT spin up a real Postgres; the fake implements
  only the surface the service touches, so a new table reference fails
  loudly rather than silently no-opping.
- `pii-vault.spec.ts` — envelope encryption: seal/open round-trip,
  SEC-019 swap-attack rejection (user-A ciphertext opened as user-B
  fails the AAD-bound GCM auth tag), v1/v2 BO AAD migration,
  `sealOpaque` cross-row replay defence, `LocalKeyManager` hard guards.
- `user-service.spec.ts` — KYC adapter return paths (approved /
  manual_review / rejected / pending / expired-unknown-ref),
  state-machine transitions on `updateProfile` (re-KYC trigger),
  SEC-023 step-up gate (fails closed today), masking rules, audit
  outbox emission for every PII-touching action.

## Adding a new case

1. Pick the smallest possible Prisma seed in `_helpers.makeUserPrisma`
   and the smallest PII shape from `samplePii(...)`.
2. Mock the external port (`KycProvider`) via `vi.fn` or a small inline
   `{ initiate, status }` object — never reach for a real network call.
3. Assert on **literal** expected values (states, codes, audit
   `action` strings). No `should be defined` / `toBeTruthy` — characterization
   tests must capture the exact answer the legacy returned.
4. If the behaviour is not yet implemented in the service, use
   `it.skip("pending RULE-XYZ: ...")` or `it.todo(...)` and reference
   the audit / spec line. Do not delete; the test name is the spec.
