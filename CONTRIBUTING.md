# Contributing to EazePay

A consumer-credit platform earns trust by being **predictable**. Predictable
code, predictable reviews, predictable releases. This guide is the contract
between contributors and the rest of the engineering org.

Read this in full before your first PR. It's short on purpose.

## Repository layout

See [`README.md`](README.md) for the topology and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the blueprint. Module boundaries are enforced by the Nx project graph
and `tsconfig` path aliases — `@eazepay/*` imports are the only legal
cross-package references.

## Prerequisites

- Node `>=20.10.0` (managed via `.nvmrc`)
- `pnpm` `>=9.12.0` (managed via `packageManager` in root `package.json`)
- Docker + Docker Compose (for Postgres, Redis, LocalStack)
- An AWS sandbox account if you need to touch infra

Bootstrap:

```bash
pnpm install
docker compose up -d
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

Full walk-through: [`docs/runbooks/local-development.md`](docs/runbooks/local-development.md).

## Branching

Trunk-based. Feature branches branch from `main`, live no longer than
**two days**, and merge via squash-and-merge.

```
main                  protected; signed commits; linear history
├── feat/<slug>       a single feature, ≤ 400 LOC ideal, ≤ 800 LOC hard cap
├── fix/<slug>        single bug, single PR
└── chore/<slug>      tooling, deps, docs
```

Branch names are **kebab-case**, prefixed with `feat/`, `fix/`, `chore/`,
`docs/`, `perf/`, `refactor/`, `test/`, or `security/`. Commits follow
[Conventional Commits](https://www.conventionalcommits.org).

## Commits

```
<type>(<scope>): <short summary>

<body>

<footer>
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
`chore`, `security`. Scope is the package or service name (e.g.
`service-auth`, `apps/admin-console`).

The commit body is **why**, not what. A reviewer should be able to read
your commit and understand the trade-off you made. Reference the ADR in
the footer when a commit changes architecture: `Refs: docs/adr/0011-...`.

Footer markers:
- `Refs: #123` for issues
- `Closes: #123` for the issue this commit closes
- `BREAKING CHANGE: <description>` for breaking changes (also bump major)

## Pull requests

1. **One concern per PR.** If two scopes show up in the diff, split.
2. **Tests are required** for every code change that runs. Schema/docs
   changes don't need tests; everything else does.
3. **Run locally before pushing.** `pnpm format`, `pnpm lint`,
   `pnpm typecheck`, `pnpm test`, and `pnpm affected:build` must all pass.
4. **CI must be green.** The `validate` and `security` jobs in
   [`.github/workflows/ci.yml`](.github/workflows/ci.yml) are required
   checks.
5. **PR template is mandatory.** Don't delete sections — fill them in.
   Especially the **Security review** and **Data impact** sections.
6. **Codeowners auto-add** — never bypass codeowners with admin merge.
7. **Squash-merge only.** The PR title becomes the merge commit subject.

### Review SLA

| Severity | First response | Merge target |
|---|---|---|
| Hotfix (prod-down or SEV1) | 30 min | Same business day |
| Standard | 1 business day | 2 business days |
| Large / architectural | 2 business days | 5 business days |
| Documentation-only | 2 business days | 5 business days |

### Review focus

Reviewers prioritize, in order:

1. **Correctness** — does it do what it claims?
2. **Safety** — does it leak NPI, mishandle money, or skip an audit?
3. **Tests** — do they actually exercise the change?
4. **Design** — is the boundary right? Will it survive being copied?
5. **Readability** — could a new dev read it in six months?

Style nits go in a single "nits:" comment block at the bottom of the PR.

## Code style

- **TypeScript everywhere.** `strict: true`, no `any`, no implicit `any`,
  no non-null assertions on values that could be null in production.
- **Prefer explicit types** on exported symbols. Internal locals can be
  inferred.
- **Money is `Cents` (BigInt)**. Never `number`. See ADR 0012.
- **IDs are branded.** Use the `ApplicationId`, `MerchantId`,
  `UserId` types from `@eazepay/shared-types` — never a bare `string`.
- **No floating-point currency math.** Period.
- **Zod schemas** at every external boundary. Inputs are parsed once at
  the edge; downstream code receives typed objects.
- **Errors throw, not return.** Use `Problem` (RFC 7807) from
  `@eazepay/shared-utils` so the API filter translates correctly.
- **Side-effecting code is awaited.** No floating promises. The lint
  rule will fail.

## Architecture decisions

Anything that changes a contract between packages, introduces a new
provider, alters a money path, changes a regulatory posture, or
restructures a module **must ship with an ADR**.

Template: [`docs/adr/0000-template.md`](docs/adr/0000-template.md). Numbering
is monotonically increasing. Status moves `Proposed → Accepted → Superseded`.

If you're unsure whether an ADR is needed, write a short one anyway. Half
a page of context next year is worth ten hours of archaeology.

## Tests

- **Unit:** Vitest, co-located with source as `*.spec.ts`. Mock at the
  port; don't mock the package under test.
- **Integration:** Vitest + Testcontainers (real Postgres, real Redis).
  Lives in `test/integration/` per package.
- **Contract:** Pact for every external provider (lender, KYC, payment,
  bureau). Contracts are pinned and reviewed by the provider's team.
- **E2E:** Playwright for web apps; Detox for mobile.
- **Compliance gold-paths:** soft-pull consent, AAN generation, MLA
  covered-borrower gate, SCRA flag, TILA box, state APR cap. These run
  every PR.

Coverage targets are advisory; **untested code in a money or PII path is
not approved**.

## Security

Read [`SECURITY.md`](SECURITY.md). The condensed version:

- **Never log NPI.** The Pino redact pipeline catches common patterns
  but is not your safety net. If you wrote a `console.log(user)`, you
  shipped a bug.
- **PII goes through the vault.** `services/user/src/internal/pii-vault.service.ts`
  is the only seam.
- **Secrets are not in code.** Use Secrets Manager or Parameter Store
  via the workload's IRSA role.
- **No string concatenation into SQL.** Prisma handles it; if you bypass
  Prisma, use `$queryRaw` with parameter binding only.
- **No raw `eval` or `Function()` constructor.** ESLint blocks this.
- **Authenticated routes require both authn + authz.** Don't lean on
  `@Public()` to skip "for now".

If your PR touches money, PII, or audit, expect an extra review from a
codeowner in the regulated-services list.

## Releases

- Releases are cut from `main`. Each release tag bumps either MAJOR
  (breaking), MINOR (new functionality), or PATCH (bug fix), per
  [SemVer](https://semver.org).
- [`CHANGELOG.md`](CHANGELOG.md) is updated **in the same PR as the
  release commit** — never after.
- Migrations are forward-only. Roll forward with a corrective migration;
  do not "down".
- The release runbook is [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md).

## Definition of done

A change is done when:

- [ ] Code merged to `main` via squash
- [ ] CI is green on the merge commit
- [ ] CHANGELOG entry exists for the release
- [ ] Tests cover the new code (unit + integration where applicable)
- [ ] ADR exists if architecture moved
- [ ] Runbook updated if operational surface moved
- [ ] Observability shipped (logs / metrics / traces named correctly)
- [ ] Codeowner from the affected scope approved
- [ ] No security or compliance gold-path regressed

## Getting help

- `#engineering` for general questions
- `#security` for anything PII / money / audit
- `#oncall` for production-impacting issues (page the on-call via
  PagerDuty)
- `engineering-leadership@` for escalation paths

Welcome to the team.
