# Sidebar Information Architecture — Rationalization (Sprint I)

**Status:** Adopted · **Date:** 2026-05-27 · **Owner:** Brodie

## The problem

The master sidebar grew to **9 top-level groups** containing **24+ items**
with three classes of failure:

1. **Duplication** — every brand application was listed twice
   (Submit Application > MedPay Application _and_ Products > MedPay).
2. **Junk drawer** — "Services" mixed tangential side-businesses
   (EAZE Affiliate, Marketing Consult, Sales Recruitment) with an
   external link to **AMALA Foundation**, which is a different company
   entirely (Amala is Brodie's AU brokerage, not part of EAZEPay).
3. **Overlap** — "Lender Network > Lender Network" and
   "Lender Network > Partner Access" — same job, two doors.
4. **Singular-child groups** — "Pipeline" contained only "Billing".
5. **Mixed audience** — admin-only knobs sat next to partner-facing
   product portals at the same level.

Reference benchmarks: Linear (3 sections), Stripe Dashboard (4),
Notion (3). We were at 9.

## Primary user of the master sidebar

**Brodie the operator** — running EAZEPay daily.

- Partner accounts get `verticalGroups(brand)` (per-brand portal).
- Platform engineering gets `adminGroups` (PR #122).

The master sidebar is the _operator command centre_, not a marketing
site map. Every item should answer "what would Brodie click this morning".

## The new structure — 3 groups, 11 items

```
WORK         the operator's daily queue
  Command Center            /
  Applications              /applications      (all + per-brand entry)
  Pipeline                  /onboarding-pipeline
  Billing                   /invoices
  Reports                   /reports
  Insights                  /insights

NETWORK      relationships the platform brokers
  Partners                  /partners
  Lender Access             /lender-marketplace  (catalog + per-partner access merged)
  Products                  /products            (CoachPay · TradePay · MedPay · EAZE Processing · DialerPay · EZ Check)

TOOLS        set-it-and-forget surfaces
  EAZE AI                   /eaze-ai
  Developer                 /docs                (Docs · Sandbox · API Keys grouped)
  Settings                  /settings
```

Admin items remain in `adminGroups` and only render under `/admin/*` —
they don't bloat the master sidebar. Admin access is offered via the
**More** menu in the topbar when the operator is on a master surface.

## What moved where

| Old location       | Item                                                                  | New home                              | Why                                                    |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| Command Centre     | Command Center                                                        | WORK > Command Center                 | Stays as #1                                            |
| Command Centre     | Control Panel                                                         | More menu                             | Admin-style, used weekly not daily                     |
| Command Centre     | Reports                                                               | WORK > Reports                        | Daily                                                  |
| Command Centre     | Insights                                                              | WORK > Insights                       | Daily                                                  |
| Partners           | Business Onboarding                                                   | WORK > Pipeline                       | "Pipeline" is the verb operators use                   |
| Partners           | Partner Directory                                                     | NETWORK > Partners                    | Relationship surface                                   |
| Pipeline           | Billing                                                               | WORK > Billing                        | Promoted out of singular-child group                   |
| Lender Network     | Lender Network                                                        | NETWORK > Lender Access               | Merged with Partner Access                             |
| Lender Network     | Partner Access                                                        | NETWORK > Lender Access (tab)         | Same surface, different tab                            |
| Submit Application | All Applications                                                      | WORK > Applications                   | The list IS the parent                                 |
| Submit Application | CoachPay Application                                                  | Brand selector on `/applications/new` | One slot, three branded cards                          |
| Submit Application | MedPay Application                                                    | Brand selector on `/applications/new` | Same                                                   |
| Submit Application | TradePay Application                                                  | Brand selector on `/applications/new` | Same                                                   |
| Products           | CoachPay / TradePay / MedPay / EAZE Processing / DialerPay / EZ Check | NETWORK > Products (`/products` hub)  | Single entry point; hub lists all 6                    |
| Services           | EAZE Affiliate                                                        | **Removed**                           | Not a platform feature; lives in More if needed        |
| Services           | Marketing Consult                                                     | **Removed**                           | Same                                                   |
| Services           | Sales Recruitment                                                     | **Removed**                           | Same                                                   |
| Services           | Marketplace                                                           | More menu                             | Low-frequency                                          |
| Services           | AMALA Foundation                                                      | **Killed entirely**                   | Different company (AU brokerage). Never belonged here. |
| Developer          | Documentation / Sandbox / API Keys                                    | TOOLS > Developer (`/docs` hub)       | One slot, hub page lists three                         |
| Account            | EAZE AI                                                               | TOOLS > EAZE AI                       | Promoted — AI is a daily-driver tool                   |
| Account            | Settings                                                              | TOOLS > Settings                      | Single item                                            |

## Rationale for the second-guessable calls

- **Why merge Lender Network + Partner Access into "Lender Access"?**
  Both surfaces answer "which lenders does X see". The catalog is the
  default tab; per-partner override is a tab inside. Cuts a top-level
  click _and_ eliminates the "what's the difference?" question.

- **Why collapse Submit Application into a single `/applications/new`
  page with brand cards?**
  Three sibling links for three brands is a maintenance trap — the
  moment a fourth brand ships, the sidebar bloats again. A
  brand-selector page scales by adding a card, not a nav item.

- **Why collapse Products into a hub page (`/products`)?**
  Six per-product items took 6 sidebar slots while almost every
  operator click landed on the master Command Center or Applications.
  A hub renders the same six surfaces as cards with KPIs; the
  sidebar slot stays lean.

- **Why kill EAZE Affiliate / Marketing Consult / Sales Recruitment
  outright instead of moving to More?**
  None of these have shipped as customer-facing platform features.
  They were placeholder pages. Leaving them in a "More" menu signals
  they're real products. Killing them keeps the IA honest. The route
  files stay (link from More if/when needed).

- **Why "More" menu in topbar instead of "Settings" page?**
  Discoverability. The operator clicks topbar items today
  (BrandSwitcher, NotificationBell, Help). A More dropdown next to them
  inherits the existing scan path.

## Per-brand sidebar (`verticalGroups`)

Same disease, lighter dose. Audit findings:

- "Submit Application" group has 3 items where 2 would do — keep as-is
  for now (Applications list, Submit, Send Link are distinct verbs).
- "Services" group inside the brand portal is junk-drawer-equivalent:
  Eaze Affiliate / Marketing Consult / Sales Recruitment / Marketplace.
  **Action:** Same treatment as master — drop the three placeholders,
  keep only Marketplace. Group is renamed to **Marketplace** with one
  item — but since that's another singular-child group, fold it under
  Account.

## Anti-drift: cmd-K palette stays in sync

The palette (`paletteCommands` in `_shell.tsx`) builds its index from
`masterGroups`, `adminGroups`, and `verticalGroups(brand)`. Restructuring
those arrays automatically refreshes the palette. Items removed from
sidebars are removed from palette too — except the killed Services
routes, which we explicitly _do not_ re-add (they're being deprecated).

## Hard rules preserved

- All `href`s use existing routes — no new server routes.
- `assertNoMasterLeaks` still runs against `verticalGroups`.
- `adminGroups` untouched (PR #122).
