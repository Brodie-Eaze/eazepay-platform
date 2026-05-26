## 2026-05-26 — Platform foundations

- Backend security + compliance hardening: SEC-001 admin auth fence at the edge, demo-cookie HMAC signing, problem-details error envelope, FCRA consent ledger, Reg B reason-code mapping (PR #121)
- Admin surfaces unified under the design system + global cmd-K command palette: control plane, observability, SLO board, audit log all share the same `<PageHeader>` / `<Card>` / `<StatusPill>` chrome (PR #122)
- Taxonomy hygiene + canonical Filter component: every workspace filter row migrated off bespoke `<select>`s onto the shared `Filter` primitive with grouped options + keyboard nav (PR #123)

## 2026-05-12 — MedPay scaffolding

- Vertical configuration surface at `/admin/verticals/medpay`: per-state rate caps, soft-pull provider toggles, monthly amortization preview
- Provisioning queue with BullMQ-backed worker pool — every new merchant flows through provisioning before billing is enabled
- AI funding cutover migration runbook + idempotent cutover worker

## 2026-04-22 — Lender orchestration

- Tiered hybrid waterfall: eligibility-only `/api/v1/orchestration/evaluate` + full route+offers `/api/v1/orchestration/route`
- Lender dossier surface with API-health rollup (healthy / degraded / down / unwired) feeding the observability tiles
- HMAC-verified lender webhook ingestion at `/api/v1/webhooks/lenders/{lender}`, fail-closed in production
