# tools/

Repo-level tooling. Two reserved sub-directories today; both are workspace members so anything dropped in will be picked up by `pnpm` and Nx automatically.

## Layout

| Path | What goes here | Status |
|---|---|---|
| `generators/` | Nx code-generators for repeatable scaffolds (new service module, new web component, new ADR, new lender adapter) | Reserved — `.gitkeep` only |
| `scripts/` | Repo maintenance scripts (one-off migrations, codemods, repo-wide audits, bulk-rename helpers, CI helpers that don't belong in a specific app) | Reserved — `.gitkeep` only |

## When to use what

- **Adding a new `@eazepay/service-*` module** — a generator in `tools/generators/` would scaffold the folder, package.json, project.json, tsconfig, README, and module class. Until that exists, copy an existing reserved service (e.g. `services/analytics/`) and rename.
- **Adding a new ADR** — number it `NNNN-kebab-title.md`, copy `docs/adr/0000-template.md`, and link it from the relevant code. A generator here could automate that.
- **Repo-wide rename / codemod** — write a TypeScript script in `tools/scripts/` and run it via `pnpm tsx tools/scripts/<name>.ts`. Don't commit one-off edits without leaving the script behind.
- **CI helpers** — anything CI-specific that doesn't naturally belong to an `apps/*` or `services/*` build should live here so it can be invoked by `.github/workflows/`.

## Notes

- Both directories are tracked via `.gitkeep` so the topology stays stable even when empty.
- Anything added here is automatically a pnpm workspace member (`pnpm-workspace.yaml` includes `tools/*`). Add a `package.json` if you want isolation.
