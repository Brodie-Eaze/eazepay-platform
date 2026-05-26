/**
 * SEC-007 — Safe error responses for BFF route handlers.
 *
 * Threat being closed
 * -------------------
 * Several route handlers shipped with the pattern:
 *
 *   detail: err instanceof Error ? err.message : 'Unknown error'
 *
 * In production, `err.message` leaks:
 *   • Drizzle/pg errors carry the FULL SQL statement, the offending
 *     column name, sometimes a sample value — schema disclosure useful
 *     for crafting a follow-on injection.
 *   • Upstream API errors (MiCamp / HighSale) embed their internal
 *     identifiers and stack traces.
 *   • `node-fetch` errors carry the resolved URL + headers in some
 *     code paths — including the upstream's host:port.
 *
 * An attacker probing one of these endpoints with a malformed body can
 * harvest that surface in minutes. The data has zero value to the
 * legitimate caller (they can't act on it) and high value to an
 * attacker (every byte narrows their next attempt).
 *
 * Defence
 * -------
 * One helper, used by every state-changing route's catch block.
 *
 *   return safeErrorResponse(err, 'micamp_charge_failed', 502, '/payments');
 *
 * Properties:
 *   1. The full error (name, message, stack) goes to `safeLog.error`
 *      so the operator can debug — but never to the response body.
 *   2. The response body carries only `code` + a generic English
 *      `detail` mapped from the code. The mapping table is in this
 *      file so divergence between routes is impossible.
 *   3. Status preserved — a 400 validation error stays 400, a 502
 *      upstream failure stays 502. Mapping doesn't change the
 *      semantic class of the response.
 *
 * The `instance` parameter is RFC 7807's optional URI reference for
 * the specific occurrence. Surfaces in logs + audit trails; not part
 * of the response body unless explicitly attached.
 */

import { NextResponse } from 'next/server';
import { safeLog } from './safe-log';

/**
 * Public catalogue of error codes the BFF surfaces. Adding a new code
 * is a two-line change: add it to the union and a generic-detail string
 * to the table below.
 *
 * Codes are stable: a client may switch on `code` for branched UX
 * (e.g. show a "verify your phone" prompt vs. a generic retry button).
 * Renaming a code is a breaking change — append a new code instead.
 */
export type SafeErrorCode =
  | 'audit_query_failed'
  | 'micamp_charge_failed'
  | 'micamp_settlement_failed'
  | 'micamp_unreachable'
  | 'highsale_prequal_failed'
  | 'highsale_subaccount_failed'
  | 'upstream_unavailable'
  | 'internal_error';

/**
 * Generic, consumer-safe detail strings. NEVER carry any byte of the
 * original error — these are hand-written, reviewed copy.
 *
 * Tone rules:
 *   • Active voice, second person where natural.
 *   • Tell the caller what to do next ("Try again or contact support.")
 *     — never just "something went wrong".
 *   • Never name the upstream system unless the partner needs to know
 *     ("MiCamp is offline" leaks dependency topology; "We could not
 *     process this charge" doesn't).
 */
const DETAIL_BY_CODE: Record<SafeErrorCode, string> = {
  audit_query_failed: 'We could not load the audit log. Try again in a moment.',
  micamp_charge_failed:
    'We could not process this charge. Try again or contact support if it persists.',
  micamp_settlement_failed:
    'We could not fetch the settlement report. Try again or narrow the date range.',
  micamp_unreachable: 'The payments provider is temporarily unavailable. Try again shortly.',
  highsale_prequal_failed:
    'We could not run a pre-qualification for this application. Try again or contact support.',
  highsale_subaccount_failed: 'We could not create the sub-account. Try again or contact support.',
  upstream_unavailable:
    'A required upstream service is temporarily unavailable. Try again shortly.',
  internal_error: 'An unexpected error occurred. Try again or contact support.',
};

/**
 * Map an error's HTTP status to the RFC 7807 `title` string. Centralised
 * so every route's response shape is byte-identical — divergent titles
 * make a fingerprinting attacker's job easier.
 */
function titleForStatus(status: number): string {
  if (status === 400) return 'Bad Request';
  if (status === 401) return 'Unauthorized';
  if (status === 403) return 'Forbidden';
  if (status === 404) return 'Not Found';
  if (status === 409) return 'Conflict';
  if (status === 412) return 'Precondition Failed';
  if (status === 422) return 'Unprocessable Entity';
  if (status === 429) return 'Too Many Requests';
  if (status === 502) return 'Bad Gateway';
  if (status === 503) return 'Service Unavailable';
  return 'Internal Server Error';
}

/**
 * Build a Problem Details NextResponse that never echoes the caught
 * error to the wire, but DOES log it for the operator.
 *
 * Parameters:
 *   - err: the caught value. Logged in full (name + message + stack
 *     when present); never serialised to the response body.
 *   - code: stable SafeErrorCode the client can branch on.
 *   - status: HTTP status. Preserved — a 400 validation error stays
 *     400; a 502 upstream failure stays 502.
 *   - instance: optional RFC 7807 instance URI. When omitted the field
 *     is not serialised, keeping bodies byte-identical for the same
 *     (code, status) pair across all routes.
 */
export function safeErrorResponse(
  err: unknown,
  code: SafeErrorCode,
  status: number,
  instance?: string,
): NextResponse {
  // Log FULL error context for the operator. safeLog redacts deny-listed
  // keys; the err itself doesn't have keys like `ssn`, but if a wrapper
  // ever passes `{ ssn, ...rest }` as the error this still won't leak.
  const errorDetails =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { name: 'NonErrorThrown', message: String(err), stack: undefined };

  safeLog.error({
    event: 'route.error',
    code,
    status,
    instance: instance ?? null,
    error: errorDetails,
  });

  const body: Record<string, unknown> = {
    type: 'about:blank',
    title: titleForStatus(status),
    status,
    code,
    detail: DETAIL_BY_CODE[code],
  };
  if (instance) body.instance = instance;

  return NextResponse.json(body, { status });
}

/**
 * Test-only: read back the mapping so specs can assert that every code
 * has a defined generic detail (no accidental `undefined` leaking the
 * literal string `'undefined'` into a response body).
 */
export const _SAFE_ERROR_DETAILS = DETAIL_BY_CODE;
