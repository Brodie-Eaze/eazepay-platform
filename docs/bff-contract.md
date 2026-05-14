# EazePay BFF — Frontend Contract

Single-page reference for the endpoints the partner portal (and the
Lovable preview) calls. Every route lives at `${NEXT_PUBLIC_API_URL}/v1`
(default `http://localhost:3300/v1` in dev).

## Auth model

- Browser → Next.js BFF: `credentials: 'include'`, cookies only.
- Next.js BFF → API: `Authorization: Bearer <eazepay_at>` lifted from
  the request's `eazepay_at` cookie.
- Refresh token (`eazepay_rt`) lives in an HttpOnly cookie; renewal flow
  via `POST /v1/auth/refresh` is wired but not yet auto-invoked from the
  BFF — frontend should treat any 401 as "force re-login".

CORS allowlist:
- Exact: `CORS_ORIGINS` (defaults to `localhost:3001..3004`).
- Pattern: `CORS_ORIGIN_PATTERNS` (defaults to `*.lovable.app` and
  `*.lovableproject.com`).

All error responses are RFC 7807 problem details:

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "code": "missing_bearer",
  "instance": "/v1/admin/team"
}
```

Treat `code` as the stable client-facing identifier; `title`/`detail`
are human prose.

---

## Authentication

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/v1/auth/register` | `RegisterDto` | Public. Returns `{ userId, challenge }`. |
| POST | `/v1/auth/login` | `{ identifier, password, remember? }` | Public. Returns `{ mfaRequired, challenge }`. |
| POST | `/v1/auth/verify-otp` | `{ challengeId, code, deviceId }` | Public. Returns `{ tokens, sessionId }`. |
| POST | `/v1/auth/refresh` | `{ refreshToken, deviceId }` | Public. Rotates session, returns new tokens. |
| POST | `/v1/auth/logout` | – | **Authenticated.** Revokes the caller's session. 204 on success. |

The partner portal's `/api/auth/logout` route handler should call this
endpoint and clear the three cookies (`eazepay_at`, `eazepay_rt`,
`eazepay_demo`) regardless of the response.

---

## Team management (Master Command Centre)

All routes under `/v1/admin/*` require **`isAdmin = true`** on the
caller's `User` row (legacy AdminGuard). The role-aware `platformRole`
column drives the partner-portal UI but is not yet a backend authz
fence — that switch lands in a follow-on round.

### `GET /v1/admin/team`

```
Query: ?cursor=<uuid>&limit=<1..200>&filter=all|active|invited|disabled
Response: 200
{
  "members": [
    {
      "id": "uuid",
      "email": "alex@eaze.test",
      "displayName": "Alex Doe",
      "role": "underwriter",
      "status": "active",
      "lastSignInAt": "2026-05-04T18:42:00.000Z",
      "invitedBy": "uuid|null",
      "invitedAt": "2025-12-04T09:00:00.000Z"
    }
  ],
  "nextCursor": "uuid|null"
}
```

### `POST /v1/admin/team`

```
Body: { email, displayName?, role }
  role ∈ master_admin | admin | underwriter | compliance | support | read_only

Response: 201 { "member": TeamMember }
```

Idempotent on email — re-inviting a closed account reactivates the row.

### `PATCH /v1/admin/team/:id`

```
Body: { role?, status?, displayName? }  // at least one
  status ∈ active | invited | disabled

Response: 200 { "member": TeamMember }
```

`status=disabled` revokes all live sessions for the target user.
Self-disable is rejected with `409 cannot_disable_self`.

### `DELETE /v1/admin/team/:id`

```
Response: 200 { "id": "uuid", "status": "closed" }
```

Soft remove. Strips `platformRole`, sets `status=closed`, revokes
sessions. Cannot remove self.

---

## Lender marketplace + per-partner access

### `GET /v1/admin/marketplaces`

Returns connected wholesale marketplaces (engine.tech, in-house, etc.):

```json
[
  {
    "id": "uuid",
    "slug": "engine-tech",
    "legalName": "Engine Technologies, Inc.",
    "displayName": "engine.tech",
    "provider": "engine_tech",
    "status": "active",
    "lenderCount": 24,
    "lastSyncAt": "2026-05-13T12:00:00.000Z",
    "createdAt": "2026-04-01T09:00:00.000Z"
  }
]
```

### `GET /v1/admin/marketplace-lenders`

```
Query (all optional):
  ?marketplaceId=<uuid>
  &brand=medpay|tradepay|coachpay|direct
  &tier=prime_plus|prime|near_prime|sub_prime|no_match
  &enabled=true|false
```

Returns the toggleable lender list. `globallyEnabled=false` means no
partner sees it; `brands=[]` means available to every brand;
`servesTiers` is the routing-fence array orchestration reads on every
application.

