# Deploying the EazePay partner-portal to Railway

One Railway service hosts every public-facing surface (landing pages,
apply flows, lender developer hub) **and** the authenticated partner
portal. From a single deploy URL you can hand prospective merchants
the `/landing/<brand>` page, point partners at `/sign-in`, send
lenders to `/lenders` and `/docs`, and route consumers through
`/apply/<brand>`.

## What ships on this service

| Route | Audience | Purpose |
|---|---|---|
| `/landing/medpay` | Prospective medical merchants | Vertical landing page |
| `/landing/tradepay` | Prospective trades merchants | Vertical landing page |
| `/landing/coachpay` | Prospective coaching merchants | Vertical landing page |
| `/welcome` | New merchant | Onboarding wizard |
| `/apply/medpay` `/apply/tradepay` `/apply/coachpay` | End consumer | Branded apply flow |
| `/lenders` | Prospective lender marketplaces | Public developer hub |
| `/docs` | Lender integrators | API reference + curl examples |
| `/sign-in` | Operators + partners | Auth |
| `/v/<brand>/...` | Authenticated merchant | Per-brand merchant portal |
| `/marketplaces` `/onboarding-pipeline` `/lender-marketplace` `/partners` etc. | Master operator | Command-centre surfaces |
| `/api/v1/*` | Marketplaces, lenders, integrators | Public API |

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

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend BFF URL (defaults to `http://localhost:3300` for local) |
| `NODE_ENV` | Already set to `production` in the Dockerfile |
| `NEXT_TELEMETRY_DISABLED` | Already set to `1` in the Dockerfile |

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
