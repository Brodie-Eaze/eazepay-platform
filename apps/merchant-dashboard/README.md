# @eazepay/merchant-dashboard

EazePay merchant operator UI (Next.js 14).

## What it does

The signed-in surface a merchant uses day to day. Lists applications,
shows transaction history, manages settlements, surfaces disputes,
provides team + API-key management, and exposes the merchant-side
webhook config and analytics. Currently uses BFF endpoints on
`@eazepay/api` for every request.

## Stack

- Next.js 14 (App Router, React 18)
- Tailwind CSS + `@eazepay/ui`
- Port `3002`
- Edge middleware (`middleware.ts`) for auth gating
- TypeScript, ESM
- Calls `@eazepay/api` via `@eazepay/api-client`

## Run locally

```bash
pnpm --filter @eazepay/merchant-dashboard dev
```

The app starts on `http://localhost:3002`.

## Routes / surface

- `/` — merchant home / activity overview
- `/applications` — application queue + detail
- `/transactions` — debit / repayment history
- `/settlements` — daily settlement statements
- `/disputes` — dispute workflow
- `/links` — generate consumer apply links + QR
- `/webhooks` — endpoint management
- `/api-keys` — key issuance
- `/team` — invites, RBAC
- `/analytics` — funnel + cohort views
- `/settings` — merchant profile

## Environment

Copy `.env.example` to `.env.local`. Key vars:

- `NEXT_PUBLIC_API_URL` — base URL of the EazePay API

## Testing

```bash
pnpm --filter @eazepay/merchant-dashboard typecheck
```

## Deploy

Vercel or any Node host with Next.js standalone output. Point
`NEXT_PUBLIC_API_URL` at a reachable `@eazepay/api`.

## Related

- `@eazepay/api` — BFF + public API
- `@eazepay/ui` — shared design tokens and components
- `@eazepay/service-merchant` — backing service for KYB + BO + links
- `apps/partner-portal` — hosts the brand-scoped (`/v/<brand>/...`) variant of this UI today
