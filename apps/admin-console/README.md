# @eazepay/admin-console

EazePay internal operations + compliance console (Next.js 14).

## What it does

The internal-only UI used by EazePay operations, compliance, and risk
teams. Provides queues for application review and decline override
(Reg B / FCRA reason codes, dual-control on amounts ≥ $25k), JIT PII
unmask with second-admin approval and per-read audit, audit log
search, policy edits, processor and lender management, and the
adverse-action notice review surface. Every regulated mutation here
writes an audit row in the same transaction.

## Stack

- Next.js 14 (App Router, React 18)
- Tailwind CSS + `@eazepay/ui`
- Port `3003`
- TypeScript, ESM
- Calls `@eazepay/api` admin endpoints via `@eazepay/api-client`

## Run locally

```bash
pnpm --filter @eazepay/admin-console dev
```

The app starts on `http://localhost:3003`.

## Routes / surface

- `/` — admin home
- `/queue` — application review queue (decline override, dual-control)
- `/audit` — searchable audit log explorer
- `/pii` — JIT PII unmask requests + approvals
- `/compliance` — adverse-action notices, complaint workflow
- `/policies` — risk + decision policy editor
- `/processors` — payment processor configuration
- `/lenders` — lender adapter registry + waterfall ordering
- `/risk` — risk rule + threshold management
- `/settings` — admin team + permissions

## Environment

Copy `.env.example` to `.env.local`. Key vars:

- `NEXT_PUBLIC_API_URL` — base URL of the EazePay API

## Testing

```bash
pnpm --filter @eazepay/admin-console typecheck
```

## Deploy

Internal-only deployment behind SSO + IP allowlist (Vercel + Access,
or self-hosted Next on the internal subnet). Never expose to the
public internet.

## Related

- `@eazepay/api` — admin endpoints under `/v1/admin/*`
- `@eazepay/service-admin` — admin queue, decline override, unmask
- `@eazepay/service-audit` — audit log source
- `@eazepay/service-compliance-doc` — adverse-action notices
- `@eazepay/service-risk` — risk + decision policy
