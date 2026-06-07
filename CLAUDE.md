# EazePay Platform — AI working context

This repo's canonical project docs (single source of truth):

- **[EazePay-Platform.md](./EazePay-Platform.md)** — project overview, architecture, current state, conventions, gotchas. **Read this first.**
- **[EazePay-Platform-PRD.md](./EazePay-Platform-PRD.md)** — full Product Requirements Document (v4.0).

`CLAUDE.md` is intentionally a thin pointer. Put working-context updates in `EazePay-Platform.md` and product/scope updates in `EazePay-Platform-PRD.md` so the two named docs never drift.

**One-line:** EazePay is the agentic financial infrastructure behind vertical brands (MedPay / TradePay / CoachPay / VetPay) — capture (Pixie) → soft-pull (HighSale) → decision engine + lender marketplace → merchant-direct funding. **Current focus:** first real consumer loan end-to-end (target end of July). **Hosting:** Railway (AWS post-launch).
