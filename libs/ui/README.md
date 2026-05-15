# @eazepay/ui

The platform's design system: tokens, Tailwind preset, and a web component library. Every Next.js app in the workspace consumes this — `partner-portal` heavily — so brand polish is centralised.

## What it exports

- **Tokens** (`@eazepay/ui`) — colour, spacing, radius, elevation, typography. Light + dark variants. Source of truth for the Tailwind preset.
- **Tailwind preset** (`src/styles/tailwind-preset.cjs`) — pulled into every Next.js app's `tailwind.config.cjs`.
- **Global CSS** (`src/styles/globals.css`) — base resets, CSS variables, font setup.
- **Web component library** (`@eazepay/ui/web`):
  - Layout — `AppShell`, `Card`, `CardBody`, `PageHeader`, `PageBody`, `Tabs`, `Stepper`, `Skeleton`, `EmptyState`
  - Data — `DataTable`, `KpiCard`, `Sparkline`, `RouteTimeline`
  - Inputs — `Button`, `Input`, `MaskedField`
  - Surfaces — `Dialog`, `Disclosure`, `DropdownMenu`, `Banner`, `StatusPill`, `Avatar`
  - Identity — `Logo`, `Money`, `CodeBlock`
  - **Icons** — `Icon`, plus a large named-icon set (`ArrowRightIcon`, `DollarIcon`, `XIcon`, `ClockIcon`, `TrendUpIcon`, `TrendDownIcon`, `TrophyIcon`, `RobotIcon`, `SparkIcon`, `CrownIcon`, `UsersIcon`, `ChartIcon`, `ShieldIcon`, `BoltIcon`, `CardIcon`, `PhoneIcon`, etc.)
  - Utility — `cn` (classnames helper)
- **Native bindings** (`@eazepay/ui/native`) — stubbed; reserved for React Native parity.

## Used by

- `apps/partner-portal` (primary consumer — uses the full web surface)
- `apps/consumer-web`, `apps/merchant-dashboard`, `apps/admin-console`
- Bundled via Next.js `outputFileTracingRoot` (see `apps/partner-portal/next.config.mjs`)

## Notes

- Web and native exports are surfaced at deep paths so the right surface ships to the right runtime — `@eazepay/ui/web` for Next.js, `@eazepay/ui/native` for `consumer-mobile`. The bare `@eazepay/ui` re-exports tokens only.
- All web components are typed and Tailwind-class-aware. Apps should consume them rather than re-implementing primitives.
- Brand accent colours are exposed through the `BRANDS` registry in `@eazepay/shared-types`; the UI components read variants by brand where relevant.
