import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * SEC-051 — request-id correlation.
 *
 * Reads incoming `X-Request-Id` if the caller supplied one (typical
 * upstream proxy or BFF behaviour — partner-portal sets one so a
 * support agent can pivot from the user-visible error chip to the
 * server-side log entry). Generates a fresh UUID v4 otherwise.
 *
 * The id is attached to `req.id` so Fastify's pino bindings include
 * it on every log line emitted during the request lifecycle. nestjs-pino
 * inherits the Fastify `reqId` and surfaces it on each log entry —
 * tail a structured log stream and the same id threads every line that
 * came out of one HTTP call.
 *
 * The id is also echoed back as the `X-Request-Id` response header so
 * the caller (and any intermediate proxies) can correlate from their
 * side without parsing the response body.
 *
 * Why a middleware and not just Fastify's built-in `genReqId`:
 *   - Fastify's default ids are sequential ("req-1", "req-2", …),
 *     which means cardinality collides across replicas. UUIDs are
 *     globally unique by construction.
 *   - We want to honour an inbound `X-Request-Id` header for
 *     end-to-end correlation; Fastify's `genReqId` only fires when
 *     there is no inbound id, but it doesn't echo the inbound one as
 *     a response header. This middleware handles both directions
 *     uniformly.
 *   - Middleware runs early enough that nestjs-pino's request-scoped
 *     child logger inherits the id on the very first log line.
 *
 * Sibling integration: {@link ProblemExceptionFilter} ALSO sets the
 * `X-Request-Id` response header on every error response. The values
 * agree (filter reads `req.id`, which this middleware wrote). On
 * success paths, only this middleware sets the header — keep the two
 * call-sites in sync if the header name or generation strategy ever
 * changes. SEE the `instance` field of every Problem+JSON response —
 * the same value appears there for cross-checks.
 *
 * Nest + Fastify middleware signature:
 *   Nest's Fastify adapter routes middleware through @fastify/middie,
 *   which hands middleware raw Node `IncomingMessage` / `ServerResponse`
 *   rather than the Fastify request/reply wrappers. `req.id` is set
 *   on the raw IncomingMessage; Fastify's request layer reads it via
 *   the `kRequestPayloadStream` symbol and propagates to nestjs-pino.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  /** Canonical request-id header name. Lowercase because Node's HTTP
   *  layer normalises incoming header names to lowercase. */
  static readonly HEADER = 'x-request-id';

  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const incoming = req.headers[RequestIdMiddleware.HEADER];
    // Accept only a single string id. Arrays (multi-header) or absent
    // values fall through to a freshly minted UUID. Cap length so a
    // malicious client can't push pathological strings into the log
    // ingest pipe.
    const id =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200
        ? incoming
        : randomUUID();

    // Attach to the request so log emitters (nestjs-pino) and the
    // ProblemExceptionFilter can both read it via `req.id`.
    (req as unknown as { id: string }).id = id;
    // Echo back so the caller / proxy can correlate without parsing
    // the response body.
    res.setHeader('X-Request-Id', id);
    next();
  }
}
