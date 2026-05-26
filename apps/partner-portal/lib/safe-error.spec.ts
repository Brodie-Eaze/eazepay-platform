import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeErrorResponse, _SAFE_ERROR_DETAILS } from './safe-error';

/**
 * SEC-007 — safe-error specs.
 *
 * Invariants under test:
 *   1. The response body NEVER contains the original error message,
 *      stack, name, or any other byte from the caught value.
 *   2. The response body matches the generic detail mapped from the
 *      code — same string regardless of error class.
 *   3. The full error is forwarded to `safeLog.error` (which is what
 *      operators read during incident response).
 *   4. HTTP status is preserved as passed — a 400 stays 400, a 502
 *      stays 502.
 *   5. RFC 7807 `instance` is omitted unless provided (keeps body
 *      byte-identical for fingerprinting resistance).
 *   6. Every declared SafeErrorCode has a non-empty detail string —
 *      no accidental `undefined` slipping into a response body.
 */

describe('lib/safe-error — safeErrorResponse', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // safeLog.error writes to console.error under the hood. Capture
    // it so we can assert the full error context made it to the
    // operator log without throwing for unhandled writes.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the passed HTTP status (502)', async () => {
    const res = safeErrorResponse(new Error('upstream timeout'), 'micamp_unreachable', 502);
    expect(res.status).toBe(502);
  });

  it('preserves a 400 status (validation class) when passed', () => {
    const res = safeErrorResponse(new Error('bad input'), 'internal_error', 400);
    expect(res.status).toBe(400);
  });

  it('NEVER echoes err.message to the response body', async () => {
    const sensitive =
      'duplicate key value violates unique constraint "applications_request_id_unique" for SSN 555-12-3456';
    const res = safeErrorResponse(new Error(sensitive), 'highsale_prequal_failed', 502);
    const body = (await res.json()) as Record<string, unknown>;
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('duplicate key');
    expect(serialized).not.toContain('SSN');
    expect(serialized).not.toContain('555-12-3456');
    expect(serialized).not.toContain('applications_request_id_unique');
  });

  it('NEVER echoes err.stack to the response body', async () => {
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at /Users/secret/path/to/handler.ts:42:7';
    const res = safeErrorResponse(err, 'audit_query_failed', 500);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('/Users/secret');
    expect(body).not.toContain('handler.ts');
  });

  it('uses the generic detail mapped from the code', async () => {
    const res = safeErrorResponse(new Error('x'), 'micamp_charge_failed', 502);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe(_SAFE_ERROR_DETAILS.micamp_charge_failed);
  });

  it('serialises the RFC 7807 fields the BFF callers expect', async () => {
    const res = safeErrorResponse(new Error('x'), 'micamp_unreachable', 502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.type).toBe('about:blank');
    expect(body.title).toBe('Bad Gateway');
    expect(body.status).toBe(502);
    expect(body.code).toBe('micamp_unreachable');
    expect(body.detail).toBe(_SAFE_ERROR_DETAILS.micamp_unreachable);
  });

  it('omits `instance` when no path was passed', async () => {
    const res = safeErrorResponse(new Error('x'), 'micamp_unreachable', 502);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('instance');
  });

  it('includes `instance` when explicitly provided', async () => {
    const res = safeErrorResponse(
      new Error('x'),
      'micamp_unreachable',
      502,
      '/api/integrations/micamp/payments',
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.instance).toBe('/api/integrations/micamp/payments');
  });

  it('logs the FULL error context to safeLog.error', () => {
    const err = new Error('full SQL: SELECT * FROM merchants WHERE id=...');
    err.stack = 'stack-trace-detail';
    safeErrorResponse(err, 'highsale_prequal_failed', 502, '/x');
    // safeLog.error pipes JSON to console.error. Inspect the call.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const firstCall = consoleErrorSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(firstCall) as Record<string, unknown>;
    expect(parsed.event).toBe('route.error');
    expect(parsed.code).toBe('highsale_prequal_failed');
    expect(parsed.status).toBe(502);
    expect(parsed.instance).toBe('/x');
    // The error object IS forwarded to the operator log — full message,
    // stack, name are all visible there even though the response hides them.
    const errPayload = parsed.error as Record<string, unknown>;
    expect(errPayload.name).toBe('Error');
    expect(errPayload.message).toContain('full SQL');
    expect(errPayload.stack).toBe('stack-trace-detail');
  });

  it('handles non-Error throws (strings, objects) safely', async () => {
    const res = safeErrorResponse('plain string error', 'internal_error', 500);
    expect(res.status).toBe(500);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('plain string error');
  });

  it('handles undefined / null throws without crashing', () => {
    expect(() => safeErrorResponse(undefined, 'internal_error', 500)).not.toThrow();
    expect(() => safeErrorResponse(null, 'internal_error', 500)).not.toThrow();
  });

  it('every declared code has a non-empty generic detail', () => {
    for (const [code, detail] of Object.entries(_SAFE_ERROR_DETAILS)) {
      expect(typeof detail).toBe('string');
      expect(detail.length).toBeGreaterThan(0);
      expect(detail).not.toContain('undefined');
      // Spot-check: detail must not leak the code itself (would be a
      // weak proxy for echoing an err.message).
      expect(detail).not.toMatch(/^[a-z_]+$/);
      void code;
    }
  });
});
