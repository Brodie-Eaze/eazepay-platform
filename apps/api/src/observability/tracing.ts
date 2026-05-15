/**
 * ──────────────────────────────────────────────────────────────────────
 * OpenTelemetry tracing — initialised BEFORE NestFactory.create.
 * ──────────────────────────────────────────────────────────────────────
 *
 * Why initialise here, before Nest:
 *   `@opentelemetry/auto-instrumentations-node` patches modules at
 *   import time (require-in-the-middle hook). If Nest, Prisma, Fastify,
 *   ioredis or http/https are imported before SDK.start(), the
 *   instrumentation hooks miss the module references and spans never
 *   fire. main.ts therefore loads this file FIRST and only then
 *   dynamically imports the rest of the app.
 *
 * Export strategy:
 *   - When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the SDK ships spans
 *     over OTLP/HTTP to the configured collector. Suitable for
 *     SigNoz (self-hosted, free), Honeycomb (managed, free tier),
 *     Grafana Tempo (open source), Jaeger (open source), AWS X-Ray
 *     via OTel collector, etc.
 *   - When unset:
 *       - In development: spans print to stdout via ConsoleSpanExporter
 *         so the developer can see traces locally without standing up
 *         a collector.
 *       - In production / staging: a NoopSpanProcessor is wired
 *         (spans are recorded but never exported). This is
 *         intentional: we never want a misconfigured prod to dump
 *         span JSON to its own logs (would inflate log volume + leak
 *         span attributes through whatever ingest pipe the logger
 *         feeds).
 *
 * Resource attributes:
 *   - `service.name`              — env.OTEL_SERVICE_NAME (default eazepay-api)
 *   - `service.version`           — read from package.json at build time
 *                                   when available, otherwise '0.0.0'.
 *   - `deployment.environment`    — env.NODE_ENV
 *   These match OpenTelemetry semantic conventions; SigNoz / Honeycomb
 *   / Tempo all key dashboards off `service.name` + `deployment.environment`.
 *
 * Auto-instrumentations:
 *   We enable everything the auto package supports EXCEPT `fs` —
 *   filesystem spans dwarf application spans on Node and add cost to
 *   the OTLP transport without proportionate value.
 * ──────────────────────────────────────────────────────────────────────
 */

import {
  NodeSDK,
  tracing as otelTracing,
  resources as otelResources,
} from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | undefined;

export interface StartTracingOptions {
  /** Logical service name; surfaces as `service.name` on every span.
   *  Defaults to env.OTEL_SERVICE_NAME but exposed as a param so we
   *  can override for unit tests. */
  serviceName: string;
  /** Optional OTLP/HTTP endpoint. When undefined + NODE_ENV=development,
   *  spans print to stdout. When undefined + NODE_ENV=production, a
   *  noop processor swallows them (we never want unprivileged log
   *  ingest of raw span data). */
  otlpEndpoint?: string;
  /** Maps to `deployment.environment` resource attribute. */
  nodeEnv: string;
  /** Logical service version. Threaded from main.ts; in CI builds we
   *  set this to the package.json version. */
  serviceVersion?: string;
}

export const startTracing = (options: StartTracingOptions): void => {
  if (sdk) return;

  const { serviceName, otlpEndpoint, nodeEnv, serviceVersion } = options;

  // Resource attributes — keyed off OpenTelemetry semantic conventions
  // so any compliant backend (SigNoz, Honeycomb, Tempo, Jaeger, X-Ray)
  // picks them up without configuration.
  const resource = new otelResources.Resource({
    'service.name': serviceName,
    'service.version': serviceVersion ?? '0.0.0',
    'deployment.environment': nodeEnv,
  });

  // Span processor selection. ConsoleSpanExporter has no `shutdown`
  // network call so it's safe on a quick CTRL-C; the BatchSpanProcessor
  // wrapping the OTLP exporter does, which is why stopTracing() awaits
  // shutdown below.
  let spanProcessor: otelTracing.SpanProcessor;
  if (otlpEndpoint) {
    // Accept both `http://collector:4318` (base) and
    // `http://collector:4318/v1/traces` (already-pathed). Strip any
    // trailing slash and a trailing `/v1/traces` so we end up with a
    // single canonical `${base}/v1/traces`.
    const base = otlpEndpoint.replace(/\/$/, '').replace(/\/v1\/traces$/, '');
    const exporter = new OTLPTraceExporter({
      url: `${base}/v1/traces`,
    });
    spanProcessor = new otelTracing.BatchSpanProcessor(exporter);
  } else if (nodeEnv === 'development') {
    spanProcessor = new otelTracing.SimpleSpanProcessor(new otelTracing.ConsoleSpanExporter());
  } else {
    // Prod/staging with no endpoint — record but don't export. Prefer
    // noop over console to avoid leaking span attributes into stdout
    // log ingest.
    spanProcessor = new otelTracing.NoopSpanProcessor();
  }

  sdk = new NodeSDK({
    resource,
    spanProcessors: [spanProcessor],
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs is the noisiest instrumentation by a wide margin — every
        // module require, every JSON read, every static file lookup
        // gets a span. Disable on principle.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
};

export const stopTracing = async (): Promise<void> => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
};
