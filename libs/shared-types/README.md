# @eazepay/shared-types

The single source of truth for the platform's domain primitives. Anything that crosses the wire — between frontends, the BFF, and `@eazepay/service-*` modules — should be typed through here.

## What it exports

- **`Money`** — `BigInt` cents wrapper. All currency math goes through this; never raw `number`. ([ADR-0012](../../docs/adr/0012-money-as-bigint-cents.md))
- **Branded IDs** — `ApplicationId`, `MerchantId`, `ConsumerId`, `OfferId`, `LoanId`, etc. Compile-time safety against ID confusion.
- **Zod primitives** — common validators (`EmailZ`, `PhoneZ`, `IsoDateZ`, `UlidZ`, etc.) consumed by every API boundary.
- **`BRANDS`** — the `BrandCode` registry (`'tradepay' | 'medpay' | 'coachpay' | 'direct'`) plus `BrandSpec` metadata (full name, tagline, verticals, ticket envelope, accent colour, slug). Stored on Merchant, LenderProduct, LenderConnection, and Application rows.

## Used by

Every package in the workspace. Most directly: `apps/api`, `apps/partner-portal`, `apps/consumer-web`, `apps/merchant-dashboard`, `apps/admin-console`, `apps/consumer-mobile`, `apps/workers`, `apps/webhooks`, every `services/*`, and `libs/api-client`.

## Notes

- ESM-only, TypeScript source consumed directly via the workspace `main`/`types` entry (`src/index.ts`).
- No runtime dependencies beyond `zod`.
- Branded-ID helpers do not erase at runtime — the runtime value is still a `string`/`ulid` — but the compile-time check prevents accidentally passing a `MerchantId` where an `ApplicationId` is expected.
- The `BRANDS` registry is the canonical place to add a new vertical. Adding a brand requires (a) extending `BrandCode`, (b) adding a `BrandSpec`, (c) landing the corresponding `/landing/<brand>` page in `apps/partner-portal`, (d) wiring a `/v/<brand>/...` shell, (e) updating the lender marketplace registry.
