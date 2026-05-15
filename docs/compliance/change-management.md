# Change management policy

> SOC 2 CC8.1 — Changes to infrastructure, data, software, and
> procedures. Owner: Engineering lead. Last reviewed: 2026-05-15.

## PR template requirements

Every PR opened against `main` MUST include:

1. **Ticket reference** — Linear / Jira ID in the title (`EZP-1234:`).
2. **Security checklist** — copy from `.github/PULL_REQUEST_TEMPLATE.md`
   if present; otherwise inline the following 4 items:
   - Touches PII? → confirm PII vault path is used.
   - Touches auth / authz? → confirm SEC-XXX IDs cross-referenced.
   - Adds dependency? → confirm Trivy scan passes (CI gate).
   - Adds new env var? → confirm `apps/api/.env.example` updated +
     `apps/api/src/config/env.ts` validation added.
3. **Breaking-change flag** — explicit `BREAKING:` prefix and migration
   notes in the PR body, or "no breaking change" stated explicitly.
4. **Test coverage** — new code path is exercised by at least one
   integration or unit test in the same PR.

## CI gates (mandatory)

Configured in `.github/workflows/ci.yml`:

- **Format check** (`pnpm format:check`)
- **Lint (affected)** (`pnpm affected:lint`)
- **Typecheck (affected)** (`nx affected -t typecheck`)
- **Test (affected)** (`pnpm affected:test --ci`)
- **Build (affected)** (`pnpm affected:build`)
- **Gitleaks** (secret scan on every commit)
- **Semgrep** (SAST: OWASP top ten, TS, JS, Node, React rulesets)
- **Trivy** (HIGH + CRITICAL severity, ignore-unfixed)

A red CI status blocks merge. There is no admin bypass without a
documented emergency-change record (below).

## Deploy approval policy

- **Production deploy** requires one peer review on the PR before
  merge. Auto-deploy on merge to `main` via Railway is acceptable
  because the peer review IS the approval gate.
- **Database migration** (any change under `apps/api/prisma/migrations/`)
  requires explicit owner sign-off on the PR (Engineering lead or CTO).
  Migrations run as a separate Railway deploy step, fail-fast on error.
- **Env var change in production** requires the same owner sign-off
  because env changes bypass code review entirely.
- **Secret rotation** (KMS KEK, JWT secret, HMAC secrets) requires
  CCO + Engineering lead joint approval and is captured in
  `docs/runbooks/key-rotation.md` once that doc lands.

## Rollback procedure

Two paths, both documented:

1. **`railway redeploy` to previous build** — fastest for code-only
   regression. From Railway dashboard → Service → Deployments →
   prior successful build → Redeploy. No code change required.
2. **`git revert` + push** — preferred when the bad commit can be
   identified and the revert is small. Revert PR follows the same
   CI gates as forward changes.

Rollback for a migration: write a forward migration that undoes the
schema change. Never delete or edit a committed migration file —
Prisma's shadow database compares against the migration history.

## Emergency-change protocol

For SEV1 incidents requiring a code change in <90 minutes:

1. IC declares "emergency change" in `#incident`.
2. IC opens a PR with `EMERGENCY:` prefix; CI must still pass.
3. **Audit log requirement** — within 90 minutes the IC posts the
   commit SHA + a one-paragraph justification in `#incident`.
4. **Post-hoc review within 48 hours** — a non-IC engineer reviews
   the PR retroactively. Findings recorded in the incident
   post-mortem (`docs/runbooks/post-mortems/`).
5. If the post-hoc review finds the change was unnecessary or
   incorrect, a follow-up forward-revert PR is opened immediately.

No emergency-change protocol exists for migrations. Migrations always
follow the standard owner-approval path; if a schema change is needed
under SEV1, the on-call lead approves on the call.
