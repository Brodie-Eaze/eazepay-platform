# Pen-test readiness checklist - EazePay platform

> Scope. The in-scope surfaces for the planned pen-test are the public
> HTTP surfaces of `apps/api` (the public REST API, OpenAPI documented),
> `apps/partner-portal` (the operator + brand-portal Next.js app),
> and `apps/webhooks` (the standalone webhook ingest worker). Internal
> services under `services/*` are exercised transitively through these
> entry points. Infrastructure-as-code (`infra/terraform`) is out of
> scope. The tester is expected to receive a low-privileged operator
> account and a partner test account for authenticated flows.
>
> Status legend.
>
> - **IMPLEMENTED** means the control is shipped and exercised by tests.
> - **FIXED** means a finding from `SECURITY_AUDIT.md` (2026-05-15) has
>   been closed out.
> - **DEFERRED** means the item is honestly recognised as not yet shipped
>   and is captured in the engineering backlog. Auditors prefer honest
>   gaps over hidden ones.
>
> Last updated: 2026-05-15.

---

## 1. Status table

| Item | Status | Notes |
|---|---|---|
| HSTS on every response | **IMPLEMENTED** | `apps/api/src/main.ts` (helmet `hsts: maxAge 63072000 includeSubDomains preload`) + `apps/partner-portal/next.config.mjs` (same value in `headers()` block). |
| Content-Security-Policy | **IMPLEMENTED** | API CSP `default-src 'self'`, `frame-ancestors 'none'`, narrowed `style-src` for Swagger (dev only). Partner-portal inherits from helmet defaults applied at Next.js edge. |
| X-Frame-Options / frame-ancestors | **IMPLEMENTED** | `X-Frame-Options: DENY` on partner-portal + `frame-ancestors 'none'` in API CSP. Clickjacking blocked on both modern and legacy browsers. |
| X-Content-Type-Options: nosniff | **IMPLEMENTED** | Set on both apps. Stops content-type confusion attacks where a `.txt` upload would be interpreted as JS. |
| Referrer-Policy | **IMPLEMENTED** | `strict-origin-when-cross-origin` on partner-portal; helmet default (`no-referrer`) on API. |
| Permissions-Policy | **IMPLEMENTED** | `camera=(), microphone=(), geolocation=()` on partner-portal. Finance UI has no need for any of them; explicit deny prevents future drift. |
| security.txt | **IMPLEMENTED** | `apps/partner-portal/public/.well-known/security.txt` - `Contact: mailto:security@eazepay.com`, expiry 2027-05-15. |
| robots.txt | **IMPLEMENTED** | `apps/partner-portal/public/robots.txt` - disallows `/api/`, `/v/`, `/admin/`, `/control-panel/`, `/reports/`. Public marketing pages remain crawlable. |
| Cookie hardening (HttpOnly + Secure + SameSite) | **IMPLEMENTED** | Session cookies are `HttpOnly`, `Secure` in production, `SameSite=Lax`. Refresh-token cookie also bound to `__Host-` prefix in production. |
| Open redirect on sign-in | **FIXED** | `apps/partner-portal/middleware.ts` `safeFrom()` and `apps/partner-portal/app/(auth)/sign-in/page.tsx` `safeRedirect()` reject any `from=` that is not a same-origin path. SEC-008. |
| Stack trace exposure in prod | **FIXED** | `apps/api/src/common/filters/problem-exception.filter.ts` ships stable error codes and short messages in production; stacks are logged server-side only. SEC-051. |
| Swagger / OpenAPI gated | **FIXED** | Production refuses to mount `/docs`. Staging requires `SWAGGER_DOCS_USER` + `SWAGGER_DOCS_PASS` basic-auth or refuses to mount. Development keeps it open. SEC-046. |
| CORS allowlist explicit (no wildcards in prod) | **FIXED** | `apps/api/src/main.ts` `enableCors` uses exact origins + explicit regex patterns. Lovable preview wildcards removed for production. Missing-origin requests fall through. SEC-047. |
| Rate limiting (global) | **IMPLEMENTED** | `apps/api/src/app/app.module.ts` ThrottlerModule - three tiers (5 / s, 30 / 10s, 120 / min) per IP. Counters live in Redis so the limit is fleet-wide. |
| Rate limiting (per-route caps) | **IMPLEMENTED** | `@Throttle({ short, medium, long })` decorators on auth / OTP / webhook surfaces - tighter caps where the abuse value is highest. SEC-005. |
| Inbound webhook signature verification | **IMPLEMENTED** | `services/webhook/src/webhook.service.ts` + `services/webhook/src/internal/webhook-signing.ts`. HMAC-SHA256 per source + timestamp replay window backed by Redis seen-set. SEC-003 + SEC-031. |
| Outbound webhook signing (raw secret) | **IMPLEMENTED** | `services/webhook/src/internal/webhook-signing.ts` signs with the raw secret (envelope-decrypted at send time), never the secret hash. SEC-002. |
| SSRF protection (IPv4 + IPv6 blocklist) | **IMPLEMENTED** | `services/webhook/src/webhook.service.ts` `isPrivateOrReservedHost()`. Blocks loopback, RFC1918, link-local (incl. 169.254.169.254 metadata), IPv6 ULA / link-local, and IPv4-mapped IPv6. SEC-004. |
| PII at rest encrypted | **IMPLEMENTED** | `services/user/src/internal/pii-vault.service.ts` - AES-256-GCM envelope with per-row DEK wrapped by KEK. Per-row AAD discriminator binds ciphertext to PK. ADR-0016. |
| PII in logs | **IMPLEMENTED** | `apps/api/src/app/app.module.ts` LoggerModule `redact` block masks authorization, cookie, SSN, DOB, card numbers, routing, account numbers. OTP code masked at adapter layer. SEC-022. |
| Session revocation enforced | **IMPLEMENTED** | `services/auth/src/guards/jwt-auth.guard.ts` checks `Session.revokedAt` on every request. Atomic rotation in `services/auth/src/internal/session.service.ts`. SEC-009 + SEC-011. |
| Audit chain (dev sink) | **IMPLEMENTED** | `services/audit/src/audit-drain.service.ts` writes hash-linked rows; local-fs sink at `services/audit/src/adapters/local-fs-audit-sink.adapter.ts` is wired and tested. |
| Audit chain (production sink) | **DEFERRED** | DynamoDB cross-account sink not implemented. Operator note: requires AWS account + cross-account IAM role. Tracked as SEC-039. |
| Idempotency keys user-bound | **FIXED** | `apps/api/src/common/interceptors/idempotency.interceptor.ts` scopes idempotency keys to the authenticated user. SEC-014. |
| FCRA reason codes on every decline | **IMPLEMENTED** | `services/orchestration` + `services/admin` decline paths emit FCRA-coded reasons. |
| Adverse Action Notice rendering | **IMPLEMENTED** | `services/compliance-doc/src/render/adverse-action-pdf.ts`. |
| JIT PII unmask with dual control | **IMPLEMENTED** | `services/admin/src/admin.service.ts` + `services/admin/src/interceptors/audited-read.interceptor.ts`. |
| TLS 1.2+ | Not auditable from code | Verify Railway certificate policy via the Railway dashboard before testing. |