### `PATCH /v1/admin/marketplace-lenders/:id`

```
Body (at least one field):
{
  "globallyEnabled": true,
  "servesTiers": ["prime","near_prime"],
  "brands": ["medpay"],
  "minScore": 660,
  "permittedStates": ["TX","FL"]
}
```

Returns the updated row. Audit chain captures before/after.

### `GET /v1/admin/partner-lender-access?merchantId=<uuid>`

Returns one row per `MarketplaceLender` for the given merchant:

```json
[
  {
    "id": "<override-uuid or ''>",
    "merchantId": "uuid",
    "marketplaceLenderId": "uuid",
    "enabled": true,
    "reason": null,
    "changedById": "uuid|null",
    "changedAt": "2026-05-13T12:00:00.000Z",
    "globallyEnabled": true,
    "effectiveEnabled": true,
    "lender": {
      "legalName": "Foo Financial",
      "displayName": "Foo Financial",
      "servesTiers": ["prime","near_prime"]
    }
  }
]
```

`effectiveEnabled` is the value the orchestration engine uses. When
the partner has no override row, `id=""` and the row inherits
`globallyEnabled`.

### `POST /v1/admin/partner-lender-access`

```
Body (mutually exclusive):
{
  "merchantId": "uuid",
  "marketplaceLenderId": "uuid",
  "enabled": true,
  "reason": "optional explanation"
}
— OR —
{
  "merchantId": "uuid",
  "marketplaceLenderId": "uuid",
  "inherit": true
}
```

Returns either the upserted access row or `{ inherited: true }` when
the row was cleared.

---

## Highsale webhook (server-to-server)

```
POST /v1/webhooks/highsale
Headers:
  Content-Type: application/json
  x-eazepay-signature: <hex>     // HMAC-SHA256(HIGHSALE_WEBHOOK_SECRET, rawBody)

Body:
{
  "highsaleRef":   "string",     // Highsale's stable id; unique on snapshot
  "applicationId": "uuid",
  "creditTier":    "prime_plus" | "prime" | "near_prime" | "sub_prime" | "no_match",
  "ficoBand":      "720-739",    // optional
  "inputsHash":    "<sha256 hex>", // optional; computed if absent
  "inquiryAt":     "ISO datetime",
  "expiresAt":     "ISO datetime",
  "payload":       { /* opaque object — tradelines, income bands, etc. */ }
}

Response: 200 { "ok": true, "snapshotId": "uuid", "creditTier": "..." }
```

Effects:
1. Upsert `HighsaleSnapshot` by `highsaleRef` (idempotent on replay).
2. Denormalise `creditTier` onto `Application.creditTier`.
3. Append `highsale.snapshot.scored` to `AuditOutbox` (hash-chained).

Signature failures return `401 invalid_signature`; missing secret
returns `401 webhook_provider_not_configured` (the receiver refuses to
serve traffic without `HIGHSALE_WEBHOOK_SECRET` set).

---

## Environment variables (BFF-relevant)

| Var | Required | Default | Notes |
|---|---|---|---|
| `CORS_ORIGINS` | no | `localhost:3001..3004` | comma-separated exact origins |
| `CORS_ORIGIN_PATTERNS` | no | `^https://.*\.lovable\.app$,^https://.*\.lovableproject\.com$` | comma-separated regex |
| `HIGHSALE_WEBHOOK_SECRET` | yes for receiver | – | min 16 chars; required to serve `/v1/webhooks/highsale` |
| `NEXT_PUBLIC_API_URL` | yes (frontend) | `http://localhost:3300` | absolute base URL for the API |

---

## Smoke-test recipe

```bash
# 1. Boot the API (default port 3300):
cd apps/api && pnpm dev

# 2. Confirm new routes registered:
grep "Mapped " /tmp/api.run.log | grep -E "admin/team|admin/marketplace|admin/partner-lender|auth/logout|highsale"

# 3. Unauthenticated calls should 401 with stable codes:
curl -s http://localhost:3300/v1/admin/team
# → {"code":"missing_bearer", ... 401}

# 4. Highsale webhook positive path (replace APP_ID with a real uuid):
SECRET='test_highsale_secret_16+'
PAYLOAD='{"highsaleRef":"hs1","applicationId":"<APP_ID>","creditTier":"prime","inquiryAt":"2026-05-14T17:00:00.000Z","expiresAt":"2026-05-28T17:00:00.000Z","payload":{}}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -s -X POST -H "Content-Type: application/json" -H "x-eazepay-signature: $SIG" -d "$PAYLOAD" http://localhost:3300/v1/webhooks/highsale
```
