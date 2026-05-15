# Structure audit — 2026-05-15

Result of a repo-wide sweep done during the handoff overhaul. Nothing here is a blocker. None of the items below have been moved automatically; they are flagged for the next engineer to triage.

## Verdict

The repo is well organised. All apps, services, and libs sit where they should. ADRs are numbered and indexed. Runbooks are split correctly (`docs/runbooks/` for app concerns, `infra/runbooks/` for infra). Tests live under `test/` consistently in every `services/*` and `libs/*` package that has any. Root governance files (README, HANDOFF, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG, LICENSE, SECURITY, RAILWAY_DEPLOY) are correctly at root.

## Minor structural smells

### 1. `apps/partner-portal/lib/` contains React components

`lib/` is conventionally for non-component utilities (hooks, data, helpers). Today it holds:

- `lib/ProductOverview.tsx` — a React component
- `lib/SubmitApplicationForm.tsx` — a React component
- `lib/nav.tsx` — JSX-bearing nav definition

Everything else under `lib/` is appropriately non-component (`api-client.ts`, `apply-brands.ts`, `marketplace-data.ts`, `marketplaces-data.ts`, `master-data.ts`, `mock-data.ts`, `onboarding-data.ts`).

**Recommendation:** move `ProductOverview.tsx` and `SubmitApplicationForm.tsx` to `apps/partner-portal/components/`. Decide whether `nav.tsx` stays (it's a config-with-JSX) or moves; if it moves, it joins `components/`. Update import sites — there will be a handful.

**Why not moved:** the rename touches imports across the app and the user said "don't break any code". Engineer call.

### 2. `services/<reserved>/` are folders with READMEs only

The six reserved services (`analytics`, `compliance`, `decision`, `document`, `featureflag`, `integration`) are intentionally empty. Each has a `README.md` explaining that it's reserved. This is fine — it keeps the topology stable so any engineer scanning `services/` sees the full intended decomposition. No action needed; just be aware these folders are placeholders.

### 3. `tools/generators/` and `tools/scripts/` are empty

Both contain only `.gitkeep`. Tracked deliberately so the structure exists when the first generator or script lands. Documented in `tools/README.md`. No action needed.

### 4. `apps/developer-portal/` exists but its live function is served by `partner-portal`

The live lender-developer hub today is `partner-portal`'s `/lenders` and `/docs` routes. `apps/developer-portal/` is a separate Next.js app reserved for the future split. Either keep it as a target home for the eventual extraction, or fold the public routes there now. Engineer call. Documented in the root README + `apps/developer-portal/README.md`.

### 5. `apps/consumer-web/` and `apps/merchant-dashboard/` are functional siblings of partner-portal routes

`consumer-web` mirrors `partner-portal`'s `/apply/<brand>` routes; `merchant-dashboard` mirrors `/v/<brand>/...`. Today both standalone apps run locally but aren't deployed. Decide whether they remain as the "long-term home" once the platform splits, or whether they get retired now that `partner-portal` serves everything. Engineer call.

### 6. ARCHITECTURE.md retains pre-build framing in §11.1 / §10.4 / Context

The doc was originally dated 2026-05-02 and written as a foundation blueprint. The targeted updates in this overhaul:
- Added a "What is built today" delta section at the top.
- Updated §10.4 service decomposition to mark Active (13) vs Reserved (6).
- Updated §11.1 topology to match the executed repo.
- Refreshed the status line.

The rest of the document remains the original blueprint and is still accurate as a blueprint. Future drift should be captured per-ADR, not by editing the blueprint inline.

### 7. Legacy strings noted in `HANDOFF.md`'s sweep section

`HANDOFF.md` previously flagged a `Pixie` reference inside `apps/partner-portal/components/VerticalLandingPage.tsx`, and `EAZE Pay` / `Med Pay` / `Trade Pay` (with spaces) inside `libs/ui/src/web/Icon.tsx`. Those are component-internal strings and code comments respectively — no user-facing copy hits. Tracked for cleanup but not blocking handoff.

## Things that are intentionally not "wrong"

- Root-level Dockerfile + `railway.toml`. Yes, these belong at root because the Railway build context is the whole repo and the Dockerfile builds the `partner-portal` workspace member as the final image — moving them under `apps/partner-portal/` would require relative-path gymnastics in the build context.
- `apps/partner-portal/app/api/v1/*` route handlers. Yes, the partner-portal serves a small public API surface (the mock endpoints for the deployed demo). The real API is `apps/api`. Both exist on purpose.
- `console.error` in four `main.ts` / `env.ts` files. Intentional fail-loud channel before Pino is wired. Documented in HANDOFF.md.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` in `partner-portal`. Documented in HANDOFF.md as legacy errors in unrelated `/api` routes + auth area; flip back to `false` once cleaned up.
