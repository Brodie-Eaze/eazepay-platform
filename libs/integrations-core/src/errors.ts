/**
 * IntegrationError — discriminated union for every failure mode an
 * integration adapter can surface up to its caller.
 *
 * Why a union instead of an Error subclass tree:
 *
 *   - Route handlers + workers need to switch on the failure kind to
 *     pick the right HTTP / retry response. A union forces exhaustive
 *     handling at the call site; a class hierarchy makes it easy to
 *     silently fall through to a generic 500.
 *   - Adapters cross provider boundaries (MiCamp vs HighSale vs the
 *     future Trutopia). A shared error vocabulary keeps upstream code
 *     vendor-agnostic — adding Trutopia must not require new error
 *     branches in every consumer.
 *   - Discriminated unions serialise cleanly into safeLog / inbox
 *     failure_reason columns without losing structure.
 *
 * The five kinds map to the failure modes the platform actually has to
 * react to:
 *
 *   - Timeout            — upstream took too long; safe to retry with
 *                          backoff iff the call is idempotent.
 *   - BadSignature       — inbound webhook signature did not verify;
 *                          never retry, never act on the payload.
 *   - BadStatus          — upstream returned a non-2xx; retryability
 *                          depends on status (5xx yes, 4xx no).
 *   - MalformedResponse  — upstream gave 200 but body did not parse /
 *                          schema-match; alert + do not retry.
 *   - NotImplemented     — adapter method intentionally absent on this
 *                          provider (e.g. stub before real wiring).
 *
 * The provider field is REQUIRED so the inbox row / metrics tile can
 * attribute the failure without a parallel lookup. The endpoint is a
 * short identifier (`charge`, `runPrequal`, ...) — NOT the full URL,
 * which can carry secrets.
 */

export type IntegrationProvider = 'micamp' | 'highsale' | 'trutopia';

export interface IntegrationErrorBase {
  /** Which adapter raised the error. Required for metrics + log scoping. */
  readonly provider: IntegrationProvider;
  /** Logical method name (e.g. 'charge', 'runPrequal'). NOT a URL. */
  readonly endpoint: string;
  /** Operator-facing message. Never echoed to consumers (SEC-007). */
  readonly message: string;
}

export type IntegrationError =
  | (IntegrationErrorBase & { readonly kind: 'Timeout'; readonly timeoutMs: number })
  | (IntegrationErrorBase & { readonly kind: 'BadSignature'; readonly reason: string })
  | (IntegrationErrorBase & { readonly kind: 'BadStatus'; readonly status: number })
  | (IntegrationErrorBase & { readonly kind: 'MalformedResponse'; readonly detail: string })
  | (IntegrationErrorBase & { readonly kind: 'NotImplemented' });

/**
 * Throwable wrapper. Adapters can either return an IntegrationError via
 * a Result-style API or throw this Error subclass that carries the
 * structured payload. Both shapes are exposed because:
 *
 *   - Route handlers using try/catch want a real Error.
 *   - Workers walking a batch want to inspect kind without unwinding.
 */
export class IntegrationErrorException extends Error {
  readonly detail: IntegrationError;

  constructor(detail: IntegrationError) {
    super(`[${detail.provider}/${detail.endpoint}] ${detail.kind}: ${detail.message}`);
    this.name = 'IntegrationErrorException';
    this.detail = detail;
  }
}

export function isIntegrationError(value: unknown): value is IntegrationErrorException {
  return value instanceof IntegrationErrorException;
}
