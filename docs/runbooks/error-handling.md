# Error handling runbook

> How errors should flow through the EazePay platform — from the
> moment a `throw` happens to the moment an operator sees the alert.
> Owner: Engineering lead. Last reviewed: 2026-05-19.

Pairs with [`observability.md`](./observability.md) (tracing + logging
infrastructure) and [`incident-response.md`](./incident-response.md)
(what to do once an alert fires). This document is the convention
layer in between.

---

## TL;DR — current state vs. target

| Layer                    | Today                                                         | Target                                                           |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/api` (NestJS)      | Pino structured JSON logs + OTLP traces + redact rules        | ✓ Already there                                                  |
| `apps/partner-portal`    | `console.*` to Railway stdout; no metrics; no error reporting | Sentry (or Axiom) + `lib/safe-log.ts` everywhere + `/api/health` |
| Silent `.catch()` blocks | 42 across `apps/partner-portal/` (see audit below)            | Zero. Every catch must log via `safeLog.error` or rethrow.       |
| User-facing error copy   | "Onboarding submission failed. Please try again." (no detail) | Problem-Details JSON + correlation ID + actionable copy          |
| Health probe             | None — Railway's `healthcheckPath: /sign-in`                  | `/api/health` returns `{ db, deps, build_sha, env_ok }`          |

The gap is real but contained: **the failure mode today is silent
failure, not noisy chaos.** Errors disappear into stdout. The
remediation track below is ordered so that the highest-leverage fix
(visibility) ships before deeper refactors.

---

## Conventions for new code

These are the rules anyone writing a new route, API client, or
component should follow. Old code that doesn't follow them yet is
listed in the [audit](#current-audit) below.

### 1. Never swallow an error silently

```ts
// ❌ banned
something().catch(() => {});
something().catch(() => null);
something().catch(() => ({}));
try {
  x();
} catch {}

// ✅ at minimum
something().catch((err) => {
  safeLog.warn({ event: 'partner_portal.something_failed', err });
  return /* sensible fallback */ null;
});

// ✅ if you can't recover, rethrow
try {
  await x();
} catch (err) {
  safeLog.error({ event: 'partner_portal.x_failed', err });
  throw err;
}
```

Why: an empty catch hides the fact that anything went wrong. Future
you, debugging at 3am, has nothing to grep for. `safeLog` exists
exactly so logging is one line — there is no excuse to skip it.

### 2. Use `safeLog`, not raw `console.*`

`apps/partner-portal/lib/safe-log.ts` is the PII-aware logging
primitive (SEC-115). It redacts SSN / DOB / legal name / address /
secrets / tokens before they hit stdout, then dispatches to
`console.*`. When Pino lands in the BFF, the function bodies swap
without breaking call sites.

```ts
import { safeLog } from '@/lib/safe-log';

