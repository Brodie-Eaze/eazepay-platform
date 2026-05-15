# EazePay platform — adversarial security & pen-test readiness audit

> Audit date: 2026-05-15
> Auditor mode: adversarial; assume hostile until proven otherwise.
> Scope: `apps/api`, `apps/webhooks`, `apps/partner-portal`, all `services/*`,
> all `libs/*`. Out of scope: `infra/terraform`, docs.

---

## 1. Executive summary

### Findings by severity

| Severity                         | Count  |
| -------------------------------- | ------ |
| **P0** (exploitable today)       | **9**  |
| **P1** (exploitable with effort) | **17** |
| **P2** (defence-in-depth gap)    | **18** |
| **P3** (hygiene)                 | **9**  |
| **Total**                        | **53** |

### Top 10 risks (ranked)

| #   | ID      | Title                                                                                                                                                       | Severity |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | SEC-001 | Partner-portal sign-in falls through to "demo admin" cookie on auth failure                                                                                 | P0       |
| 2   | SEC-002 | Webhook dispatcher signs with `secretHash` (sha256 of secret), not raw secret — every outbound signature is unverifiable & secret-leaking                   | P0       |
| 3   | SEC-003 | Demo / open-data lender API routes (`/api/v1/webhooks/lenders/*`, `/api/v1/lenders/*/quote`) accept unsigned webhooks as `status:'skipped'` and respond 200 | P0       |
| 4   | SEC-004 | Outbound webhook URL allowlist blocks only loopback — SSRF to RFC1918, link-local 169.254.169.254 cloud metadata, internal services                         | P0       |
| 5   | SEC-005 | No rate limiting anywhere — auth, OTP, soft-pull, application submit endpoints are unbounded                                                                | P0       |
| 6   | SEC-006 | No security headers (HSTS / CSP / X-Frame-Options / Permissions-Policy / X-Content-Type-Options) on either `apps/api` or `apps/partner-portal`              | P0       |
| 7   | SEC-007 | `team.invite()` silently promotes any existing consumer User to `isAdmin:true` if invited by email — no consent, no separate audit on consumer side         | P0       |
| 8   | SEC-008 | Open redirect on `/sign-in?from=<arbitrary URL>` — `router.push(redirectTo)` jumps to attacker-controlled origin                                            | P0       |
| 9   | SEC-009 | JwtAuthGuard never checks `Session.revokedAt` — disabled / removed admins keep working JWTs for up to 15 min                                                | P0       |
| 10  | SEC-010 | `webhooks` app falls back to hardcoded JWT secret `'dev-secret-replace-me-32-bytes-aaa'` when `JWT_ACCESS_SECRET` unset                                     | P0       |

### Critical posture observations

- **Two backend ecosystems with different auth contracts.** `apps/api` mints HS256 JWTs whose signing key MUST equal the `JWT_ACCESS_SECRET` on every replica. The `apps/webhooks` standalone process has a hardcoded fallback for that secret and an `'unused'` Redis token wired into the same AuthModule that requires Redis — this means the webhooks process either fails to boot, or accepts forged JWTs if anyone happens to publish a JWT signed with the dummy secret.
- **Production paths are claimed but unimplemented.** Every adapter (`KmsKeyManagerAdapter`, Cognito identity, `Modern Treasury`, `Stripe`, `Plaid`) throws at startup. Net effect for prod: you can ONLY launch with `NODE_ENV=development`, which means no `local-fs` storage guard, no AdminGuard-on-prod-vs-dev separation, and the `ConsoleNotificationAdapter` is the only registered SMS/email path — every OTP for every real user gets logged at WARN level to stdout.
- **PII-vault gate is correctly designed but JIT unmask reads can re-render Adverse Action Notices into S3.** When a regulator demands evidence, the document name leaks identity (filename includes app-id prefix and SHA tail). A signed-URL eavesdropper can hit `presignedReadUrl` results within 15 min and pull PDFs containing the consumer's legal name + full address.
- **Pen-test blockers.** No `.well-known/security.txt`, no robots.txt, no HSTS, Swagger docs mounted on every non-prod env at `/docs`, CORS uses Lovable wildcard regex `^https://.*\.lovable\.app$` (subdomain takeover surface = enormous). A standard external pen-test would burn the first day on basic infra hygiene.

---

## 2. Per-bucket findings

### Bucket 1 — AUTH + SESSION

---

#### SEC-001 — Partner-portal sign-in falls through to "demo admin" on real auth failure

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| CWE      | CWE-287 Improper Authentication                           |
| Severity | **P0**                                                    |
| Location | `apps/partner-portal/app/(auth)/sign-in/page.tsx:117-131` |

Threat scenario: An attacker visits `/sign-in`, submits any credentials. When the backend `/v1/auth/login` returns 401 (or the BFF is offline), `signIn()` catches the failure and silently calls `startDemo(activeRole)` which sets the `eazepay_demo=admin` cookie (httpOnly, path `/`). The middleware (`apps/partner-portal/middleware.ts:41-43`) treats either `eazepay_at` OR `eazepay_demo` as a valid session, so the attacker now traverses every protected page. While most backend mutations gate on a missing `eazepay_at`, the demo path leaks the entire UI structure, page state, and any data baked into server components.

Fix: Remove the demo fallthrough entirely from the sign-in submit path. If a demo workspace is needed for evaluation, expose it behind a separate, intentional button labelled "Use demo workspace" — never as a silent catch on failure. Code change:

```ts
// apps/partner-portal/app/(auth)/sign-in/page.tsx
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  setError(
    body.code === 'invalid_credentials'
      ? 'Email or password is incorrect.'
      : body.detail || 'Sign-in failed.',
  );
  setSubmitting(false);
  return; // NO startDemo() call here
}
```

---

#### SEC-009 — Bearer-token guard never checks session revocation

| Field    | Value                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| CWE      | CWE-613 Insufficient Session Expiration                                                     |
| Severity | **P0**                                                                                      |
| Location | `services/auth/src/guards/jwt-auth.guard.ts:47-55`; access TTL = 900s in `apps/api/.env:15` |

Threat scenario: Admin disables a compromised user via `PATCH /v1/admin/team/:id {status:'disabled'}` (`services/admin/src/team.service.ts:228-235`). The disable path revokes all `Session` rows. However `JwtAuthGuard` only calls `TokenService.verifyAccess`, which checks `iss/aud/exp` against the access secret — it never queries the Session table. The disabled user's already-issued JWT keeps working for up to `ACCESS_TOKEN_TTL_SECONDS = 900` (15 min). For an exfiltrating insider with a current JWT, "disable now" buys 15 minutes of damage.

Fix: In `JwtAuthGuard.canActivate`, after `verifyAccess` succeeds, look up the `Session` row by `claims.sid` and fail if `revokedAt != null` OR `expiresAt < now`. Cache lookups in Redis with a 30s TTL to avoid a hot-path DB call per request.

---

#### SEC-010 — Webhooks process has hardcoded fallback JWT secret

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| CWE      | CWE-798 Use of Hard-coded Credentials         |
| Severity | **P0**                                        |
| Location | `apps/webhooks/src/webhooks-app.module.ts:32` |

Code snippet (verbatim):

```ts
jwtAccessSecret: process.env['JWT_ACCESS_SECRET'] ?? 'dev-secret-replace-me-32-bytes-aaa',
```

