# @eazepay/developer-portal

EazePay lender + integrator developer hub (Next.js 14).

## What it does

The public developer experience for lender marketplaces, partner
banks, and third-party integrators. Hosts the API reference, quick
start, code samples (curl, JS SDK), authentication walkthrough, and
the lender onboarding playbook. Standalone version of the `/lenders`
+ `/docs` routes that also live inside `partner-portal`.

## Stack

- Next.js 14 (App Router, React 18)
- Tailwind CSS + `@eazepay/ui`
- Port `3005`
- TypeScript, ESM

## Run locally

```bash
pnpm --filter @eazepay/developer-portal dev
```

The app starts on `http://localhost:3005`.

## Routes / surface

- `/` — developer hub home: quick start, auth, code samples (curl + JS
  SDK snippets reference an `EAZEPAY_KEY` env var; that's example
  code, not a runtime env requirement of this app)

(Sections beyond `/` will land as the lender onboarding playbook
grows.)

## Environment

No required env vars today. Copy `.env.example` if you want a local
template; the only meaningful value is `NEXT_PUBLIC_API_URL` if and
when this surface gains live API-fetched content.

## Testing

```bash
pnpm --filter @eazepay/developer-portal typecheck
```

## Deploy

Vercel or any Node host with Next.js standalone output. Public —
documents the public API, no auth-gated content lives here.

## Related

- `@eazepay/api` — the API this hub documents
- `@eazepay/ui` — shared design tokens
- `apps/partner-portal` — currently the primary location for these
  surfaces in production (`/lenders` + `/docs`)
