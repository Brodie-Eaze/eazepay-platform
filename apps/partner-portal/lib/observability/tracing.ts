/**
 * OpenTelemetry tracing helpers for the partner-portal BFF.
 *
 * Why this exists
 * ---------------
 * The actually-deployed app is `apps/partner-portal` (Next.js). Until now
 * it had ZERO distributed tracing — only `apps/api` (NestJS) was wired.
 * That meant every webhook dispatch, every outbox drain, every decision
 * engine call, every MiCamp charge happened in the dark: a partner
 * complaint of "the charge took 12 seconds" had no upstream span to
 * point at, and a backed-up BullMQ queue surfaced only as `webhook.queued`
 * counter growth with no trace tying inbox-row → worker pickup → handler
 * latency together.
 *
 * The SDK itself is started in `apps/partner-portal/instrumentation.ts`
 * (Next.js convention — loaded once per worker boot, BEFORE the app
 * graph). This module is the runtime-side surface: thin helpers that
 * route handlers, workers and adapters call directly on the hot path.
 *
 * Surface
 * -------
 *   • `withSpan(name, attributes, fn)` — wraps any async fn in a span,
 *     records exceptions, sets ERROR status on throw, ends the span on
 *     both success + failure. The single primitive for manual
 *     instrumentation on the critical paths (webhook dispatch, outbox
 *     drain, decision-engine call, integration-adapter call).
 *
 *   • `recordError(err, attributes?)` — attaches a structured exception
 *     event to the active span and flips status to ERROR. Useful when
 *     you need to capture an error but rethrow / swallow it intentionally
 *     (e.g. NotImplementedError → terminal-fail).
 *
 *   • `currentTraceContext()` — returns `{ traceId, spanId }` for the
 *     active span (or `null` when no span is active). Used by `safeLog`
 *     to thread traceId into every log line, and by `injectTraceContext`
 *     to propagate context across BullMQ jobs.
 *
 *   • `injectTraceContext(carrier)` / `extractTraceContext(carrier)` —
 *     OTel W3C TraceContext propagation across Redis/BullMQ. Producer
 *     calls inject before `queue.add`, worker calls extract on job
 *     pickup and runs the handler inside the restored context. Mirrors
 *     the pattern the NestJS side already uses for HTTP via the
 *     auto-instrumentation; this is the explicit equivalent for the
 *     queue substrate which has no auto-propagation.
 *
 * Design choices
 * --------------
 *   • Imports from `@opentelemetry/api` ONLY in this file. The SDK
 *     (sdk-node, exporter-trace-otlp-http, auto-instrumentations-node)
 *     is reserved for instrumentation.ts so the runtime hot path never
 *     pulls the heavyweight SDK graph.
 *   • All exports degrade gracefully when no SDK is registered: tracer
 *     returns NoopTracer, spans become no-ops. That means CI + dev
 *     without OTEL_EXPORTER_OTLP_ENDPOINT keep working unchanged —
 *     `withSpan` wraps the fn without observable behaviour change.
 *   • Span attributes are namespaced under `business.*` for app-layer
 *     identifiers (partnerId, applicationId, midId, ...). Provider /
 *     endpoint / status stay under `partner.*` to match the
 *     fetchWithTimeout log vocabulary.
 *
 * What this module deliberately does NOT do
 * -----------------------------------------
 *   • No PII on spans, ever. The deny list in safe-log.ts applies to
 *     log lines; for spans the rule is simpler — only pass bounded
 *     identifiers (ids, slugs, status codes), never raw payloads.
 *   • No metric emission. That's `lib/observability/metrics.ts`.
 *   • No sampler configuration. The sampler is set via env
 *     (OTEL_TRACES_SAMPLER + OTEL_TRACES_SAMPLER_ARG), read by the SDK
 *     in instrumentation.ts. Hard-coding here would lock dev to prod
 *     sample rates and vice versa.
 */

import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type Tracer,
} from '@opentelemetry/api';

const TRACER_NAME = 'eazepay-partner-portal';

let cachedTracer: Tracer | null = null;
function tracer(): Tracer {
  if (!cachedTracer) cachedTracer = trace.getTracer(TRACER_NAME);
  return cachedTracer;
}

/**
 * Wrap an async function in a span. The span is started, the fn is
 * executed inside `context.with(...)` so any nested spans (auto or
 * manual) are correctly parented, and the span is ended in a finally
 * block so a throw still closes it. Exceptions are recorded on the
 * span + status flipped to ERROR before the throw propagates.
 *
 * Usage:
 *   await withSpan('webhook.dispatch', { 'business.provider': 'micamp' }, async () => {
 *     await dispatchEvent(...);
 *   });
 *
 * The return value of `fn` is passed through unchanged.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
  options?: { kind?: SpanKind },
): Promise<T> {
  const span = tracer().startSpan(name, {
    kind: options?.kind ?? SpanKind.INTERNAL,
    attributes,
  });
  const ctx = trace.setSpan(context.active(), span);
  try {
    return await context.with(ctx, () => fn(span));
  } catch (err) {
    recordErrorOnSpan(span, err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Attach a structured error to the currently-active span. No-op when no
 * span is active (e.g. error path outside an instrumented call site).
 *
 * The error message is NOT redacted here — the OTel exporter ships to a
 * trusted backend (Honeycomb / SigNoz / Tempo) over OTLP, not to the
 * generic log sink. If a downstream backend is shared with less-trusted
 * consumers, redact at the call site before invoking this.
 */
export function recordError(err: unknown, attributes?: Attributes): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  recordErrorOnSpan(span, err, attributes);
}

function recordErrorOnSpan(span: Span, err: unknown, attributes?: Attributes): void {
  if (attributes) span.setAttributes(attributes);
  if (err instanceof Error) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  } else {
    span.recordException({ name: 'NonErrorThrown', message: String(err) });
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
  }
}

/**
 * Read the active span's trace + span ids. Returns `null` when no span
 * is currently in context. Used by `safeLog` to thread traceId into
 * every structured log line so a Honeycomb/SigNoz trace can be
 * cross-referenced against the log stream by ID.
 */
export function currentTraceContext(): { traceId: string; spanId: string } | null {
  const span = trace.getActiveSpan();
  if (!span) return null;
  const ctx = span.spanContext();
  if (!ctx.traceId || !ctx.spanId) return null;
  // OTel reports the noop span as traceId='00000000000000000000000000000000'
  // — treat that as "no context" so the log line stays clean.
  if (/^0+$/.test(ctx.traceId)) return null;
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

/**
 * Inject the active OTel context into a carrier object so the
 * downstream consumer (a BullMQ worker, in our case) can restore the
 * parent context and parent its spans correctly.
 *
 * Uses the global propagator, which is W3C TraceContext by default
 * (`traceparent` + `tracestate`). Mutates the carrier in place.
 */
export function injectTraceContext(carrier: Record<string, string>): void {
  propagation.inject(context.active(), carrier);
}

/**
 * Restore an OTel context from a carrier object (typically `job.data`).
 * The returned function runs the provided callback inside the restored
 * context so spans started inside parent to the producer-side span.
 *
 * Usage in a BullMQ worker:
 *   await runWithTraceContext(job.data, async () => {
 *     await withSpan('webhook.process', {...}, () => processInboxRow(id));
 *   });
 */
export async function runWithTraceContext<T>(
  carrier: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!carrier) return fn();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(carrier)) {
    if (typeof v === 'string') headers[k] = v;
  }
  const restored = propagation.extract(context.active(), headers);
  return context.with(restored, fn);
}
