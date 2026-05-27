/**
 * Next.js instrumentation hook — initialises OpenTelemetry tracing
 * BEFORE any application module (route handlers, middleware, RSC tree,
 * BullMQ workers) is evaluated.
 *
 * Why this file specifically
 * --------------------------
 * Next.js looks for `instrumentation.ts` (or .js) at the app root and
 * calls its exported `register()` exactly once per worker boot, before
 * the request graph is built. `@opentelemetry/auto-instrumentations-node`
 * patches modules at import time via the require-in-the-middle hook —
 * if `http`, `pg`, `ioredis` or `undici` are imported before
 * `sdk.start()`, the instrumentation hook misses the module references
 * and spans never fire. Registering here is the only place that
 * happens-before guarantee is honoured for both the Next.js HTTP server
 * and the in-process BullMQ workers started by `npm run workers`.
 *
 * Why the dynamic import of './lib/observability/sdk-boot'
 * --------------------------------------------------------
 * Next.js evaluates instrumentation.ts in BOTH the Node.js and the
 * Edge runtimes. The OTel SDK (`@opentelemetry/sdk-node`) depends on
 * Node-only modules (perf_hooks internals, require-in-the-middle). On
 * the Edge runtime that import throws and aborts middleware
 * evaluation, which would break every request. The runtime check below
 * gates the import so only Node workers load the SDK; Edge workers
 * register cleanly as a no-op.
 *
 * Config surface (all via env, no code edits needed per environment)
 * ------------------------------------------------------------------
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — collector URL (Honeycomb / SigNoz /
 *                                  Tempo / Jaeger). Unset = SDK does not
 *                                  start; helpers in lib/observability/
 *                                  tracing.ts degrade to no-op spans
 *                                  (CI + local dev stay clean).
 *   OTEL_SERVICE_NAME            — service.name attribute. Default
 *                                  `eazepay-partner-portal`.
 *   OTEL_TRACES_SAMPLER          — sampler strategy (e.g.
 *                                  `parentbased_traceidratio`).
 *   OTEL_TRACES_SAMPLER_ARG      — ratio for the ratio sampler (1.0 =
 *                                  100%; dial down after the first
 *                                  fortnight of traffic).
 *   OTEL_EXPORTER_OTLP_HEADERS   — k=v,k=v passed straight through to
 *                                  the OTLP exporter (Honeycomb's
 *                                  `x-honeycomb-team` header lives
 *                                  here).
 *
 * The standard `@opentelemetry/sdk-node` already honours every env var
 * above natively — we don't re-parse them. The boot module just
 * constructs the SDK with `getNodeAutoInstrumentations()` (http, fetch,
 * pg, ioredis/bullmq, undici) and calls `sdk.start()`.
 */

export async function register(): Promise<void> {
  // Edge runtime + middleware: no SDK, no auto-instrumentation. The
  // helpers in lib/observability/tracing.ts already degrade to no-op
  // when no provider is registered, so route handlers that run on Edge
  // continue to work; they just don't emit spans.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }
  // Skip during `next build` — there is no traffic to trace, and the
  // SDK's BatchSpanProcessor would queue a flush against a collector
  // that may not exist in CI. The runtime worker re-evaluates this
  // module on cold start, which is where the SDK actually needs to live.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  // Dynamic import so the Edge bundle never even resolves @opentelemetry/sdk-node.
  await import('./lib/observability/sdk-boot');
}
