# Changelog

All notable changes to EazePay are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry is grouped by version. Within a version, changes are grouped
into the following sections, in this order:

- **Added** — new features
- **Changed** — non-breaking improvements
- **Deprecated** — soon-to-be-removed features
- **Removed** — features removed in this version
- **Fixed** — bug fixes
- **Security** — anything that closes a vulnerability or hardens the
  platform; always called out separately so security teams can audit
  in a single pass

## [Unreleased]

### Added
- Master Command Centre with cross-vertical KPI grid, Monthly Submissions
  + Funded Volume + Credit Insights charts, and Partner Leaderboard.
- Per-vertical Partner Portals at `/v/{tradepay,medpay,coachpay}` with
  brand-filtered Dashboard / Applications / Partners views and a back-link
  to the Command Centre.
- Brand switcher in the global topbar — single control to flip between the
  Master Command Centre and any vertical portal.
- Multi-product brand registry in `@eazepay/shared-types/brands`
  (TradePay / MedPay / CoachPay / Direct).
- Submit Application forms per vertical (`/submit/{coach,med,trade}-pay`)
  driven by a shared, brand-parameterised template.
- Integration overview pages for DialerPay, EZ Check (HighSale-backed),
  EAZE Pay, and EAZE Trade Pay.
- Master pages: Control Panel, All Applications, Payouts, Reports,
  Partner Directory, Merchant Approvals, Marketplace Listings.
- Onboarding wizard at `/onboarding` (Business → Financial profile →
  Products → KYB → Agreement → Issue keys).
- Sign-in page with brand-preset demo workspaces.
- Lender Route Inspector timeline component in the shared design system,
  used by both Admin and Partner application-detail pages.
- MiCamp card-processor and HighSale EZ Check-processor wiring across
  admin, merchant, consumer apply, and developer portal.
- Polished web UI library at `libs/ui/src/web/`: `AppShell`, `KpiCard`,
  `DataTable`, `Sparkline`, `BarChart`, `RouteTimeline`, `Stepper`,
  `MaskedField`, `DisclosurePanel`, `Money`, `Apr`, `CodeBlock`, plus a
  brand-aware token system.
- Tailwind preset shared across all Next.js apps
  (`@eazepay/ui/tailwind-preset`).
- Auth gating layer in the Partner Portal that bypasses the AppShell for
  `/sign-in` and `/onboarding` routes.
- LenderConnection Prisma model + per-connection healthcheck log,
  envelope-encrypted credential vault, and admin REST surface for
  plugging in lender API keys.

### Changed
- Repository governance hardened for SOC 2 readiness: `SECURITY.md`,
  `CONTRIBUTING.md`, `LICENSE`, `CHANGELOG.md`, expanded ADR set, and
  controls mapping under `docs/soc2/`.
- Partner-portal sidebar regrouped into **Master** / **Submit
  Application** / **Integrations** / **Settings** to match how the
  business actually operates.

### Security
- Application-layer envelope encryption for all PII columns; per-row
  AAD; deterministic AES-SIV for searchable fields with a per-tenant
  pepper.
- Just-in-time PII unmask flow with dual-control approval, 30-minute
  grant expiry, and per-read audit entries.
- Hash-chained immutable audit log via transactional outbox; reproducible
  decision pack per application.
- Request-scoped `request_id`, idempotency on every write, RFC 7807
  problem details on every error.

---

## [0.1.0] - 2026-05-04

Initial scaffold. End-to-end signup → KYC → application → orchestration
→ offer accept → e-sign → fund → repayment, with mock providers wired,
running locally with `pnpm dev` plus `docker compose up`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the blueprint this
release implements.