Threat scenario: If an operator forgets to set `JWT_ACCESS_SECRET` on the webhooks replica (or env-var injection differs between `apps/api` and `apps/webhooks` in Railway), the webhooks process boots with the well-known fallback string. Anyone who reads the public repo (the string is in this file) can sign a JWT with it and call the webhook process as any user (subject to whichever routes it exposes; today only `/v1/webhooks/esign/:provider`, but the AuthModule's JwtAuthGuard is registered globally and exposes the auth controller endpoints too).

Fix: Refuse to boot if `JWT_ACCESS_SECRET` is missing:

```ts
const jwtAccessSecret = process.env['JWT_ACCESS_SECRET'];
if (!jwtAccessSecret || jwtAccessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET required (32+ chars)');
}
```

Also: the same module wires `redisToken: 'unused'` which means any code path that resolves `REDIS_CLIENT` will crash at runtime; the safer move is to publish a separate `WebhooksAuthModule` that omits OtpService entirely.

---

#### SEC-011 — Refresh-token rotation does not invalidate session row that authenticated the rotation

| Field    | Value                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------- |
| CWE      | CWE-384 Session Fixation                                                                              |
| Severity | **P1**                                                                                                |
| Location | `services/auth/src/internal/session.service.ts:46-86` and `services/auth/src/auth.service.ts:182-187` |

Threat scenario: `rotate()` returns `{userId, sessionId}` where `sessionId` is the OLD session's id (revoked in the same tx). Then `auth.service.ts:185` calls `issueSession(userId, deviceId, 'auth.token.refreshed')` which `prisma.session.create`s a NEW session row. So far correct. BUT the access JWT minted earlier for the OLD `sid` is STILL valid until its `exp` lapses (≤ 15 min). An attacker who exfiltrates a victim's access JWT can use it after the victim refreshed — the old JWT references the old `sid`, but `JwtAuthGuard` doesn't check `Session.revokedAt`, see SEC-009.

Fix: tied to SEC-009. With session-revocation enforced in the guard, this finding evaporates.

---

#### SEC-012 — OTP rate-limiting is per-challenge, not per-identifier or per-IP

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| CWE      | CWE-307 Improper Restriction of Excessive Authentication Attempts |
| Severity | **P1**                                                            |
| Location | `services/auth/src/internal/otp.service.ts:82-101`                |

Threat scenario: An attacker repeatedly calls `POST /v1/auth/login` for the same `identifier`. Each call creates a fresh 6-digit OTP challenge (10^6 search space) and SENDS A REAL SMS / EMAIL. `MAX_ATTEMPTS=5` applies to a single `challengeId`, but the attacker can request a new challenge for the same identifier ~unbounded times. That gives both an OTP guessing oracle (5 guesses × N challenges) and a Twilio / SES billing-drain DoS. The 600-second TTL of each Redis key is generous — at 100 requests/min, the attacker can sustain a 60k-pending-challenge backlog cheaply.

Fix: Add a per-identifier sliding window: maximum 3 active OTP challenges and 10 OTP requests in any rolling 60 minutes. Implement as `INCR otp:rl:<sha(identifier)>` with `EXPIRE 3600` on first set. Reject 429 when over threshold.

---

#### SEC-013 — Login response distinguishes "user not found" vs "wrong password" by which step throws

| Field    | Value                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-204 Observable Response Discrepancy                                                                  |
| Severity | **P2**                                                                                                   |
| Location | `services/auth/src/adapters/local-identity.adapter.ts:72-97`, `services/auth/src/auth.service.ts:96-145` |

Threat scenario: The adapter does run the dummy hash to equalise timing (good). However `auth.login()` then unconditionally issues an OTP challenge to `dto.identifier`. If the identifier doesn't exist, no OTP is delivered (mock just logs). With the real notification adapter, a non-existent email will return a 200 with `challengeId` but no email arrives — and the API still responds `mfaRequired:true`. An attacker can verify accounts by submitting `verify-otp` with a guess and observing whether `otp_invalid` vs `otp_expired_or_invalid` is returned. Account enumeration on register is mitigated by the unified `account_exists` Conflict (P2002 path); on login it is not.

Fix: For non-existent users, after the dummy-hash timing pad, choose a stable response shape (e.g. 401 `invalid_credentials`) and skip the OTP step entirely. Match all other timing characteristics to the real path via a constant-time delay.

---

#### SEC-014 — `Idempotency-Key` fingerprint omits the authenticated user

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| CWE      | CWE-285 Improper Authorization                                      |
| Severity | **P1**                                                              |
| Location | `apps/api/src/common/interceptors/idempotency.interceptor.ts:64-69` |

Threat scenario: The fingerprint hashes `{ method, url, body, sub: req.user?.sub ?? null }`. But `JwtAuthGuard` populates `req.user.userId`, not `req.user.sub` (see `services/auth/src/guards/jwt-auth.guard.ts:49`). Therefore `req.user?.sub` is always `undefined`, every Idempotency-Key is effectively user-less. An attacker who guesses or sniffs another user's Idempotency-Key plus body can mint the same response — and on `POST /v1/applications`, they get back the OTHER user's application snapshot from the cached 201 body.

Fix: Bind the user explicitly:

```ts
const fingerprint = stableJsonSha256({
  method: req.method,
  url: req.url,
  body: req.body ?? null,
  userId: req.user?.userId ?? null,
});
const redisKey = `idemp:${req.user?.userId ?? 'anon'}:${key}`;
```

Optionally reject the request entirely if `req.user` is absent on a route that uses `@Idempotent()` and is not `@Public()`.

---

#### SEC-015 — Password policy permits passphrases but DOES NOT block known-breached passwords

| Field    | Value                                        |
| -------- | -------------------------------------------- |
| CWE      | CWE-521 Weak Password Requirements           |
| Severity | **P3**                                       |
| Location | `services/auth/src/dto/register.dto.ts:5-12` |

Threat scenario: The Zod schema enforces complexity (12 chars + upper + lower + digit + symbol) but does not check against HIBP's k-anonymity API. Passwords like `Welcome2026!` pass.

Fix: Add a `PwnedPasswordsAdapter` that hashes the password locally with SHA-1, sends only the first 5 hex chars to `api.pwnedpasswords.com`, and rejects if the suffix appears in the response. Fail-open on outage but record a `risk_signal=hibp_unchecked` on the user.

---

#### SEC-016 — No MFA enrolment, no recovery codes, no step-up for sensitive ops

| Field    | Value                                                                                         |
| -------- | --------------------------------------------------------------------------------------------- |
| CWE      | CWE-308 Use of Single-factor Authentication                                                   |
| Severity | **P1**                                                                                        |
| Location | `services/auth/src/auth.service.ts:96-145` (login is always SMS/email OTP, no TOTP enrolment) |

Threat scenario: SMS OTP can be SIM-swapped; email OTP can be intercepted. There is no path to enroll an authenticator app (TOTP) and no per-action step-up (e.g. admin override, JIT unmask, large-amount approval). Admin actions in `admin.controller.ts` are gated only by `AdminGuard` which reads `User.isAdmin`. A stolen admin session yields full PII unmask + decline override capability without further challenge.

Fix: Implement TOTP enrolment (`POST /v1/me/mfa/totp/enroll`) with recovery codes and require step-up OTP on: PII unmask approval, decline override, team role escalation, bank-account default change, refund issuance.

---

### Bucket 2 — AUTHORIZATION (RBAC + tenancy)

---

#### SEC-007 — `team.invite()` silently promotes an existing consumer User to admin

| Field    | Value                                        |
| -------- | -------------------------------------------- |
| CWE      | CWE-269 Improper Privilege Management        |
| Severity | **P0**                                       |
| Location | `services/admin/src/team.service.ts:130-155` |

Threat scenario: An admin types a known consumer email (e.g. their ex-spouse) into the team-invite form. `invite()` does `findUnique({where:{email}})`, finds the existing consumer User row, and on the `else`/`update` branch sets `isAdmin:true`, `platformRole: input.role`, `status: 'pending_verification'`. The consumer's account is now admin-flagged without their knowledge. Their next sign-in passes through `AdminGuard` (because `isAdmin === true && status === 'active'` — wait, status flipped to pending_verification → re-verify on next login → after OTP, status becomes 'active', and they ARE admin).

Fix: Refuse to upgrade an existing user with `platformRole == null` unless the request body includes an explicit `confirmPromoteConsumer: true` flag, and write a `user.role.escalation.from_consumer` audit row that requires same-step dual-control (a second admin must co-approve before `isAdmin` flips).

---

#### SEC-017 — `MerchantService.create()` lets any authenticated user create a merchant they own

| Field    | Value                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-862 Missing Authorization                                                                           |
| Severity | **P2**                                                                                                  |
| Location | `services/merchant/src/merchant.controller.ts:30-35`, `services/merchant/src/merchant.service.ts:30-79` |

Threat scenario: Any consumer who authenticates can `POST /v1/merchants` with arbitrary `legalName`, becomes `owner`, then `POST /v1/merchants/:id/beneficial-owners` with fabricated PII, then `POST /v1/merchants/:id/kyb/start` — in dev the mock returns `approved` and the merchant becomes "active". They can then generate `application-links` and route consumer applications through their fake merchant. There is no gate that says "only platform staff or whitelisted operators can create merchants."

Fix: Gate `POST /v1/merchants` behind `AdminGuard` (or a new "operator" role) for production. In dev keep open. If operator-self-serve is the product, require an out-of-band approval — store `Merchant.status='pending_review'` and only flip to `kyb_in_progress` after admin approval.

---

#### SEC-018 — Admin queue / detail / audit-log reads write no audit rows

| Field    | Value                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------- |
| CWE      | CWE-778 Insufficient Logging                                                                    |
| Severity | **P2**                                                                                          |
| Location | `services/admin/src/admin.controller.ts:165-218`, `services/admin/src/admin.service.ts:355-578` |

Threat scenario: A rogue admin can browse `/v1/admin/applications`, `/v1/admin/applications/:id`, `/v1/admin/audit-logs` and `/v1/admin/risk-flags` without ANY audit trail. They can profile every applicant in the queue, read every flag, and the only forensic evidence is application-layer logs (which are pino and may not be retained). When a regulator asks "which staff member read this consumer's record on 2026-04-15?", the answer is "we don't know."

Fix: Wrap admin reads in a middleware (`@AuditedRead({targetType, idParam})`) that writes an `admin.<resource>.read` row to `auditOutbox` with `actorId=adminUserId, targetId=<resourceId>`. For list reads, audit the FILTER, not every row id. Same applies to `getApplicationDetail` which exposes user.email, user.phoneE164, all offers + lender routes.

---

#### SEC-019 — `PiiVaultService.open()` AAD binds to subjectKey but BeneficialOwner uses `merchantId` as the key

| Field    | Value                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-639 Authorization Bypass Through User-Controlled Key                                                      |
| Severity | **P1**                                                                                                        |
| Location | `services/merchant/src/merchant.service.ts:121` and `:175-180`, `services/admin/src/admin.service.ts:837-846` |

Threat scenario: A merchant has N beneficial owners, all sealed with AAD `pii:<merchantId>:v1`. There is NO per-BO discriminator in the AAD. Therefore any of the N ciphertexts for that merchant can be swapped onto a different `BeneficialOwner` row (same merchant) without the decrypt failing. Combine with a SQL race or admin direct DB write and the wrong PII is bound to a fake owner identity — useful for KYB fraud where an attacker swaps a clean person's PII to pass review.

Fix: Either change AAD to `pii:bo:<beneficialOwnerId>:v1` (requires writing the BO row first, then sealing — chicken-and-egg fix via a deterministic UUID generated client-side and binding the AAD to that), OR add a per-row `boIndex` discriminator into the AAD.

---

#### SEC-020 — Application IDOR via `findFirst({where:{id, userId}})` is correct, but `getApplicationDetail` admin path uses `findUnique({where:{id}})` without scope

| Field    | Value                                                    |
| -------- | -------------------------------------------------------- |
| CWE      | CWE-639 Authorization Bypass Through User-Controlled Key |
| Severity | **P2** (admin-only path — guarded but unaudited)         |
| Location | `services/admin/src/admin.service.ts:428-494`            |

Same root cause as SEC-018 — admin path is correctly scoped but logs nothing.

---

#### SEC-021 — `WebhookEndpointController` exposes deliveries to read-only members

| Field    | Value                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| CWE      | CWE-200 Exposure of Sensitive Information                                               |
| Severity | **P2**                                                                                  |
| Location | `services/webhook/src/webhook.service.ts:174-210` (`assertMerchantMember`, not Manager) |

Threat scenario: `read_only` and `staff` members of a merchant can call `GET /v1/merchants/:merchantId/webhooks/:id/deliveries` and see entire historical `payload` JSON. If `payload` ever contained PII (e.g. `merchantUserId`, applicant first name in `application.contracted` events), that leaks to roles that shouldn't see it.

Fix: `assertMerchantManager` for delivery reads OR redact payload fields on the response for `read_only` callers. Document in `WebhookPublishInput` that `payload` must be free of PII (today it is, but the typing doesn't enforce it).

---

### Bucket 3 — PII HANDLING

---

#### SEC-022 — `ConsoleNotificationAdapter` logs the OTP code to stdout at WARN level

| Field    | Value                                                              |
| -------- | ------------------------------------------------------------------ |
| CWE      | CWE-532 Insertion of Sensitive Information into Log File           |
| Severity | **P1** in dev; **P0** if it ever runs in prod                      |
| Location | `services/auth/src/adapters/console-notification.adapter.ts:15-17` |

Threat scenario: The adapter logs OTP codes, destination phone/email, and purpose. AuthModule refuses to wire it in non-development, but with no production adapter wired, an operator who sets `NODE_ENV=development` on a public-facing replica (which the Dockerfile cannot enforce) will leak every login OTP to CloudWatch/Datadog/wherever logs go. SOC 2 violation if discovered.

Fix: Refuse to log the code at all even in dev — log only `[DEV-ONLY] OTP delivered via <channel> to <hashed destination>`. Engineers can recover the code from Redis `otp:<challengeId>` directly during dev work.

---

#### SEC-023 — PII vault leakage via `MeResponse` returns the FULL decrypted profile to whoever holds the access JWT

| Field    | Value                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| CWE      | CWE-200 Exposure of Sensitive Information                                               |
| Severity | **P1**                                                                                  |
| Location | `services/user/src/user.controller.ts:18-20`, `services/user/src/user.service.ts:39-72` |

Threat scenario: `GET /v1/me` returns `profile: PiiV1` — legal name, DOB, SSN last-4, full address. Designed for the consumer's own use, but any attacker with a stolen access JWT or session-fixated browser tab can immediately exfiltrate this. There is no server-side masking, no JIT-unmask flow for the consumer themselves, no fine-grained scope on the JWT.

Fix: Default `GET /v1/me` returns masked fields (`'***'` for SSN last-4, `address.zip` only). Add `?reveal=full` requiring a recent step-up MFA challenge captured within the last 5 minutes. The mobile/web apps that need to render the full profile (account-settings page) call `/v1/me?reveal=full` after the user re-enters their password or completes a fresh OTP.

---

#### SEC-024 — Adverse Action Notice filename embeds applicant ID prefix → enumeration

| Field    | Value                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| CWE      | CWE-200 Exposure of Sensitive Information                                                                                |
| Severity | **P3**                                                                                                                   |
| Location | `services/compliance-doc/src/compliance-doc.service.ts:212` (`filename: 'adverse-action-' + app.id.slice(0,8) + '.pdf'`) |

Threat scenario: Filenames are visible in Content-Disposition headers, browser download history, and email forwards. An 8-char UUID prefix doesn't reveal much alone, but combined with timing data and known application IDs from logs, an investigator can trace which document corresponds to which applicant.

Fix: Use an opaque filename like `eazepay-decision-notice.pdf`. Keep the storage key separate from the visible filename.

---

#### SEC-025 — Local-fs presigned URL signing secret defaults to `'dev-only-replace-me'`

| Field    | Value                                                                           |
| -------- | ------------------------------------------------------------------------------- |
| CWE      | CWE-1188 Insecure Default Initialization of Resource                            |
| Severity | **P1**                                                                          |
| Location | `apps/api/src/config/env.ts:44`, `libs/shared-utils/src/local-fs-storage.ts:28` |

Threat scenario: If an operator forgets to set `LOCAL_FS_STORAGE_SIGNING_SECRET` in dev, every presigned URL is signed with the publicly-known string `dev-only-replace-me`. Anyone can forge `sig=` query params for any path. The dev-storage controller refuses to mount in production, but dev environments often hold real test PII (engineers paste their own SSN-last-4 during E2E testing).

Fix: Require the env var; refuse to boot if it equals the default string:

```ts
LOCAL_FS_STORAGE_SIGNING_SECRET: z.string().refine(
  v => v !== 'dev-only-replace-me',
  'must not be the placeholder; generate via: openssl rand -hex 32',
),
```

---

#### SEC-026 — `risk.assess` velocity check is a no-op (audit field never set)

| Field    | Value                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------- |
| CWE      | CWE-840 Business Logic Errors                                                                        |
| Severity | **P2** (functional bug with security relevance)                                                      |
| Location | `services/risk/src/risk.service.ts:108-115`, `services/application/src/application.service.ts:54-77` |

Threat scenario: The IP velocity check queries `auditOutbox.count({action:'application.created', after: { path: ['ipAddress'], equals: input.ipAddress }})`. But `application.create` audit row's `after` payload (built in `auditPayload`, line 591-599) does NOT include `ipAddress`. So the count is always zero. The "IP cap of 5 applications in 24h" gate is silently broken. Fraudsters can submit unlimited applications from one IP.

Fix: Add `ipAddress` and `userAgent` to the audit payload at create time; the create endpoint already has `@Ip()` in scope on `submit()` — extend to `create()` as well.

---

#### SEC-027 — `application.created` audit doesn't preserve userAgent / deviceFingerprint on `submit`

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| CWE      | CWE-778 Insufficient Logging                              |
| Severity | **P3**                                                    |
| Location | `services/application/src/application.service.ts:193-215` |

Same as SEC-026 plus: when `submit()` is called, `ctx = {ipAddress, userAgent, deviceFingerprint}` is passed but only consumed by the post-submit hook. The state transition audit row records `event` but not `ctx`. A fraud investigation later cannot answer "which device fingerprint submitted application X?".

Fix: Pass `ctx` into the audit `after` payload on the SUBMIT transition.

---

### Bucket 4 — CRYPTOGRAPHY

---

#### SEC-002 — Webhook dispatcher signs with `secretHash`, not the raw secret

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| CWE      | CWE-327 Use of a Broken or Risky Cryptographic Algorithm     |
| Severity | **P0**                                                       |
| Location | `services/webhook/src/internal/dispatcher.service.ts:99-129` |

Code snippet (verbatim):

```ts
// We don't have the raw secret (we stored hash). … For MVP without
// KMS wired, we accept that webhook signing is deferred …
const signaturePlaceholder = createHmac('sha256', d.endpoint.secretHash)
  .update(`${timestamp}.${bodyJson}`)
  .digest('hex');
…
'x-eazepay-signature-placeholder': `sha256=${signaturePlaceholder}`,
```

Threat scenarios:

1. **Merchants cannot verify signatures.** They hold the raw secret (returned once at create-time). The dispatcher signs with HMAC(sha256(rawSecret), payload). The merchant verifies HMAC(rawSecret, payload). These two HMACs are different. No merchant integration could possibly pass.
2. **Secret-hash leakage.** Anyone who intercepts a single webhook delivery learns the HMAC of `(timestamp.bodyJson)` under the secret-hash. That, paired with the publicly-readable `secretHash` column (it's just a sha256), means an attacker who reads the DB once can forge subsequent webhook deliveries to any merchant endpoint that trusts the dispatcher's URL.
3. **The header name is wrong.** Sent as `x-eazepay-signature-placeholder`, the merchant docs and `apps/partner-portal/lib/api-v1/shared.ts:62` reference `X-EazePay-Signature`.

Fix:

- Store the raw secret in a KMS-encrypted store (DynamoDB with KMS CMK, or an AWS Secrets Manager entry per endpoint). Never store the raw secret in Postgres.
- Dispatcher loads via `SecretResolver.get(endpointId)` and signs with raw secret.
- Header name must be `X-EazePay-Signature: sha256=<hex>` and `X-EazePay-Timestamp: <unix>`.
- Until this is done, do not enable outbound webhooks in production — gate behind `WEBHOOK_DISPATCHER_ENABLED=false`.

---

#### SEC-028 — `verifySignature` in partner-portal uses non-constant-time `hex === signature`

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| CWE      | CWE-208 Observable Timing Discrepancy         |
| Severity | **P2**                                        |
| Location | `apps/partner-portal/lib/api-v1/shared.ts:85` |

Threat scenario: A remote attacker measures response latency to deduce signature bytes one at a time. With high-cadence requests and stable network conditions, a 64-hex-char HMAC can be brute-forced byte-by-byte within ~hours.

Fix: Use a constant-time compare. In the Edge runtime, hand-roll:

```ts
const a = new TextEncoder().encode(hex);
const b = new TextEncoder().encode(signature);
if (a.length !== b.length) return { status: 'invalid', ... };
let diff = 0;
for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
return diff === 0 ? { status: 'valid' } : { status: 'invalid', ... };
```

---

#### SEC-029 — `LOCAL_KEK_HEX` in `apps/api/.env` is a real 64-char hex value

| Field    | Value                                                          |
| -------- | -------------------------------------------------------------- |
| CWE      | CWE-321 Use of Hard-coded Cryptographic Key                    |
| Severity | **P2** (gitignored, local-only — but rotation hygiene matters) |
| Location | `apps/api/.env:21`                                             |

Threat scenario: The file is gitignored, so it is not in version control. However any backup, docker layer cache, or filesystem snapshot containing the developer's home folder leaks the KEK. With the KEK, every ConsumerProfile blob in the dev DB is decryptable.

Fix:

- Add a pre-commit hook check that fails if `.env` files contain entropy-rich strings.
- Rotate the local KEK before any shared dev environment goes online.
- In prod, switch to KMS-backed KeyManager (the `kms` branch in `UserModule` throws today — implement it).

---

### Bucket 5 — INPUT VALIDATION + INJECTION

---

#### SEC-030 — `e-sign provider` URL param flows into `process.env` key construction

| Field    | Value                                                      |
| -------- | ---------------------------------------------------------- |
| CWE      | CWE-15 External Control of System or Configuration Setting |
| Severity | **P2**                                                     |
| Location | `apps/api/src/app/esign-webhook.controller.ts:87`          |

Code snippet:

```ts
const secret = process.env[`ESIGN_WEBHOOK_SECRET_${provider.toUpperCase()}`];
```

Threat scenario: `provider` is user-controlled via `POST /v1/webhooks/esign/:provider`. An attacker can probe `process.env` keys by trying providers like `path` (resolves to `ESIGN_WEBHOOK_SECRET_PATH` — likely undefined), causing different error messages and potentially exposing the env-var set on the box via response differential. Bigger risk: an attacker who can set environment variables (Railway misconfiguration) can pre-stage a `ESIGN_WEBHOOK_SECRET_<X>` and then submit `provider=X` to mount a private signature scheme.

Fix: Allowlist providers strictly: `z.enum(['mock','docusign','dropbox_sign']).parse(provider)`. Refuse anything else with 404.

---

#### SEC-031 — ESign mock provider accepts plaintext `'dev-mock'` header in ALL environments

| Field    | Value                                                |
| -------- | ---------------------------------------------------- |
| CWE      | CWE-489 Active Debug Code                            |
| Severity | **P1**                                               |
| Location | `apps/api/src/app/esign-webhook.controller.ts:80-85` |

Threat scenario: The mock branch runs regardless of `NODE_ENV`. If the ESIGN_PROVIDER env stays at `mock` (the default) in prod, any HTTP client can POST `x-signature: dev-mock` and complete contract signing for arbitrary `envelopeId`, transitioning Applications to `contracted` and triggering Loan creation + disbursement.

Fix: Gate the mock branch on `process.env.NODE_ENV !== 'production'` AND `env.ESIGN_PROVIDER === 'mock'`. Better: throw at boot if `NODE_ENV=production && ESIGN_PROVIDER=mock`.

---

#### SEC-032 — `req.url` in idempotency fingerprint includes query string — fragile cache keying

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| CWE      | CWE-345 Insufficient Verification of Data Authenticity              |
| Severity | **P3**                                                              |
| Location | `apps/api/src/common/interceptors/idempotency.interceptor.ts:64-69` |

Threat scenario: A client sends `POST /v1/applications?utm_source=email` with Idempotency-Key K. Retries without UTM produce a different fingerprint → 409 `idempotency_key_mismatch`. Worse: the cached body of the first response is held under a fingerprint that includes the marketing param, so a normal retry might double-execute.

Fix: Strip query params from the fingerprint URL. Use `req.routerPath` (Fastify) or strip via `new URL(...).pathname`.

---

#### SEC-033 — No file-upload virus scan / size cap / content-type allow-list

| Field    | Value                                                           |
| -------- | --------------------------------------------------------------- |
| CWE      | CWE-434 Unrestricted Upload of File with Dangerous Type         |
| Severity | **P3** (no upload endpoint exists in the audited surface today) |
| Location | n/a — flagged as a gap for upcoming features                    |

The compliance-doc and document-download paths only RENDER PDFs server-side. No consumer-uploaded ID image / pay-stub endpoint exists yet. When it ships, this becomes P0; pre-emptive guidance:

Fix when wiring uploads: enforce `multipart/form-data` with bodyLimit 10MB, ClamAV scan on every blob, allowlist `image/jpeg`, `image/png`, `application/pdf`, scan first 8 bytes for magic-number match, generate random object keys (never user-supplied filenames), store in a separate "quarantine" bucket until scan completes.

---

### Bucket 6 — WEBHOOKS

---

#### SEC-003 — Demo lender API treats absent signature headers as `status:'skipped'` and returns 200

| Field    | Value                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-345 Insufficient Verification of Data Authenticity                                                                                                                                               |
| Severity | **P0**                                                                                                                                                                                               |
| Location | `apps/partner-portal/lib/api-v1/shared.ts:58-60`, used in `apps/partner-portal/app/api/v1/webhooks/lenders/[lender]/route.ts` and `apps/partner-portal/app/api/v1/lenders/[lenderId]/quote/route.ts` |

Code (verbatim):

```ts
if (!timestamp && !nonce && !signature) {
  return { status: 'skipped', reason: 'No signature headers — demo allows unsigned calls.' };
}
```

Threat scenario: An attacker sends `POST /api/v1/webhooks/lenders/buzzpay` with body `{"event_type":"loan.funded","loan_id":"<victim_loan_id>"}` and ZERO signature headers. The verifier returns `status:'skipped'`, the route accepts the payload and (in a production-grade integration) flips loan state. Even in demo mode this teaches integrating lenders that no signature ≡ acceptable.

Fix: Reject `skipped` as `401` in all non-development environments. In demo mode, return 200 but flag `_meta.warning = 'signature_missing_will_be_rejected_in_prod'` rather than 200 ok.

---

#### SEC-034 — Inbound webhook receivers don't enforce a replay window

| Field    | Value                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-294 Authentication Bypass by Capture-replay                                                                 |
| Severity | **P1**                                                                                                          |
| Location | `apps/api/src/app/highsale-webhook.controller.ts:75-198`, `apps/api/src/app/esign-webhook.controller.ts:48-105` |

Threat scenario: Highsale + e-sign webhook handlers verify HMAC but don't check a timestamp or replay window. An attacker who captures a signed webhook (via MITM, partner-side log, etc.) can replay it forever. The `highsaleRef` upsert protects against duplicate snapshots being CREATED, but replay of an outdated snapshot can re-write `creditTier` to a stale value — useful to roll back an applicant from `near_prime` to `sub_prime`.

Fix: Require `x-eazepay-timestamp` header, reject if `abs(now - ts) > 300`s, include `ts` in HMAC input as `<ts>.<body>`.

---

#### SEC-035 — `WebhookDispatcher` retry loop has no maximum payload size / no per-merchant queue isolation

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| CWE      | CWE-770 Allocation of Resources Without Limits or Throttling |
| Severity | **P2**                                                       |
| Location | `services/webhook/src/internal/dispatcher.service.ts:50-79`  |

Threat scenario: One slow / malicious merchant endpoint can hold up the dispatcher worker — `BATCH_SIZE=50` is serial inside `for (const d of candidates)`. With a 10s timeout per attempt and 12 attempts/event, a single attacker-controlled URL can starve every other merchant's webhook delivery for an entire minute per tick.

Fix: Move dispatcher to a per-merchant queue partition (BullMQ / SQS FIFO grouped by merchantId). Cap total payload size of `webhookDelivery.payload` to 8KB on insert.

---

### Bucket 7 — MONEY FLOWS

---

#### SEC-036 — Disbursement destination has no consumer-bank verification gate

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| CWE      | CWE-345 Insufficient Verification of Data Authenticity |
| Severity | **P1**                                                 |
| Location | `services/payment/src/payment.service.ts:256-271`      |

Threat scenario: `disburseAndSchedule` calls `provider.disburse` with `destination: { kind: 'consumer_bank', userId: loan.userId }`. There is NO check that the consumer has a verified `PaymentMethod` row, and even if there is, no check that the chosen method is the default and is still `status='verified'`. The mock adapter accepts anything; a production adapter (e.g. Modern Treasury) would need a bank account id, which today is not passed. When the production path lands, expect funds to be routed to whichever account the operator implicitly chooses — risk of misdirection.

Fix: Before disbursement, look up `paymentMethod` with `userId=loan.userId, isDefault=true, status='verified'`, throw `Conflict({code:'no_verified_disbursement_account'})` if absent, and pass the providerToken to the disburse call.

---

#### SEC-037 — Repayment schedule generation has integer-rounding edge cases on small principal

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| CWE      | CWE-682 Incorrect Calculation                     |
| Severity | **P3**                                            |
| Location | `services/payment/src/payment.service.ts:604-630` |

Threat scenario: `baseInstallment = totalRepayable / term`. With `totalRepayable=1n` and `term=12`, `baseInstallment=0n`, remainder=1n. Eleven installments of 0 cents and one of 1 cent. Doesn't actually break anything but Reg Z disclosures show $0 monthly payment — operationally embarrassing.

Fix: Enforce `loan.principalCents >= 500_00n` (BigInt) on Application validation; reject otherwise.

---

#### SEC-038 — Loan state transitions don't enforce single-active-loan-per-application invariant

| Field    | Value                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| CWE      | CWE-362 Race Condition                                                                                       |
| Severity | **P2**                                                                                                       |
| Location | `services/application/src/application.service.ts:381-481`, `services/payment/src/payment.service.ts:221-271` |

Threat scenario: `completeContractSigned` can be called twice in parallel (consumer's mock e-sign returns synchronous, then the webhook also fires from the same envelopeId). Idempotency check `if app.status === 'contracted' || 'funding' || 'active' return` exists, but only at the start of the transaction — not as a unique-constraint on the Loan table. If both calls race past the check, two Loan rows can be created from one accepted offer, then disbursement happens twice.

Fix: Add a unique index on `Loan.offerId` (one Loan per accepted Offer). Postgres will reject the second insert; the catch block can swallow `P2002` as "already created, idempotent".

---

### Bucket 8 — AUDIT CHAIN

---

#### SEC-039 — Audit drain hash chain lives in `.head` file inside `tmp/` and is writable by any process

| Field    | Value                                                              |
| -------- | ------------------------------------------------------------------ |
| CWE      | CWE-353 Missing Support for Integrity Check                        |
| Severity | **P2** in dev; depends on production DynamoDB implementation       |
| Location | `services/audit/src/adapters/local-fs-audit-sink.adapter.ts:59-74` |

Threat scenario: An attacker with shell access to the dev box can rewrite `tmp/audit-sink/.head` and every `.jsonl` file. The hash chain is broken but no consumer of the audit log verifies the chain on read. Regulators won't trust a chain whose verifier is on the same box as the data.

Fix:

- The dev sink is fine; production DynamoDB sink MUST be implemented (the README claims it; the code throws). Use a separate AWS account with cross-account `dynamodb:PutItem` only, never `Update`/`Delete`.
- Implement a daily `verify-chain` cron that walks the sink front-to-back and reports any break.

---

#### SEC-040 — `decline` audit row carries the entire `before`/`after` JSON unencrypted

| Field    | Value                                                         |
| -------- | ------------------------------------------------------------- |
| CWE      | CWE-312 Cleartext Storage of Sensitive Information            |
| Severity | **P3**                                                        |
| Location | `services/admin/src/admin.service.ts:170-185` and many others |

Threat scenario: AuditOutbox before/after rows for `application.declined` include `requestedAmountCents` and `complianceReviewId` — not PII strictly, but combined with `targetId=applicationId` the table is a candidate for accidental PII leakage when developers add new fields.

Fix: Establish a typed contract for what is permitted in audit `before`/`after` and lint at the call site. Default-deny: no field whose name matches `/ssn|dob|name|address|phone|email|account|routing/i` may be included.

---

### Bucket 9 — DEPENDENCIES + SUPPLY CHAIN

`pnpm audit --prod` output (verbatim, totals):

```
58 vulnerabilities found
Severity: 5 low | 20 moderate | 32 high | 1 critical
```

Notable advisories (high+ only):

| Package                  | Severity     | CVSS-ish                                                    | Advisory                |
| ------------------------ | ------------ | ----------------------------------------------------------- | ----------------------- |
| `@fastify/middie ≤9.3.1` | **critical** | auth bypass in child plugin scopes                          | GHSA-72c6-fx6q-fr5w     |
| `@fastify/middie ≤9.0.3` | high         | middleware path bypass                                      | GHSA-cxrg-g7r8-w69p     |
| `next 14.2.35` (5 paths) | high         | HTTP request deserialization → DoS in RSC                   | GHSA-h25m-26qc-wcjf     |
| `fastify <5.7.2`         | high         | Content-Type tab char allows body validation bypass         | GHSA-(see audit output) |
| `tar <7.5.7`             | high         | arbitrary file create/overwrite via hardlink path traversal | GHSA-34x7-hfp2-rc4v     |
| `fast-xml-parser <5.7.0` | high         | (multiple paths via react-native)                           | GHSA-gh4j-gqv2-49f6     |
| `next 14.2.35`           | moderate     | CSP nonce XSS, image-optimization DoS, RSC cache poisoning  | (5+ advisories)         |

#### SEC-041 — Fastify middleware authentication bypass (critical)

| Field    | Value                                                                                      |
| -------- | ------------------------------------------------------------------------------------------ |
| CWE      | CWE-285 Improper Authorization                                                             |
| Severity | **P0**                                                                                     |
| Location | `apps/api`, `apps/webhooks` via `@nestjs/platform-fastify 10.4.22 → @fastify/middie 8.3.3` |

Fix: Upgrade `@nestjs/platform-fastify` or pin `@fastify/middie >=9.3.2` via `pnpm.overrides`.

---

#### SEC-042 — Next.js 14.2.35 has multiple high/moderate XSS + cache-poisoning + DoS CVEs

| Field    | Value                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-79 / CWE-444 / CWE-400                                                                                           |
| Severity | **P1**                                                                                                               |
| Location | `apps/partner-portal`, `apps/admin-console`, `apps/consumer-web`, `apps/developer-portal`, `apps/merchant-dashboard` |

Fix: Upgrade Next to `>=15.5.16` across all consumer-facing apps. Verify the partner-portal middleware still behaves correctly (Next 15 changed the matcher semantics).

---

#### SEC-043 — No SBOM / supply-chain attestation in CI

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| CWE      | CWE-1357 Reliance on Insufficiently Trustworthy Component |
| Severity | **P3**                                                    |
| Location | `.github/workflows/`                                      |

Fix: Add `pnpm audit --prod` as a CI gate (fail on high+). Generate SBOM via `cyclonedx-bom`. Verify lockfile integrity.

---

### Bucket 10 — SECRETS + CONFIG

---

#### SEC-044 — `apps/api/.env` contains a real-looking `JWT_ACCESS_SECRET` and `LOCAL_KEK_HEX`

| Field    | Value                                                      |
| -------- | ---------------------------------------------------------- |
| CWE      | CWE-798 Use of Hard-coded Credentials                      |
| Severity | **P2** (file is gitignored — verified with `git ls-files`) |
| Location | `apps/api/.env:14,21`                                      |

Threat scenario: Even though gitignored, these are real entropy values shared in the developer's home folder. If the same developer ships a similar-structured `.env` to staging via copy-paste, those values become production secrets.

Fix: Replace with placeholder strings that visibly fail validation (e.g. `JWT_ACCESS_SECRET=please-replace-with-32-bytes-of-randomness`). The Zod validator already requires min 32 chars, so the placeholder would fail to boot — preventing accidental use.

---

#### SEC-045 — `MOCK_SECRET = 'demo_shared_secret_replace_in_prod'` is hardcoded in shipped code

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| CWE      | CWE-798 Use of Hard-coded Credentials         |
| Severity | **P3**                                        |
| Location | `apps/partner-portal/lib/api-v1/shared.ts:14` |

Fix: Remove. Require an env var `LENDER_DEMO_SHARED_SECRET`; if unset, reject all signature verification attempts.

---

#### SEC-046 — Swagger docs at `/docs` mounted in any non-production env including staging

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| CWE      | CWE-200 Exposure of Sensitive Information |
| Severity | **P3**                                    |
| Location | `apps/api/src/main.ts:72-82`              |

Threat scenario: Staging-only environments expose the full API surface to anyone who finds the URL. Helpful for partners, but also helpful for attackers — every endpoint, every body shape, every Idempotency-Key contract is documented.

Fix: Gate behind a basic-auth proxy in front of staging, OR require a static API key on the docs route.

---

#### SEC-047 — CORS regex wildcard `^https://.*\.lovable\.app$` is dangerously wide

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| CWE      | CWE-942 Permissive Cross-domain Policy with Untrusted Domains     |
| Severity | **P1**                                                            |
| Location | `apps/api/src/config/env.ts:96-107`, `apps/api/src/main.ts:51-70` |

Threat scenario: Lovable.app hosts thousands of unrelated Lovable-built projects. Any of them, if compromised, can make `credentials:true` cross-origin requests to the EazePay API carrying the victim's HttpOnly cookies (when victim is signed in to both domains). With `eazepay_at` accessible cross-origin via Fetch+credentials, a malicious Lovable preview can submit applications, accept offers, and trigger disbursements as the victim.

Fix: Tighten to the specific Lovable preview domain you actually use; OR remove preview wildcards entirely in production. Production CORS should explicitly list `https://app.eazepay.com`, `https://partners.eazepay.com`, nothing more.

---

#### SEC-048 — `next.config.mjs` disables TypeScript and ESLint at build time

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| CWE      | CWE-440 Expected Behavior Violation       |
| Severity | **P3**                                    |
| Location | `apps/partner-portal/next.config.mjs:8-9` |

Threat scenario: Compile-time type errors in security-sensitive paths (token handling, cookie configuration) can slip past code review. The `typescript.ignoreBuildErrors: true` flag has the comment "Pre-existing TS/ESLint errors in unrelated files" — those errors persist forever now.

Fix: Re-enable and fix the legacy errors. CI should reject PRs that don't typecheck.

---

### Bucket 11 — RATE LIMITING + DOS

#### SEC-005 — Zero rate limiting on auth, OTP, application submit, soft-pull

| Field    | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-307 Improper Restriction of Excessive Authentication Attempts                                                |
| Severity | **P0**                                                                                                           |
| Location | `apps/api/src/main.ts` (no throttler module imported), `apps/api/src/app/app.module.ts` (no `@nestjs/throttler`) |

Threat scenario: An attacker can make millions of `POST /v1/auth/login` requests per minute. Each one issues an OTP (mock log; real SES/Twilio in prod burns money), creates a Redis OTP record (memory pressure), and increments any future rate-limit counter (zero today). On `POST /v1/applications`, each call writes a Postgres row in the User's account; sweeping 10 million applications fills the DB.

Fix: Wire `@nestjs/throttler` globally:

```ts
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'short', ttl: 1000, limit: 10 },
    { name: 'medium', ttl: 60_000, limit: 100 },
    { name: 'long', ttl: 3_600_000, limit: 1000 },
  ],
});
```

Override per-route on auth/OTP/soft-pull (3 req/min per IP, 5 req/hour per identifier). Use Redis-backed storage so multiple replicas share counters.

---

#### SEC-049 — `idempotency` interceptor caches successful responses for 24h with no LRU bound

| Field    | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| CWE      | CWE-770 Allocation of Resources Without Limits                   |
| Severity | **P3**                                                           |
| Location | `apps/api/src/common/interceptors/idempotency.interceptor.ts:20` |

Threat scenario: Attacker submits millions of unique `Idempotency-Key` headers, each one with a small body, filling Redis with `idemp:*` keys. With 24h TTL, evicting at the natural rate means memory grows unboundedly until natural expiry.

Fix: Bound the number of in-flight idempotency keys per user (e.g. 100). Reject `idempotency_in_flight_limit_exceeded` past that.

---

### Bucket 12 — PEN-TEST READINESS

---

#### SEC-006 — No security headers on `apps/api` or `apps/partner-portal`

| Field    | Value                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------ |
| CWE      | CWE-693 Protection Mechanism Failure                                                             |
| Severity | **P0**                                                                                           |
| Location | `apps/api/src/main.ts` (no helmet); `apps/partner-portal/next.config.mjs` (no `headers()` block) |

Missing:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; …`
- `X-Frame-Options: DENY` (or `frame-ancestors 'none'` in CSP)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Threat scenario: A standard pen-test scans for these headers in the first 30 minutes and marks the report "Critical: missing HSTS, missing CSP, X-Frame-Options absent → clickjacking against any authenticated page is possible."

Fix on `apps/api`:

```ts
import helmet from '@fastify/helmet';
await app.register(helmet, { contentSecurityPolicy: false });
```

On `apps/partner-portal`:

```js
// next.config.mjs
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.eazepay.com; frame-ancestors 'none'" },
  ],
}],
```

---

#### SEC-008 — Open redirect on `/sign-in?from=`

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| CWE      | CWE-601 URL Redirection to Untrusted Site                           |
| Severity | **P0**                                                              |
| Location | `apps/partner-portal/app/(auth)/sign-in/page.tsx:94-95,132,137-139` |

Code snippet:

```ts
const redirectTo = searchParams.get('from') || '/';
…
router.push(redirectTo);
```

Threat scenario: Attacker sends a phishing link: `https://partners.eazepay.com/sign-in?from=https://evil.com/look-like-eazepay`. Victim signs in (real or demo), router pushes them to `evil.com`. Combined with cookie-set theft via the demo cookie path, an attacker can craft a full phishing flow that looks like genuine post-login behaviour.

Fix:

```ts
const raw = searchParams.get('from') || '/';
const safe = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
router.push(safe);
```

Same guard in `apps/partner-portal/middleware.ts:46-48` where `from` is built into the URL — confirm decoding doesn't allow `//evil.com` slipping through.

---

#### SEC-004 — Outbound webhook dispatcher will hit RFC1918, link-local, and cloud-metadata IPs

| Field    | Value                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| CWE      | CWE-918 Server-Side Request Forgery                                                                              |
| Severity | **P0**                                                                                                           |
| Location | `services/webhook/src/webhook.service.ts:304-326`, `services/webhook/src/internal/dispatcher.service.ts:117-137` |

Threat scenario: A merchant creates a webhook endpoint at `https://169.254.169.254/latest/meta-data/iam/security-credentials/eazepay-prod-role`. The validation rejects `localhost` and `127.0.0.1` but not 169.254.169.254 (AWS IMDS), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. The dispatcher (running inside the VPC) POSTs the webhook payload to IMDS, then reports the response back to the merchant via `webhookDelivery.lastError`. Result: merchant exfiltrates EC2/ECS instance role credentials.

Fix: Resolve the URL hostname, reject if it resolves to:

- `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`
- IPv6 equivalents: `::1`, `fc00::/7`, `fe80::/10`
- AND on each redirect — DNS rebinding requires resolving again before the actual fetch. Use `lookup` to get the IP, validate, then `fetch` with that explicit IP + `Host` header.

```ts
import { lookup } from 'node:dns/promises';
const { address } = await lookup(parsed.hostname);
if (isPrivateIp(address)) throw BadRequest({ code: 'url_private_address_blocked' });
```

---

#### SEC-050 — No `robots.txt` or `.well-known/security.txt`

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| CWE      | CWE-200 Exposure of Sensitive Information |
| Severity | **P3**                                    |
| Location | `apps/partner-portal/public/` (empty)     |

Threat scenario: Pen-testers and security researchers have no contact channel for responsible disclosure; bots crawl every URL.

Fix: Add `apps/partner-portal/public/robots.txt`:

```
User-agent: *
Disallow: /api/
Disallow: /v/
Disallow: /admin/
```

Add `apps/partner-portal/public/.well-known/security.txt`:

```
Contact: mailto:security@eazepay.com
Expires: 2027-05-15T00:00:00Z
Encryption: https://eazepay.com/.well-known/security-pgp.txt
Preferred-Languages: en
```

---

#### SEC-051 — `5xx` errors log full stack traces; problem-exception filter doesn't strip internal detail before serialization

| Field    | Value                                                           |
| -------- | --------------------------------------------------------------- |
| CWE      | CWE-209 Information Exposure Through an Error Message           |
| Severity | **P2**                                                          |
| Location | `apps/api/src/common/filters/problem-exception.filter.ts:55-72` |

Threat scenario: An uncaught `HttpException` thrown from deep code carries `exception.message` which can include DB column names, stack hints, or Prisma error text. The filter passes this back to the client as `title` and `detail`.

Fix: In `toProblem` for non-`ProblemError`/`ZodError`, set `title` and `detail` to opaque strings (`'Internal error'` / undefined) in production and log the real exception server-side. Today the 500 branch is safe — but the `HttpException` branch is too verbose.

---

#### SEC-052 — `presignedReadUrl` filename query param accepts double-quote-stripped input but no max length

| Field    | Value                                              |
| -------- | -------------------------------------------------- |
| CWE      | CWE-20 Improper Input Validation                   |
| Severity | **P3**                                             |
| Location | `apps/api/src/app/dev-storage.controller.ts:62-69` |

Fix: Truncate to 200 chars and refuse characters outside `[A-Za-z0-9._-]`.

---

#### SEC-053 — Cookie `path: '/api/auth'` for `eazepay_rt` is correct for refresh but cookie scope `path:'/'` for `eazepay_at` allows other Next.js routes to read it

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| CWE      | CWE-1004 Sensitive Cookie Without 'HttpOnly' Flag         |
| Severity | **P3** (already HttpOnly, but path could be narrower)     |
| Location | `apps/partner-portal/app/api/auth/login/route.ts:104-118` |

The cookies ARE HttpOnly + Secure (in production) + SameSite=lax. The only ding is that an attacker who later finds an XSS on `apps/partner-portal` cannot read `eazepay_at` (HttpOnly), but the broad `path: '/'` ensures every same-origin request includes it (which is the intent for SPA navigation). Defensible. P3 only.

---

## 3. Open questions for the operator

These need human judgement, not a unilateral auditor call:

1. **Demo mode in production?** SEC-001 and SEC-003 hinge on whether you intend to support a "demo" sign-in path in the live partner-portal. If yes, it must be a separate, labelled button (never a silent fallback), and the demo cookie must be scoped to a separate path (e.g. `/demo/*`) so it can never bypass real auth on the operating-system pages.

2. **What's the production identity provider?** AuthModule's `cognito` branch is unimplemented. Are you committing to Cognito, or moving to Clerk (called out in MEMORY.md)? The choice determines whether HS256 JWT (today) is the long-term shape or a stop-gap.

3. **Webhook signing strategy.** SEC-002 is a P0 blocker. Will you store raw secrets in Secrets Manager (per endpoint) or move to asymmetric signatures (Ed25519 keypair per merchant, public key on the merchant docs page)? The latter requires merchant SDK changes.

4. **Adverse Action Notice retention.** Today retention is hardcoded to 25 months (`compliance-doc.service.ts:14`). This satisfies Reg B / FCRA decline retention but does not address the _loan agreement_ retention (7+ years). Confirm the document-kind retention matrix and parameterise it.

5. **State-of-residence routing.** Orchestration uses `consumerProfile.residentState` (denormalised, plain VARCHAR) — but the underlying `address` is encrypted. What's the source-of-truth? If someone edits their PII blob and the denormalised column doesn't update, are state-licensing rules applied to the right state?

6. **`partner-portal` `NEXT_PUBLIC_API_URL`.** This is exposed to the browser bundle. In production, requests should hit the same origin (no cross-origin needed). Confirm Railway routing and remove the env var if same-origin is the deployment.

7. **`isAdmin` flag vs `platformRole`.** Two systems coexist today (legacy boolean + role enum). The team service flips `isAdmin: true` for any non-null role. The AdminGuard reads `isAdmin` only. Which one is the long-term gate?

8. **`apps/webhooks` deployment shape.** The current module imports the apps/api Auth module with a stub redisToken — this will crash on the first authenticated webhook call. Was that intentional (no authenticated routes on the webhooks process) or an oversight?

---

## 4. Quick wins (≤2-hour fixes)

| ID      | Fix                                                                                          | Effort |
| ------- | -------------------------------------------------------------------------------------------- | ------ |
| SEC-001 | Remove demo fallthrough in `sign-in/page.tsx`                                                | 15 min |
| SEC-008 | Add `safe = raw.startsWith('/') && !raw.startsWith('//')` guard in sign-in page + middleware | 20 min |
| SEC-010 | Refuse to boot webhooks process when JWT_ACCESS_SECRET unset                                 | 10 min |
| SEC-006 | Wire `@fastify/helmet` on `apps/api`; add Next `headers()` block                             | 1h     |
| SEC-014 | Add `userId` to idempotency fingerprint + redis key                                          | 15 min |
| SEC-022 | Stop logging OTP codes (mask in console adapter)                                             | 10 min |
| SEC-031 | Gate esign mock provider on `NODE_ENV !== 'production'`                                      | 5 min  |
| SEC-030 | Allowlist e-sign provider names with `z.enum([...])`                                         | 10 min |
| SEC-046 | Move Swagger docs behind basic-auth in staging                                               | 30 min |
| SEC-050 | Add `robots.txt` and `.well-known/security.txt`                                              | 15 min |
| SEC-025 | Add Zod refinement on `LOCAL_FS_STORAGE_SIGNING_SECRET`                                      | 5 min  |
| SEC-038 | Add unique index on `Loan.offerId` via Prisma migration                                      | 30 min |
| SEC-005 | Wire `@nestjs/throttler` with sensible defaults                                              | 1.5h   |
| SEC-051 | Strip 5xx detail in production in `ProblemExceptionFilter`                                   | 15 min |

**Total**: ~5 hours engineering to close one-third of the findings.

---

## 5. Pen-test prep checklist

| Item                                              | Status                                                                            | Action                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| HSTS on every response                            | **Missing**                                                                       | SEC-006                               |
| Content-Security-Policy                           | **Missing**                                                                       | SEC-006                               |
| X-Frame-Options / frame-ancestors                 | **Missing**                                                                       | SEC-006                               |
| X-Content-Type-Options: nosniff                   | **Missing**                                                                       | SEC-006                               |
| Referrer-Policy                                   | **Missing**                                                                       | SEC-006                               |
| Permissions-Policy                                | **Missing**                                                                       | SEC-006                               |
| `.well-known/security.txt`                        | **Missing**                                                                       | SEC-050                               |
| `robots.txt`                                      | **Missing**                                                                       | SEC-050                               |
| Cookie HttpOnly + Secure + SameSite               | **Present**                                                                       | OK                                    |
| TLS 1.2+                                          | Not auditable from code                                                           | Verify Railway certs                  |
| Open redirect on sign-in                          | **Vulnerable**                                                                    | SEC-008                               |
| Stack trace exposure in prod                      | Partial                                                                           | SEC-051                               |
| Swagger / OpenAPI gated                           | Partial — `NODE_ENV!=='production'` only                                          | SEC-046                               |
| GraphQL introspection                             | N/A (REST only)                                                                   | OK                                    |
| CORS allowlist explicit (no wildcard)             | **Has regex wildcards**                                                           | SEC-047                               |
| Subdomain takeover risk (dangling Railway/Vercel) | Not auditable from code                                                           | Run `subjack` against `*.eazepay.com` |
| Rate limiting on auth / OTP                       | **Missing**                                                                       | SEC-005                               |
| Inbound webhook signature verification            | Highsale: OK. Esign: mock bypass. Partner-portal demo: skipped on missing headers | SEC-003, SEC-031                      |
| Outbound webhook signature                        | **Broken** (signs with sha(secret))                                               | SEC-002                               |
| Outbound webhook SSRF protection                  | **Missing**                                                                       | SEC-004                               |
| PII at rest encrypted                             | **Yes** (AES-256-GCM envelope)                                                    | OK                                    |
| PII in logs                                       | At-risk (OTP code, see SEC-022)                                                   | SEC-022                               |
| Session revocation enforced                       | **No** (guard doesn't check)                                                      | SEC-009                               |
| Password complexity                               | **Yes** but no HIBP                                                               | SEC-015                               |
| MFA enrolment beyond SMS/email                    | **No TOTP, no recovery codes**                                                    | SEC-016                               |
| Audit chain verifiable                            | Dev sink OK, prod sink unimplemented                                              | SEC-039                               |
| Idempotency key user-bound                        | **No**                                                                            | SEC-014                               |
| FCRA reason codes on every decline                | Present in admin path + orchestration                                             | OK                                    |
| Adverse Action Notice rendered                    | Present                                                                           | OK                                    |
| AAN delivered within 30 days                      | Async via notify; depends on prod notification adapter                            | Open                                  |
| JIT PII unmask audit                              | Present                                                                           | OK                                    |
| Dual-control on PII unmask                        | Present                                                                           | OK                                    |
| `pnpm audit --prod` clean                         | **58 vulns: 1 critical, 32 high**                                                 | SEC-041, SEC-042                      |

---

## Appendix A — Audit tooling output

`pnpm audit --prod` was run on the workspace root on 2026-05-15. The full output is too long to embed but representative critical advisories are quoted verbatim in §Bucket 9. Numerical totals:

```
58 vulnerabilities found
Severity: 5 low | 20 moderate | 32 high | 1 critical
```

No `pip-audit` needed (this is a pnpm/Node monorepo with no Python production code in scope).
