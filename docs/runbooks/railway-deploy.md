# Deploying the EazePay partner-portal to Railway

One Railway service hosts every public-facing surface (landing pages,
apply flows, lender developer hub) **and** the authenticated partner
portal. From a single deploy URL you can hand prospective merchants
the `/landing/<brand>` page, point partners at `/sign-in`, send
lenders to `/lenders` and `/docs`, and route consumers through
`/apply/<brand>`.

## What ships on this service

| Route                                                                         | Audience                           | Purpose                       |
| ----------------------------------------------------------------------------- | ---------------------------------- | ----------------------------- |
| `/landing/medpay`                                                             | Prospective medical merchants      | Vertical landing page         |
| `/landing/tradepay`                                                           | Prospective trades merchants       | Vertical landing page         |
| `/landing/coachpay`                                                           | Prospective coaching merchants     | Vertical landing page         |
| `/welcome`                                                                    | New merchant                       | Onboarding wizard             |
| `/apply/medpay` `/apply/tradepay` `/apply/coachpay`                           | End consumer                       | Branded apply flow            |
| `/lenders`                                                                    | Prospective lender marketplaces    | Public developer hub          |
| `/docs`                                                                       | Lender integrators                 | API reference + curl examples |
| `/sign-in`                                                                    | Operators + partners               | Auth                          |
| `/v/<brand>/...`                                                              | Authenticated merchant             | Per-brand merchant portal     |
| `/marketplaces` `/onboarding-pipeline` `/lender-marketplace` `/partners` etc. | Master operator                    | Command-centre surfaces       |
| `/api/v1/*`                                                                   | Marketplaces, lenders, integrators | Public API                    |

---

## One-time setup

### 1. Install the Railway CLI

```bash
brew install railway   # macOS
# or:
npm install -g @railway/cli
```

### 2. Authenticate

```bash
railway login
```

A browser tab opens; sign in to your Railway account.

### 3. Create the project

From the repo root (`/Users/Brodie/EazePay App`):

```bash
railway init
```

When prompted:

- **Project name:** `eazepay-platform` (or anything you want)
- **Service:** `partner-portal`
- **Environment:** `production`

### 4. Link the local directory to that project

```bash
railway link
```

Pick the project you just created.

---

## Deploying

### Every subsequent deploy

```bash
railway up
```

Railway uploads the repo, runs the build using the `Dockerfile` at the
repo root, and starts the container. Watch the build log in the
terminal or via `railway logs`.

### Generate a public URL

```bash
railway domain
```

Railway provisions a `<service>-<env>.up.railway.app` URL. Use the
`Custom Domain` flow if you want `app.eazepay.com` instead.

---

## After the first deploy — share these links

Replace `<your-url>` with the Railway-issued domain (or your custom
domain). All of these are **public** unless noted otherwise.

### Send to prospective merchants

```
https://<your-url>/landing/medpay        # dental, med spa, vet, fertility
https://<your-url>/landing/tradepay      # HVAC, roofing, solar, trades
https://<your-url>/landing/coachpay      # high-ticket coaches, courses, DFY
```

### Send to prospective lender marketplaces

```
https://<your-url>/lenders               # public developer hub
https://<your-url>/lenders/lp_buzzpay_prime    # per-lender detail (example)
https://<your-url>/docs                  # API reference + curl examples
```

### Send to a new merchant to onboard (one-time signed link)

```
https://<your-url>/welcome
```

