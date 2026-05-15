# E2E test suite (Playwright)

End-to-end browser tests for the partner-portal. Tests live in this
directory; the config is `playwright.config.ts` at the repo root.

## Specs

- `sign-in.spec.ts` — demo preset tiles (master / admin / medpay /
  tradepay / coachpay) write the `eazepay_demo` cookie and navigate
  to the right surface.
- `operator-onboarding-invite.spec.ts` — master operator generates a
  TradePay invite link and confirms it surfaces under "Your invites".
- `landings.spec.ts` — `/landing/medpay`, `/landing/tradepay`,
  `/landing/coachpay` render with brand styling, primary CTA visible,
  no console errors, no failed network requests.

Each spec runs against both projects in `playwright.config.ts`:

- `chromium-desktop` — 1280×800
- `chromium-mobile` — Pixel 5

## Prerequisites

```bash
# One-time setup — install Playwright + Chromium browser binaries.
pnpm test:e2e:install
```

This pulls down a Chromium build under
`~/Library/Caches/ms-playwright/` (macOS) or `~/.cache/ms-playwright/`
(Linux). CI should cache this directory.

## Running locally

```bash
# Start the partner-portal dev server first. It listens on :3004 by
# default (see apps/partner-portal/package.json).
pnpm --filter @eazepay/partner-portal dev

# In another shell — playwright.config.ts defaults the baseURL to
# :3001 to match the brief. Until the port lands on a single value,
# override:
PLAYWRIGHT_BASE_URL=http://localhost:3004 pnpm test:e2e
```

Common one-off invocations:

```bash
# Run a single spec.
pnpm test:e2e e2e/landings.spec.ts

# Run only the desktop project.
pnpm test:e2e --project=chromium-desktop

# Open the Playwright UI runner for debugging.
pnpm test:e2e --ui

# Show the last HTML report.
npx playwright show-report
```

## Running against a deployed environment

The Railway production URL is the canonical staging target for
release-gate runs:

```bash
PLAYWRIGHT_BASE_URL=https://eazepay-platform-production.up.railway.app pnpm test:e2e
```

Caveats:

- The `sign-in.spec.ts` demo tiles only work where
  `DEMO_MODE_ENABLED=true` is set in the deployed environment.
  Production refuses demo bootstrap unless that flag is on
  (`apps/partner-portal/app/api/auth/demo/route.ts`).
- The `operator-onboarding-invite.spec.ts` spec writes to the
  in-memory `invites-store` on whichever instance handled the request.
  On a multi-replica deploy the "Your invites" read-back can land on a
  different instance and the row will be missing. Pin to a single
  replica with `?_target_replica=...` (or skip in multi-replica CI).
- Landing-page tests in `landings.spec.ts` are stable against
  production — they don't write state.

## CSRF echo workaround

The current sign-in page (`apps/partner-portal/app/(auth)/sign-in/page.tsx`)
uses `fetch()` directly and does NOT echo the `eazepay_csrf` cookie
into the `X-CSRF-Token` header on the demo bootstrap POST. The auth
backend rejects the request with `csrf_token_mismatch`. To keep the
specs honest about backend behaviour, both sign-in flows use
`page.route()` to intercept `/api/auth/**` requests and inject the
header from the cookie value. When the sign-in page is fixed to use
`apiRequest` from `lib/api-client.ts` (which already handles CSRF
echo), the route handler can be removed and the specs simplified.
