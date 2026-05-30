# services/auth — characterization tests

These specs pin down what `services/auth/src/**` actually does today
(JWT mint/verify, atomic session rotation, TOTP enrolment + verify,
AES-256-GCM TOTP-secret envelope, Argon2id password hashing, HIBP
fail-open). The legacy implementation is the oracle: assertions encode
observed behaviour, not aspirations from the brief. Anywhere the brief
asks for a behaviour the code doesn't yet have, the test sits as `it.todo`
so the gap is searchable instead of silently absent.

## How to run

From the monorepo root:

```bash
# Full suite
pnpm --filter @eazepay/service-auth test

# With branch coverage report
pnpm --filter @eazepay/service-auth test --coverage

# Or directly via vitest (matches services/payment pattern):
pnpm exec vitest run --root services/auth
pnpm exec vitest run --root services/auth --coverage
```

The Nx target wraps the same call:

```bash
pnpm exec nx test service-auth
pnpm exec nx test service-auth -- --coverage
```

## Layout

| File                            | Subject under test                                                                         | Notes                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `token-service.spec.ts`         | `TokenService` (JWT mint, verify, claim shape, exp, signature, iss/aud)                    | Pure — no Prisma; constructs `TokenService` directly.                                                                                 |
| `session-service.spec.ts`       | `SessionService.rotateAtomic` (SEC-011), `revoke`, `revokeAllForUser` (SEC-009)            | Uses an in-memory Prisma fake whose `$transaction` is a passthrough — we characterise the sequence of writes, not Postgres atomicity. |
| `totp-service.spec.ts`          | `TotpService` (RFC 6238 ±1 step), `LocalTotpVaultAdapter` (AES-256-GCM AAD-bound envelope) | Helper `totpAt(secret, atMs)` re-derives codes locally so we don't poke private methods.                                              |
| `password-and-identity.spec.ts` | `LocalIdentityAdapter` (Argon2id), `PasswordPolicyService` (HIBP k-anonymity fail-open)    | `globalThis.fetch` is stubbed per test; restored in `afterEach`.                                                                      |

## Mocking conventions

- **DB:** mock at the port boundary. Each spec defines a `makePrismaFake()`
  that only implements the surface the SUT actually calls (`session.create`,
  `auditOutbox.create`, etc). Don't reach for `@prisma/client` real types.
- **HTTP:** stub `globalThis.fetch` with `vi.fn`; restore the original in
  `afterEach` so tests stay isolated across files.
- **Time:** prefer constructing the input around `Date.now()` over
  `vi.useFakeTimers()`. The TOTP helpers accept an `atMs` argument so
  skew-window cases are explicit.

## Adding a new case

1. Read the legacy code's branches first. Every IF / try / early return is
   a case worth one assertion.
2. Use literal inputs and literal expectations. Avoid "should work"
   wording — prefer `it('rejects an expired refresh token with refresh_expired')`.
3. If the brief asks for behaviour the legacy doesn't implement, write
   the test as `it.todo('...')` with a brief why. Don't delete it.
4. Run the suite locally with `--coverage` and make sure branch coverage
   on your edited module doesn't regress.

## Pending (not yet wired in `services/auth/`)

The brief mentions these surfaces; the auth service today doesn't host
the code for them. They show up as `it.todo` in
`password-and-identity.spec.ts`:

- account lockout after N failed attempts
- CSRF token mint + verify
- welcome / reset token consume (cross-check with PR #151)
- demo-session creation with origin allowlist + master gating
  (SEC-103 / SEC-109)

When those land inside `services/auth/`, convert the corresponding
`it.todo` into a real test.