(Generate a signed invite link from the onboarding pipeline at
`/onboarding-pipeline` once you're signed in as Admin.)

### Send to a consumer to apply (public, no auth)

```
https://<your-url>/apply/medpay?ref=<partner-id>
https://<your-url>/apply/tradepay?ref=<partner-id>
https://<your-url>/apply/coachpay?ref=<partner-id>
```

### Internal / authenticated only

```
https://<your-url>/sign-in               # operator + brand-portal login
https://<your-url>/                      # master command centre (after login)
https://<your-url>/marketplaces          # toggle lender marketplaces
https://<your-url>/onboarding-pipeline   # invite + manage new merchants
https://<your-url>/lender-marketplace    # per-lender admin
https://<your-url>/v/medpay              # MedPay portal (single-vertical view)
```

---

## Health check + diagnostics

```bash
# Live logs
railway logs --follow

# Service status
railway status

# Container shell (for debugging — production only when needed)
railway run sh
```

Health check endpoint is `/sign-in` (configured in `railway.toml`).
Returns 200 once the Next.js server is accepting connections.

---

## Env vars (optional but recommended)

The demo runs without any environment variables. For production you'll
want to set these via the Railway dashboard (Variables tab):

| Variable                  | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | Backend BFF URL (defaults to `http://localhost:3300` for local) |
| `NODE_ENV`                | Already set to `production` in the Dockerfile                   |
| `NEXT_TELEMETRY_DISABLED` | Already set to `1` in the Dockerfile                            |

Railway auto-injects `$PORT`; the container respects it.

---

## Build details

- **Builder:** Dockerfile at repo root (3-stage build: deps → builder → runner)
- **Image size:** ~150 MB (Next.js standalone output, not the 1GB+ pnpm store)
- **Build time:** typically 90–120 s on Railway's standard runner
- **Workspace deps:** `@eazepay/ui` and `@eazepay/shared-types` are
  resolved via the monorepo trace root in `next.config.mjs`
- **Health check:** `/sign-in` (200 = ready)
- **Restart policy:** on-failure, 3 retries

---

## Deploying the API

The `@eazepay/api` service is a separate NestJS process. It runs every
public + authenticated REST route under `/v1`, signs outbound webhooks,
and runs scheduled cron jobs on the replica that has `CRON_LEADER=true`.
Splitting it from the partner-portal lets you scale the two workloads
independently and run upgrades on independent cadences.

### Steps

1. **Create a new Railway service** in the same project as the
   partner-portal. From the Railway dashboard click `+ New` → `GitHub
Repo` and pick the same repository. (The CLI alternative is
   `railway init --service eazepay-api` inside the repo.)
2. **Set the Dockerfile path to `Dockerfile.api`.** In the new
   service's Settings → Build, override Dockerfile Path to
   `Dockerfile.api`. The `railway.api.toml` at the repo root encodes
   the same value plus the start command and health check; Railway
   will read it on the next deploy.
3. **Provision Postgres + Redis on the same project.** Click `+ New` →
   `Database` → `Postgres`, then again for Redis. Railway offers both
   as managed add-ons in the same dashboard. No new vendor account is
   needed. Connection strings appear automatically as
   `DATABASE_URL` and `REDIS_URL` once you reference the add-ons from
   the API service's variables.
4. **Set the required env vars.** Open the new service's
   Variables tab and paste from `apps/api/.env.example`. The minimum
   set for a bootable production deploy is `NODE_ENV`,
   `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`,
   `JWT_ISSUER`, `JWT_AUDIENCE`, `LOCAL_KEK_HEX`,
   `CORS_ORIGINS`, `KEY_MANAGER`, and the OTEL endpoint if you have
   one wired up. Everything else has sensible defaults documented
   inline in `apps/api/src/config/env.ts`.
5. **Set `CRON_LEADER=true` on exactly ONE replica.** If you scale to
   N replicas, the leader replica is the single one that fires
   scheduled jobs (webhook retry sweep, audit drain, payment
   collection). Setting it on more than one replica causes duplicate
   dispatches; setting it on zero replicas means no cron fires. Use
   Railway's per-replica variable scoping (or run a 1-replica service
   with `CRON_LEADER=true` and a separate horizontally-scaled
   service with `CRON_LEADER=false` if you want strict separation).
6. **Set `NODE_ENV=production`.** This enforces every production gate
   we ship. Swagger UI is refused, demo mode is disabled, the
   webhook replay window is enforced, the CORS allowlist must be
   explicit (no wildcards), the stack-trace exception filter strips
   stacks from responses, and the helmet security headers ship the
   stricter directives. Setting any other value (or leaving it
   blank) opts back into development-friendly behaviour and is unsafe
   for an internet-facing deploy.
7. **Trigger the first deploy.** From the dashboard, push a commit to
   the tracked branch or click `Deploy`. Watch the build log; the
   three-stage Dockerfile typically completes in 3 to 5 minutes on
   Railway's standard runner. The container is ready once the health
   check at `/v1/health/live` returns 200.

### Health check + diagnostics

- Liveness: `GET /v1/health/live` returns `{ status: 'ok' }`. This is
  the path wired into `railway.api.toml` as `healthcheckPath`.
- Readiness: `GET /v1/health/ready` returns `{ status: 'ok' }`. Wire
  this into a dedicated load-balancer probe if/when you front the
  service with one.
- Logs: `railway logs --follow` against the `eazepay-api` service.

### Restart policy

`restartPolicyType = "ON_FAILURE"`, max 3 retries (same as the
partner-portal service). Railway will surface the crash log if the
process exits non-zero three times in a row.

### Coordinating the two services

| Topic                              | Where it lives                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Public marketing + portal renderer | `partner-portal` service (root `railway.toml` + `Dockerfile`)                                           |
| Public + authenticated REST API    | `eazepay-api` service (`railway.api.toml` + `Dockerfile.api`)                                           |
| Database + Redis                   | Provisioned once per project; both services reference the same add-ons via `DATABASE_URL` / `REDIS_URL` |
| Scheduled jobs                     | Only on the `eazepay-api` replica with `CRON_LEADER=true`                                               |