---

## 2. Honestly-deferred items

These items appear in `SECURITY_AUDIT.md` and the SOC 2 evidence map.
They are listed here so the pen-tester is not surprised to find them.

| Item | Status | Why deferred |
|---|---|---|
| HIBP (Have I Been Pwned) password check | **DEFERRED** | `services/auth` enforces complexity but does not yet block known-breached passwords. SEC-015. Remediation: k-anonymity HIBP API call on every set-password. |
| TOTP enrolment + recovery codes | **DEFERRED** | SMS / email OTP only. SEC-016. Remediation: wire `services/auth` to a TOTP library and add the enrolment screen in `apps/partner-portal`. |
| Production KMS KeyManager | **DEFERRED** | `local-key-manager.adapter.ts` is still registered. Production swap to AWS KMS captured in ADR-0016. |
| Production DynamoDB audit sink | **DEFERRED** | `local-fs-audit-sink.adapter.ts` is the only registered sink. Production swap captured as SEC-039. |
| Step-up MFA for `/me` PII reveal | **DEFERRED** | JIT unmask has dual control but does not require a fresh second factor from the requesting operator. |
| Next.js 14 → 15 upgrade | **DEFERRED** | Partner-portal is on Next.js 14. The 15 upgrade is on the engineering backlog; current 14 release is on the supported maintenance line. |
| `pnpm audit --prod` clean run | **DEFERRED** | 2026-05-15 audit reported 1 critical / 32 high transitive advisories. SEC-041 + SEC-042 track the upgrades; most are awaiting upstream patch releases. |
| Subdomain takeover scan | Out of scope of code | Run `subjack` against `*.eazepay.com` before launch. Cannot be verified from this repository. |

---

## 3. What the tester should do first

The pen-tester should plan to spend roughly half a day on the items
below before turning to authenticated business-logic testing. These are
the surfaces an attacker reaches without credentials.

1. Confirm every response carries the headers in §1 row 1 through 6.
   `curl -I https://<host>/` against the partner-portal root and the
   `/v1/health/live` API endpoint.
2. Hit `/sign-in?from=https://evil.example.com` and confirm the
   redirect is normalised to a same-origin path.
3. Try `/v1/<any-route>` without an `Authorization` header - expect
   `401`. With a clearly-malformed bearer - expect `401`.
4. Exercise the rate limiter: send 10 requests/s to `/v1/auth/login`
   and confirm a `429` response after the burst cap.
5. POST an unsigned webhook to `/v1/webhooks/lenders/<any>` and confirm
   the response is `401` with no side effect.
6. Submit an outbound webhook target of `http://169.254.169.254/`
   (cloud metadata) or `http://10.0.0.1/` and confirm the request is
   rejected at the SSRF guard before any DNS lookup leaves the box.
7. Open `/docs` in production - expect a 404. Open `/docs` in staging
   without basic-auth - expect a 401 challenge.

---

## 4. Coordination

Engineering point of contact: `security@eazepay.com`.
Out-of-band channel for findings during the engagement: signal +
encrypted email per the contract.

Findings should be filed against the SEC-XXX ID scheme from
`SECURITY_AUDIT.md` where the issue area already has a known ID, or as
a new SEC-XXX entry where it does not.
