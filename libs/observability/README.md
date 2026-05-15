# @eazepay/observability

**Status:** Reserved — no implementation yet.

Shared observability setup helpers. Lives as its own lib so every `apps/*` boundary process (api, workers, webhooks, partner-portal server runtime) wires logging, tracing, and metrics the same way without each one re-discovering the Pino + OpenTelemetry boilerplate.

## What it will export (planned)

- `createLogger(opts)` — Pino logger with the standard EazePay redactor (PII paths, secret paths) pre-configured.
- `initTelemetry(opts)` — OpenTelemetry SDK initialisation (resource attributes, exporters, propagators) for Node and Edge runtimes.
- `withSpan(name, fn)` — small wrapper to instrument internal operations without pulling the OTel API into every service.
- `redactProblem(problem)` — Problem-shaped error scrubber, used before logging RFC 7807 responses.
- Standard metric helpers — `recordLenderLatency`, `recordOrchestrationDecision`, `recordAuditOutboxDepth`, etc. (these may move out of this lib into the relevant services once shapes settle).

## Used by

(When implemented) `apps/api`, `apps/workers`, `apps/webhooks`, `apps/partner-portal` server runtime.

## Notes

- Directory + workspace entry only. No `src/` yet.
- Today, each `apps/*` entry-point uses `console.error` for fail-loud bootstrap logging before swapping to Pino — see `apps/api/src/main.ts`, `apps/api/src/config/env.ts`, and equivalents in `apps/workers` and `apps/webhooks`. Those four `console.error` hits are intentional and documented in `HANDOFF.md`.
- PII redaction is the load-bearing requirement (GLBA + Safeguards Rule). Whatever ships here must satisfy `docs/ARCHITECTURE.md` §16.3 / §17.4.
