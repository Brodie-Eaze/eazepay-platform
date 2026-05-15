# @eazepay/partner-portal

EazePay partner + operator portal (Next.js 14) — **the app deployed to Railway**.

## What it does

A single Next.js service that hosts every public-facing surface
(brand landings, consumer apply flows, public lender developer hub)
**and** the authenticated partner / operator portal. From one deploy
URL you can hand prospective merchants the `/landing/<brand>` page,
point lenders to `/lenders` and `/docs`, route consumers through
`/apply/<brand>`, and let internal operators sign in to run the
business at `/insights`, `/applications`, `/onboarding-pipeline`,
etc. Today this is the _primary_ hosted experience for the platform.

Currently deployed to:
**https://eazepay-platform-production.up.railway.app**

## Stack

- Next.js 14 (App Router, React 18) — `output: 'standalone'` for Docker
- Tailwind CSS + `@eazepay/ui`
- Port `3004` (Railway injects `$PORT` and the container respects it)
- Edge middleware (`middleware.ts`) for auth + brand-routing gates
- `@tanstack/react-query` for data fetching
- TypeScript, ESM
- Calls `@eazepay/api` via `@eazepay/api-client`

## Run locally

```bash
pnpm --filter @eazepay/partner-portal dev
```

The app starts on `http://localhost:3004`. Browse the landing pages
without any backend running:

- http://localhost:3004/landing/medpay
- http://localhost:3004/landing/tradepay
- http://localhost:3004/landing/coachpay

## URL conventions

| Pattern                                                                                                                                                                | Audience                                 | Purpose                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `/landing/{medpay\|tradepay\|coachpay}`                                                                                                                                | Prospective merchants                    | Public marketing landings                        |
| `/apply/{brand}`                                                                                                                                                       | End consumers                            | Branded consumer apply flow                      |
| `/v/{brand}/...`                                                                                                                                                       | Authenticated merchants                  | Per-brand merchant portal (single-vertical view) |
| `/lenders`, `/lenders/[id]`                                                                                                                                            | Prospective lender marketplaces          | Public developer hub                             |
| `/docs`                                                                                                                                                                | Lender integrators                       | API reference + curl examples                    |
| `/sign-in`                                                                                                                                                             | Operators + partners                     | Auth                                             |
| `/welcome`, `/onboarding/*`, `/onboarding-pipeline`                                                                                                                    | New merchants + the team onboarding them | Onboarding wizard + pipeline                     |
| `/insights`, `/applications`, `/partners`, `/lender-marketplace`, `/marketplaces`, `/payouts`, `/settlements`, `/disputes`, `/queues`, `/reports`, `/events`, `/admin` | Master operator                          | Command-centre surfaces                          |
| `/api/v1/*`                                                                                                                                                            | Marketplaces, lenders, integrators       | Public API (Next.js route handlers)              |

## Environment

Copy `.env.example` to `.env.local`. Key vars:

- `NEXT_PUBLIC_API_URL` — base URL of the EazePay API
  (e.g. `http://localhost:3000` in dev)
- `NEXT_PUBLIC_BFF_ROOT` — BFF root used by API-client when distinct
  from `NEXT_PUBLIC_API_URL`
- `NODE_ENV` — set to `production` automatically by the Dockerfile
- `NEXT_TELEMETRY_DISABLED` — set to `1` automatically by the Dockerfile
- `PORT` — Railway injects this; the container respects it

The demo runs without any environment variables — landing pages and
the operator UI are statically renderable with mock data.

## Testing

```bash
pnpm --filter @eazepay/partner-portal typecheck
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true` /
`eslint.ignoreDuringBuilds: true` so legacy errors in unrelated files
don't fail the Railway build. Run `tsc --noEmit` locally to surface
them.

## Deploy

**Railway.** Single service named `partner-portal` in the
`eazepay-platform` project. The repo-root `Dockerfile` is a 3-stage
build (deps → builder → runner) and produces the Next.js standalone
output (~150 MB image). See [`docs/runbooks/railway-deploy.md`](../../docs/runbooks/railway-deploy.md)
for the full deploy recipe.

```bash
railway up                 # deploy
railway logs --follow      # tail logs
railway domain             # provision a public URL
```

Health check endpoint: `/sign-in` (200 once Next.js is ready).

## Related

- `@eazepay/api` — backend BFF + public API
- `@eazepay/ui`, `@eazepay/shared-types` — workspace deps bundled via
  Next.js `outputFileTracingRoot`
- `apps/consumer-web` — the standalone consumer apply experience
  (functional sibling to `/apply/<brand>` here)
- `apps/merchant-dashboard` — the standalone merchant portal
  (functional sibling to `/v/<brand>/...` here)
- The lender developer hub at `/lenders` + `/docs` is hosted inside
  this app today (no separate developer-portal app).
