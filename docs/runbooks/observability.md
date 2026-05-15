# Observability runbook

> How to wire up tracing + structured logging for EazePay.
> Owner: Engineering lead. Last reviewed: 2026-05-15.

## What ships from the app

- **OTLP traces** — `apps/api/src/tracing.ts` initialises the OTEL SDK
  on boot. It exports OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Structured JSON logs** — Pino on stdout. Each log line is a single
  JSON object with `level`, `time`, `msg`, `traceId` (when in a span),
  and the redact rules from `apps/api/src/app/app.module.ts`.
- **Metrics** — NOT WIRED YET. This is a documented gap; see
  `docs/SOC2_EVIDENCE_MAP.md` and the metrics section below.

## Required environment variables

Defined in `apps/api/.env.example`. Production must set
`OTEL_EXPORTER_OTLP_ENDPOINT` to a reachable collector.

| Var                           | Default                           | Purpose                           |
| ----------------------------- | --------------------------------- | --------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP/HTTP collector URL           |
| `OTEL_SERVICE_NAME`           | `eazepay-api`                     | `service.name` resource attribute |
| `OTEL_TRACES_SAMPLER`         | `parentbased_traceidratio`        | Sampler                           |
| `OTEL_TRACES_SAMPLER_ARG`     | `0.1`                             | 10% sample rate                   |
| `LOG_LEVEL`                   | `info` (prod), `debug` (dev)      | Pino log level                    |

## Backend options (pick one)

### Option A — Honeycomb (recommended for fastest setup, free tier)

3 steps:

1. Create a free account at https://honeycomb.io. Create an environment
   `eazepay-prod`. Copy the API key.
2. Set Railway env vars:
   - `OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io`
   - `OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=<your-api-key>`
3. Redeploy. Spans appear in the Honeycomb UI within a minute.

Free tier: 20M events / month. Sufficient for current traffic at 10%
sample rate.

### Option B — Grafana Tempo (free OSS, self-hosted)

5 steps:

1. Provision a small VM (Hetzner CX11 ~€4/mo, or Hetzner cloud
   anywhere). Open ports 4318 (OTLP/HTTP) and 3000 (Grafana UI).
2. Run `tempo` + `grafana` via docker-compose
   (`grafana/tempo:latest` + `grafana/grafana:latest`).
3. Configure Tempo's `receivers.otlp.protocols.http` on `0.0.0.0:4318`.
4. In Grafana, add Tempo as a data source pointing at
   `http://tempo:3200`.
5. Set Railway `OTEL_EXPORTER_OTLP_ENDPOINT=http://<vm>:4318/v1/traces`.

Cost: ~€4/mo for the VM. Tempo + Grafana are free.

### Option C — SigNoz self-hosted (only paid option)

5 steps (Hetzner $5/mo VM is the only meaningful cost):

1. Provision a Hetzner CX21 ($5/mo). 4 GB RAM is the floor for SigNoz.
2. `git clone https://github.com/SigNoz/signoz && cd signoz/deploy &&
docker compose up -d` (production-grade compose lives in their
   `deploy/docker` directory).
3. Open ports 3301 (UI), 4318 (OTLP/HTTP), 4317 (OTLP/gRPC).
4. Set Railway `OTEL_EXPORTER_OTLP_ENDPOINT=http://<vm>:4318/v1/traces`.
5. Log in to SigNoz UI at port 3301, set up service dashboards for
   `eazepay-api`.

SigNoz gives you traces + metrics + logs in one pane, which is the
"all-in-one" advantage over A or B.

## Key spans to know

The API instruments these spans explicitly. Each emits a
`service.name=eazepay-api` resource attribute plus span-specific
attributes.

| Span name                | Attributes                                                                 | When it fires                   |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------- |
| `auth.login`             | `auth.provider`, `auth.outcome`, `auth.mfa_required`                       | Every login attempt             |
| `auth.refresh`           | `auth.session_id` (hashed)                                                 | Refresh-token rotation          |
| `application.submit`     | `application.id`, `application.source`, `application.consumer_id` (hashed) | Submit-application route        |
| `orchestration.evaluate` | `policy.version`, `policy.outcome`, `lenders.shortlisted`                  | Inside submit; per evaluation   |
| `webhook.dispatch`       | `endpoint.id`, `delivery.attempt`, `delivery.outcome`                      | Every outbound dispatch attempt |
| `webhook.receive`        | `source`, `hmac.valid`, `replay.fresh`                                     | Every inbound webhook           |
| `audit.drain`            | `batch.size`, `chain.head_hash` (truncated)                                | Audit-outbox drain tick         |
| `pii.reveal`             | `actor.id`, `subject.id`, `dual_control.approved`                          | Every PII reveal                |

## How to read a trace

1. Find the request in your backend by `service.name=eazepay-api`.
2. Filter by route (`http.route=/v1/applications`) or by user id
   (`enduser.id`).
3. Drill into the root span → child spans show the dependency tree:
   route → service method → database calls → outbound HTTP.
4. Span attributes carry the audit context (`actor.id`, `application.id`)
   so you can pivot back to the audit log.

## Metrics gap (documented)

The platform does not emit dimensional metrics today. Latency and
throughput are derived from trace spans in the backend. Counters and
gauges (queue depth, dead-letter rate) live in Postgres tables and
are read by ad-hoc SQL.

Action: wire OpenTelemetry Metrics SDK to the same OTLP endpoint when
the team scales beyond two backends. Tracked under Engineering's
observability backlog.