safeLog.info({ event: 'apply.submit.dispatch', brand, partnerId });
safeLog.warn({ event: 'apply.submit.timeout', durationMs });
safeLog.error({ event: 'apply.submit.failed', err });
```

If you must use `console.*` directly (e.g., inside a React error
boundary where you can't import a server-side module), emit a
structured JSON line:

```ts
console.error(
  JSON.stringify({
    level: 'error',
    event: 'partner_portal.route_error',
    digest: error.digest ?? null,
    msg: error.message,
  }),
);
```

This matches the shape that Sentry / Axiom will expect when the
forwarding pipeline lands.

### 3. Server route handlers: return Problem-Details JSON

For any error returned from an API route, follow the format from
[ADR-0014](../adr/0014-rfc-7807-problem-details.md):

```ts
return NextResponse.json(
  {
    type: 'https://eazepay.com/problems/db-unavailable',
    title: 'Database unavailable',
    status: 503,
    detail: 'The applications data layer is not yet provisioned in this environment.',
    instance: req.headers.get('x-request-id') ?? undefined,
  },
  { status: 503 },
);
```

Concrete reference: `apps/partner-portal/app/api/v/[brand]/applications/route.ts`
returns Problem-Details on 503/400/403.

### 4. Client-side fetch: distinguish failure modes

```ts
try {
  const res = await fetch(url, {
    /* ... */
  });
  if (res.status === 503) return { source: 'fallback', rows: [] };
  if (res.status === 403) return { source: 'forbidden', rows: [] };
  if (!res.ok) {
    safeLog.warn({ event: 'fetch.non_ok', status: res.status });
    return { source: 'fallback', rows: [] };
  }
  return { source: 'live', rows: await res.json() };
} catch (err) {
  // Network error — distinct from a non-OK HTTP response.
  safeLog.error({ event: 'fetch.network', err });
  return { source: 'fallback', rows: [] };
}
```

The pattern is in
`apps/partner-portal/lib/applications-client.ts` — every fetch should
look like that.

### 5. User-facing error copy must be actionable

Generic "Please try again" is the silent-failure UX equivalent of an
empty `.catch()`. When you surface an error to a user, include:

- **What happened**, in plain language
- **What to try next** (refresh, retry, contact support)
- **A correlation ID** they can quote when they email support

```tsx
{
  error && (
    <div role="alert" className="...">
      <p>We couldn't submit your application.</p>
      <p>
        Refresh and try again. If it keeps failing, email{' '}
        <a href="mailto:support@eazepay.com">support@eazepay.com</a> and include this ID:{' '}
        <code>{correlationId}</code>.
      </p>
    </div>
  );
}
```

### 6. Error boundaries are the last line, not the first

Every Next.js route segment already has
`app/error.tsx` + `app/global-error.tsx` as fallbacks. They render a
branded screen and log a structured breadcrumb. **Do not rely on them
to handle expected errors** — they exist to catch the unexpected
ones (uncaught throws, render bugs). Expected errors (validation
failure, 503 from a service) should be caught and surfaced
gracefully at the call site.

---

## Current audit

Run the same audit yourself with:

```bash
grep -rnE "\.catch\(\s*\(\)\s*=>\s*\(?\{\s*\}?\s*\)?\s*\)|\.catch\(\s*\(\s*\)\s*=>\s*null\s*\)|catch\s*\{\s*\}" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  apps/partner-portal/
```

As of 2026-05-19:

- **42 silent catch blocks** in `apps/partner-portal/`.
- **`safe-log.ts` exists but is used in exactly 1 route**
  (`app/api/integrations/brand/apply/route.ts`). Every other route
  uses `console.*` directly or swallows errors.
- **No Sentry / Pino / OpenTelemetry wired** in the BFF. The
  infrastructure is documented in
  [`observability.md`](./observability.md) but only spun up for
  `apps/api`.
- **No `/api/health` endpoint.** Railway's healthcheck points at
  `/sign-in` (per `railway.toml`) — which works as a liveness probe
  but tells you nothing about DB / dep state.
- **Generic error message** on the onboarding wizard:
  _"Onboarding submission failed. Please try again."_ The endpoint
  this posts to (`/api/onboarding/submit`) returns 404 today (no
  handler), and the generic copy hides that completely.

### Files with the worst silent-catch density

| File                                           | Silent catches         |
| ---------------------------------------------- | ---------------------- |
| `app/welcome/page.tsx`                         | (multi-form async ops) |
| `app/welcome/[brand]/page.tsx`                 |                        |
| `app/accept/[brand]/page.tsx`                  |                        |
| `app/invoices/_components/SendDialog.tsx`      |                        |
| `app/onboarding-pipeline/page.tsx`             |                        |
| `app/onboarding-pipeline/[id]/page.tsx`        |                        |
| `app/api/v1/applications/route.ts`             |                        |
| `app/api/v1/applications/[id]/submit/route.ts` |                        |
| `app/api/v1/orchestration/route/route.ts`      |                        |
| `app/api/v1/orchestration/evaluate/route.ts`   |                        |

Most are JSON-body parsing fallbacks (`.catch(() => null)` on a
`req.json()` call), which is arguably fine — the harm is that the
pattern reads identically to "I forgot to handle this error" in
review.

---

## Remediation track (ordered by leverage)

### Phase 1 — Visibility (1–2 days)

Without these, every other fix is invisible. Land these before
attempting any deeper refactor.

1. **Wire Sentry (or Axiom) for `apps/partner-portal`.** Both the
   route-segment and global-error boundaries already emit the right
   structured breadcrumb. Adding a forwarder is one env var + one
   `Sentry.init` call. See `app/error.tsx` and `app/global-error.tsx`
   for the shape the forwarder should consume.
2. **Add `/api/health`** that runs `SELECT 1` against Postgres (when
   `hasDb()`), reports `env_ok` from `lib/env.ts`, and returns
   `build_sha`. Wire Railway's `healthcheckPath` to it.
3. **Promote `safeLog` everywhere.** Mechanical replacement of
   `console.*` → `safeLog.*` across the BFF. Stop at the React
   client components — they keep using `console.*` for now.

### Phase 2 — Eliminate silent catches (3–5 days)

Once errors are visible, walk the list above and replace each
silent catch with the conventions in section 1 above. The
mechanical version is: `.catch(() => null)` → `.catch((err) => { safeLog.warn(...); return null; })`.

This is mostly a find-and-fix sweep. Track it in a single PR per
directory (api routes, page routes, lib helpers) so reviewer
fatigue stays manageable.

### Phase 3 — Problem-Details everywhere (1 week)

Every error response from a Next.js route handler should follow
ADR-0014. Today the new applications endpoints do; the older
`/api/v1/*` orchestration routes don't. The migration is
non-breaking (existing clients ignore unknown fields), but the
benefit only lands when every caller can rely on the shape.

### Phase 4 — User-facing error copy (2–3 days)

Surface correlation IDs in any error UI. Replace generic "Please
try again" with the structured pattern in section 5 above. This is
the lowest-effort UX upgrade with the highest "doesn't feel solid"
impact.

---

## How this ties to other docs

- [`observability.md`](./observability.md) — covers the
  infrastructure for tracing + structured logging on `apps/api`.
  Phase 1 above is the partner-portal equivalent.
- [`incident-response.md`](./incident-response.md) — what to do when
  an alert fires. This runbook is what prevents the alert from
  failing to fire in the first place.
- [`../INVENTORY.md`](../INVENTORY.md) (trust gap **T6**) — the
  audit doc that surfaced the silent-failure / no-observability
  problem.
- [`../adr/0014-rfc-7807-problem-details.md`](../adr/0014-rfc-7807-problem-details.md)
  — the response-shape convention for server errors.
- [`../../apps/partner-portal/lib/safe-log.ts`](../../apps/partner-portal/lib/safe-log.ts)
  — the PII-aware logging primitive.
- [`../../apps/partner-portal/app/error.tsx`](../../apps/partner-portal/app/error.tsx) +
  [`../../apps/partner-portal/app/global-error.tsx`](../../apps/partner-portal/app/global-error.tsx)
  — the error boundaries that the Phase 1 Sentry forwarder will hook
  into.

---

## Conventions are useless without enforcement

Add a lint rule (eslint custom or grep-based pre-commit) that flags:

- `.catch(() => null)`, `.catch(() => {})`, `.catch(() => ({}))`
- Bare `catch {}` blocks
- `console.error` / `console.warn` outside `lib/safe-log.ts`
  and `app/error.tsx` / `app/global-error.tsx` (the only legitimate
  direct callers)

The pre-commit version is two lines in `husky/pre-commit`:

```bash
git diff --cached --diff-filter=AM --name-only -- '*.ts' '*.tsx' \
  | xargs --no-run-if-empty grep -nE "\.catch\(\s*\(\)\s*=>\s*(null|\(?\{\}?\)?)\s*\)" \
  && { echo 'banned silent catch'; exit 1; } || true
```

A real lint rule is the right answer eventually; this is the
two-line stopgap.
