/**
 * SEC-115 — PII-aware logging primitive for the partner-portal BFF.
 *
 * The partner-portal doesn't use Pino (no app.module.ts equivalent of
 * the backend's `pino-pretty` + redact pipeline). Today there is no
 * structured logging at all in the BFF, but several routes proxy PII-
 * heavy payloads (SSN-last-4, DOB, owner phone/email, consumer PII)
 * to backend / provider APIs. The day someone adds a `console.log` to
 * debug a failing call, all of that PII goes to the log stream.
 *
 * This module is the safe primitive:
 *
 *   import { safeLog, redactForLog } from '../../lib/safe-log';
 *   safeLog.info({ event: 'brand_apply.dispatch', payload: body });
 *
 * `redactForLog` recursively walks an object and replaces any value at
 * a deny-listed key with the literal string `'[redacted]'`. The deny
 * list is conservative — adding a new field is one line.
 *
 * Goals:
 *   - Default-safe: any payload passed through this helper is sanitised
 *     before it reaches the underlying console / Pino sink.
 *   - Conservative deny list: SSN, DOB, full name, address, taxId,
 *     payment instruments, secrets, tokens. Field-name match is
 *     case-insensitive + suffix-tolerant (`ownerSsnLast4` matches `ssn`).
 *   - No assumption about a downstream logger. `safeLog.*` dispatches
 *     to `console.*` today; when Pino lands, the function bodies swap
 *     without breaking call sites.
 *
 * Not goals:
 *   - Encryption / hashing. PII never reaches logs at all — full stop.
 *   - Audit logging. That's a separate, append-only pipeline.
 */

/**
 * Deny-list of substrings to match against object keys. Match is
 * case-insensitive and substring-based to catch the common variants
 * (`ownerSsnLast4`, `consumer_dob`, `legal_name`, `password_hash`).
 *
 * False positives are acceptable here — over-redacting a debug field
 * is harmless; under-redacting a PII field is a SOC2 finding. When you
 * add a new sensitive field elsewhere in the codebase, add a base word
 * (or its case-folded variants) here.
 */
const DENY_KEY_SUBSTRINGS: ReadonlyArray<string> = [
  // Identity
  'ssn',
  'socialSecurityNumber',
  'nationalId',
  'dob',
  'dateOfBirth',
  'birthDate',
  'birthday',
  'firstName',
  'lastName',
  'middleName',
  'fullName',
  'legalName',
  'taxId',
  'ein',
  'tin',
  // Contact
  'email',
  'phone',
  'mobile',
  'cellphone',
  'address',
  'street',
  'postalCode',
  'zip',
  // Financial
  'accountNumber',
  'routingNumber',
  'cardNumber',
  'cvc',
  'cvv',
  'pan',
  'iban',
  'bic',
  'swift',
  // Secrets / tokens
  'password',
  'passcode',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'bearerToken',
  'authorization',
].map((s) => s.toLowerCase());

const REDACTED = '[redacted]';
const MAX_DEPTH = 6;

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  return DENY_KEY_SUBSTRINGS.some((needle) => lower.includes(needle));
}

/**
 * Recursively walk a value and replace any field at a deny-listed key
 * with the literal string `'[redacted]'`. Arrays + nested objects are
 * traversed. Cycles are short-circuited via WeakSet. Depth-capped to
 * 6 to prevent pathological inputs from blowing the stack.
 */
export function redactForLog(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactForLog(v, depth + 1, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedact(k)) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redactForLog(v, depth + 1, seen);
  }
  return out;
}

/** Lightweight log surface that pre-redacts every payload. */
export const safeLog = {
  info(payload: unknown): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ level: 'info', ...(toRecord(payload) ?? { payload: REDACTED }) }));
  },
  warn(payload: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({ level: 'warn', ...(toRecord(payload) ?? { payload: REDACTED }) }),
    );
  },
  error(payload: unknown): void {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({ level: 'error', ...(toRecord(payload) ?? { payload: REDACTED }) }),
    );
  },
} as const;

function toRecord(value: unknown): Record<string, unknown> | null {
  const redacted = redactForLog(value);
  if (redacted && typeof redacted === 'object' && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return null;
}
