/**
 * OpenTelemetry SDK bootstrap for the partner-portal Node worker.
 *
 * Imported lazily from `apps/partner-portal/instrumentation.ts` only on
 * the Node runtime (never Edge). Calling `sdk.start()` here patches
 * `http`, `pg`, `ioredis`, `undici`/`fetch` and other supported modules
 * at the require-in-the-middle layer; this MUST happen before any
 * application module imports them, which is why instrumentation.ts is
 * the Next.js-blessed entry point.
 *
 * Behaviour:
 *   • OTEL_EXPORTER_OTLP_ENDPOINT set     → BatchSpanProcessor + OTLP/HTTP
 *     exporter. Honeycomb / SigNoz / Tempo / Jaeger all accept this.
 *   • OTEL_EXPORTER_OTLP_ENDPOINT unset   → SDK does NOT start. The
 *     helpers in lib/observability/tracing.ts return no-op spans, which
 *     means the rest of the app keeps running unchanged. This is the
 *     desired posture for CI + local dev — no collector to point at.
 *
 * We deliberately do NOT fall back to ConsoleSpanExporter the way
 * `apps/api/src/observability/tracing.ts` does, because the partner-portal
 * runs in production today and dumping span JSON to stdout would
 * pollute Railway's log ingest with attributes that include partnerIds.
 * Set OTEL_EXPORTER_OTLP_ENDPOINT to a real collector or accept the
 * no-op posture.
 */

import {
  NodeSDK,
  tracing as otelTracing,
  resources as otelResources,
} from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'eazepay-partner-portal';
const SERVICE_VERSION = process.env.npm_package_version ?? '0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || '';

let started = false;

function start(): void {
  if (started) return;
  started = true;

  if (!OTLP_ENDPOINT) {
    // No exporter configured. We still register a global tracer
    // provider (via NodeSDK default) ONLY if the helpers might create
    // spans — but to avoid background work + the requireInTheMiddle
    // overhead, we simply skip start() here. The global tracer falls
    // back to NoopTracer, `withSpan` becomes a passthrough, and
    // `currentTraceContext()` returns null. Logs lose their traceId
    // but the app continues to function (degradation: 'no distributed
    // traces' — see lib/env.ts RECOMMENDED list).
    //
    // eslint-disable-next-line no-console
    console.info(
      '[otel] OTEL_EXPORTER_OTLP_ENDPOINT unset — distributed tracing disabled (no-op spans). Set the env var to enable.',
    );
    return;
  }

  // Accept both `http://collector:4318` (base) and
  // `http://collector:4318/v1/traces` (already-pathed). Strip any
  // trailing slash and a trailing `/v1/traces` so we end up with a
  // single canonical `${base}/v1/traces`. Mirrors the apps/api behaviour.
  const base = OTLP_ENDPOINT.replace(/\/$/, '').replace(/\/v1\/traces$/, '');
  const exporter = new OTLPTraceExporter({ url: `${base}/v1/traces` });
  const spanProcessor = new otelTracing.BatchSpanProcessor(exporter);

  const resource = new otelResources.Resource({
    'service.name': SERVICE_NAME,
    'service.version': SERVICE_VERSION,
    'deployment.environment': NODE_ENV,
  });

  const sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
    instrumentations: [
      getNodeAutoInstrumentations({
        // `fs` is the noisiest instrumentation by a wide margin — every
        // module require, every JSON read, every static file lookup
        // gets a span. Disable on principle (mirrors apps/api).
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // DNS spans add noise without app-level value (every fetch
        // already gets an HTTP span). Disabled by the same logic.
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Graceful shutdown — flush the BatchSpanProcessor on SIGTERM so the
  // last few seconds of spans are not dropped on a deploy. Railway
  // sends SIGTERM with a 30s grace period before SIGKILL; OTel's
  // BatchSpanProcessor default flush interval is 5s, so 30s is ample.
  const shutdown = (): void => {
    sdk
      .shutdown()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[otel] sdk shutdown failed:', err);
      })
      .finally(() => {
        /* no-op: the process is exiting anyway */
      });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  // eslint-disable-next-line no-console
  console.info(
    `[otel] tracing started — service=${SERVICE_NAME} endpoint=${base}/v1/traces sampler=${process.env.OTEL_TRACES_SAMPLER ?? '(default)'}`,
  );
}

start();
