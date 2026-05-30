/**
 * fetchWithTimeout — outbound partner-call wrapper.
 *
 * Every direct `fetch(...)` against a partner API in this codebase is
 * required to go through this helper. Without an AbortSignal a hung
 * partner pins the Next.js worker indefinitely — Node fetch has no
 * default timeout. On the money path (`MiCamp.charge`) that's a
 * worker-pool-exhaustion outage waiting to happen.
 *
 * Contract:
 *   • AbortSignal.timeout(timeoutMs) is wired on EVERY call.
 *   • An AbortError (timeout) is logged with `event:'integration.timeout'`
 *     and rethrown as a structured `IntegrationTimeoutError` so callers
 *     and the orchestrator can distinguish a hung partner from a 5xx.
 *   • Other errors propagate unchanged.
 *
 * Suggested timeouts (callers always pass an explicit override):
 *   • 5_000ms  → money / quick state-change (charge, runPrequal)
 *   • 10_000ms → bulk-ish data (settlement report)
 *   • 30_000ms → known-slow provisioning (provisionMid, createSubAccount)
 *
 * NEVER call `fetch` directly to a partner from anywhere else. The
 * adapter-pattern boundary is: client.ts wraps fetchWithTimeout, app
 * code goes through the client.
 */

import { safeLog } from '../safe-log';

export const DEFAULT_QUERY_TIMEOUT_MS = 5_000;
export const DEFAULT_BULK_TIMEOUT_MS = 10_000;
export const DEFAULT_PROVISIONING_TIMEOUT_MS = 30_000;

export interface FetchWithTimeoutOptions {
  /** Hard ceiling — wraps the request in AbortSignal.timeout(ms). */
  timeoutMs: number;
  /** Partner slug — feeds metrics + log tags. e.g. 'micamp', 'highsale'. */
  partner: string;
  /** Logical endpoint name (NOT the full URL — may carry ids). */
  endpoint: string;
}

/**
 * Structured timeout error so callers can distinguish a hung partner
 * from a 5xx. Carries partner + endpoint + elapsed-ms for the
 * orchestrator's circuit-breaker / retry decision.
 */
export class IntegrationTimeoutError extends Error {
  readonly partner: string;
  readonly endpoint: string;
  readonly timeoutMs: number;
  readonly elapsedMs: number;
  readonly code = 'integration_timeout' as const;

  constructor(args: { partner: string; endpoint: string; timeoutMs: number; elapsedMs: number }) {
    super(
      `Partner request timed out after ${args.elapsedMs}ms (limit ${args.timeoutMs}ms): ${args.partner}#${args.endpoint}`,
    );
    this.name = 'IntegrationTimeoutError';
    this.partner = args.partner;
    this.endpoint = args.endpoint;
    this.timeoutMs = args.timeoutMs;
    this.elapsedMs = args.elapsedMs;
  }
}

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Node fetch surfaces timeout aborts as either 'TimeoutError' or
  // 'AbortError' depending on runtime version. Match both.
  return err.name === 'AbortError' || err.name === 'TimeoutError';
}

/**
 * Wrap a partner fetch call with a hard timeout + structured timeout
 * error. The `init` object is spread through unchanged — callers
 * supply method/headers/body as they would to native fetch.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  opts: FetchWithTimeoutOptions,
): Promise<Response> {
  const { timeoutMs, partner, endpoint } = opts;
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal });
    return res;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    if (isAbortError(err)) {
      safeLog.warn({
        event: 'integration.timeout',
        partner,
        endpoint,
        ms: elapsed,
        limitMs: timeoutMs,
      });
      throw new IntegrationTimeoutError({
        partner,
        endpoint,
        timeoutMs,
        elapsedMs: elapsed,
      });
    }
    safeLog.warn({
      event: 'integration.fetch_error',
      partner,
      endpoint,
      ms: elapsed,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
