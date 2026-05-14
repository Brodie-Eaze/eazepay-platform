# @eazepay/consumer-web

EazePay consumer-facing web app (Next.js 14).

## What it does

The hosted apply page and fallback web flow for consumers. This is
the public, no-auth surface a consumer lands on when a merchant
shares an apply link or QR code. Renders brand-scoped landings for
MedPay / TradePay / CoachPay and walks the consumer through identity,
employment, bank-link, and offer acceptance via the BFF.

## Stack

- Next.js 14 (App Router, React 18)
- Tailwind CSS + `@eazepay/ui` design tokens
- Port `3001`
- TypeScript, ESM
- Calls `@eazepay/api` via `@eazepay/api-client`

## Run locally

```bash
pnpm --filter @eazepay/consumer-web dev
```

The app starts on `http://localhost:3001`.

## Routes / surface

- `/` — root landing
- `/medpay` — medical / dental vertical landing
- `/tradepay` — trades / home services vertical landing
- `/coachpay` — high-ticket coaches landing
- `/apply/...` — branded apply flow (multi-step: identity → income →
  bank link → offer → e-sign)

## Environment

Copy `.env.example` to `.env.local`. Key vars:

- `NEXT_PUBLIC_API_URL` — base URL of the EazePay API
  (e.g. `http://localhost:3000` in dev)

## Testing

```bash
pnpm --filter @eazepay/consumer-web typecheck
```

## Deploy

Vercel (preferred) or any Node host that supports Next.js standalone
output. Must point `NEXT_PUBLIC_API_URL` at a reachable
`@eazepay/api` deployment.

## Related

- `@eazepay/api` — BFF + public API consumed via `@eazepay/api-client`
- `@eazepay/ui` — shared design system tokens and components
- `@eazepay/shared-types` — Money / branded-id / Zod primitives
- `apps/partner-portal` — hosts the corresponding internal operator views
