# @eazepay/service-auth

Authentication, session, and device-trust layer.

## Responsibilities

- Register / login / OTP / refresh + revocation lifecycle
- JWT issuance and verification (jose) — access + refresh tokens
- Session + device tracking (Redis-backed)
- Pluggable identity provider: `local` today, `cognito` adapter slot
- Guards + decorators (`JwtAuthGuard`, `AdminGuard`, `@CurrentUser`)
  consumed by every other service's controllers

## Public API

- `AuthModule.forRoot({ provider, prismaToken, redisToken, config, isDevelopment })`
- `AuthService` — register, login, OTP, refresh, revoke
- `TokenService` — sign + verify; used by other services to mint
  internal service tokens
- `JwtAuthGuard`, `AdminGuard`, `@Public()`, `@Admin()`, `@CurrentUser()`
- DTOs: `RegisterDto`, `LoginDto`, `VerifyOtpDto`, `RefreshDto`

## Dependencies

- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma), Redis (ioredis), jose, @node-rs/argon2

## Notes

- Argon2id (`@node-rs/argon2`) for password hashing — no bcrypt
- OTPs stored in Redis with TTL — never persisted long-term
- `ConsoleNotificationAdapter` throws unless `isDevelopment=true`;
  a production notification adapter must be wired before deploy
- Token version (`jti`) lookup in Redis enables instant revocation
  without bumping JWT secrets
