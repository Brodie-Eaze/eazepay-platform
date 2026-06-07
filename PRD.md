# EazePay Platform — PRD

> **Canonical short-form PRD.** Full detail in [`EazePay-Platform-PRD.md`](./EazePay-Platform-PRD.md).

---

## Problem statement

Healthcare providers, trade businesses, coaching brands, and veterinary practices need consumer financing at point of sale, but they can't access lender marketplaces directly — the compliance overhead is too high and the integration work is out of reach. Existing platforms (Skeps, ChargeAfter, GreenSky) are expensive, opaque, and don't give merchants real-time visibility into their pipeline.

## Target user

**Primary:** Merchant / practice owner (MedPay, TradePay, CoachPay, VetPay) — needs to offer consumer financing in a single link or QR code, see application status in real time, and get funded directly without chasing lenders.

**Secondary:** Lenders — need a qualified, pre-enriched application pool they didn't have to generate themselves.

**Internal (EazePay ops):** Brodie / Sam / eng — needs the admin command centre, investor metrics, and compliance controls.

## Core features

| Feature                                                                         | Status                              |
| ------------------------------------------------------------------------------- | ----------------------------------- |
| Pixie — lead-capture form with HighSale soft-pull enrichment + smart routing    | Built                               |
| Decision engine — waterfall, propensity scoring, FCRA §615 + Reg B reason codes | Built (on `fix/soc2-p0-security`)   |
| Lender marketplace — ranked parallel offers, merchant-direct payout             | Built (no live lender adapters yet) |
| Partner portal — per-brand dashboard, send-link, submit-app, insights, tracking | Built                               |
| Admin command centre — all applications, lender panel, control panel, audit log | Built                               |
| Vertical brands — MedPay (live), TradePay / CoachPay / VetPay (built, off)      | MedPay live                         |
| Investor dashboard — platform-wide revenue + ad-spend + leads + sales           | Gap                                 |

## Success metrics

- **Activation:** first real consumer completes a loan end-to-end on staging (apply → offers → sign → funded)
- **Revenue bridge:** first dollar through Magwitch aggregator (Track A)
- **Moat:** US Bank / Covered Care direct adapter live + security review passed (Track B)
- **Scale:** 10 active merchant partners, $100k+ in monthly funded volume
- **Platform:** SOC 2 Type II observation window started

## Current status

**Branch:** `fix/soc2-p0-security` (all real code — `origin/main` is near-empty "Initial commit").
**Ship-readiness:** ~82/100. P0 security findings closed. Field-level PII encryption and lender webhook fail-closed verification are the remaining hard blockers before real money moves.
**Live:** MedPay partner portal + admin command centre at `eazepay-platform-production.up.railway.app`.
**Not live:** any real lender adapter, investor dashboard, merchant onboarding in prod.

## Next milestone

**"First Real Loan"** — target end of July 2026.

1. Wire Magwitch adapter (Track A) — fastest path to real funded loan
2. Close webhook signature fail-closed + PII field-level encryption — hard blockers for compliance
3. Get US Bank security vendor review started (Track B) — long-pole, start immediately
4. Merchant login with real Clerk auth in prod (not demo mode)
5. Investor dashboard — add platform-wide rollup to reporting endpoints (David's ask)
