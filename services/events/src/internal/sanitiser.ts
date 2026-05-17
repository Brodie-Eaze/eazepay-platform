/**
 * Event payload sanitiser — allowlist approach.
 *
 * Threat model: a publisher accidentally puts consumer PII (SSN,
 * DOB, full name, raw email, raw phone, address, account number)
 * into the `payload` field. Allowlisting permitted shapes means
 * a developer mistake fails closed (event publish throws) instead
 * of silently leaking the PII to every SSE subscriber.
 *
 * Allowlisted primitives:
 *   - string up to MAX_STRING_LEN (200) chars, but ONLY if it matches
 *     one of the safe-prefix regexes (UUIDs, period ids like
 *     "2026-05", invoice numbers, status enums, ISO timestamps,
 *     short labels). Free-text strings are REJECTED — if you need to
 *     carry free text, encrypt it via `payloadPiiEnc` upstream.
 *   - number (finite)
 *   - boolean
 *   - null
 *   - array of allowed primitives (length capped at 50)
 *   - record of allowed primitives (key count capped at 20)
 *
 * REJECTED outright:
 *   - any property name matching the PII deny-list
 *     (ssn, dob, fullName, email, phone, address, accountNumber,
 *      routing, pan, cvv, password, secret, token, apiKey)
 *   - any string >MAX_STRING_LEN
 *   - any deeply nested structure (>3 levels)
 *   - any function / Date / Symbol / BigInt / Buffer
 */

const MAX_STRING_LEN = 200;
const MAX_DEPTH = 3;
const MAX_ARRAY = 50;
const MAX_OBJ_KEYS = 20;

// All entries lower-case — the check normalises before lookup. Add
// any new key here when a publisher discovers a leak path.
const PII_KEY_DENY = new Set([
  'ssn',
  'dob',
  'fullname',
  'firstname',
  'lastname',
  'email',
  'emailaddress',
  'phone',
  'phonenumber',
  'address',
  'street',
  'addressline',
  'addressline1',
  'addressline2',
  'zip',
  'postalcode',
  'accountnumber',
  'bankaccount',
  'routing',
  'routingnumber',
  'pan',
  'cardnumber',
  'cvv',
  'cvc',
  'password',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cookie',
  'consumeremail',
  'consumername',
  'merchantname',
]);

const SAFE_STRING_PATTERNS: ReadonlyArray<RegExp> = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^[a-z_]+(?:\.[a-z_]+)*$/i, // dotted enum / kind
  /^[A-Z]+-[0-9]{4}-[0-9]{2}(?:-[A-Za-z0-9_]+)?$/, // invoice / period
  /^[0-9]{4}-[0-9]{2}(?:-[0-9]{2})?$/, // YYYY-MM(-DD)
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/, // ISO timestamp
  /^(draft|sent|paid|overdue|voided|confirmed|disputed|pending|approved|declined|active|funding|funded|abandoned|opened|submitted|in_review|offers_presented|accepted|contracted|expired|cancelled)$/, // status enum
  /^[A-Za-z0-9 ._-]{1,60}$/, // short label (lender name, vertical, etc.)
];

export class PiiInEventPayloadError extends Error {
  constructor(
    readonly path: string,
    reason: string,
  ) {
    super(`event payload rejected at "${path}": ${reason}`);
    this.name = 'PiiInEventPayloadError';
  }
}

function isSafeString(s: string): boolean {
  if (s.length > MAX_STRING_LEN) return false;
  return SAFE_STRING_PATTERNS.some((re) => re.test(s));
}

function checkKey(key: string, path: string): void {
  if (PII_KEY_DENY.has(key.toLowerCase())) {
    throw new PiiInEventPayloadError(
      path === '' ? key : `${path}.${key}`,
      `property name "${key}" is on the PII deny-list`,
    );
  }
}

export function assertSafePayload(value: unknown, path = '', depth = 0): void {
  if (depth > MAX_DEPTH) {
    throw new PiiInEventPayloadError(path, `nested deeper than ${MAX_DEPTH} levels`);
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new PiiInEventPayloadError(path, 'non-finite number');
    }
    return;
  }
  if (typeof value === 'string') {
    if (!isSafeString(value)) {
      throw new PiiInEventPayloadError(
        path,
        `string does not match a safe pattern (might contain PII or free text — use payloadPiiEnc for that)`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      throw new PiiInEventPayloadError(
        path,
        `array length ${value.length} exceeds cap ${MAX_ARRAY}`,
      );
    }
    for (let i = 0; i < value.length; i++) {
      assertSafePayload(value[i], `${path}[${i}]`, depth + 1);
    }
    return;
  }
  if (typeof value === 'object') {
    // Reject things that look like objects but aren't plain (Date,
    // Buffer, Map, Set, etc.).
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new PiiInEventPayloadError(path, `non-plain object (${value?.constructor?.name})`);
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > MAX_OBJ_KEYS) {
      throw new PiiInEventPayloadError(
        path,
        `object has ${entries.length} keys, exceeds cap ${MAX_OBJ_KEYS}`,
      );
    }
    for (const [k, v] of entries) {
      checkKey(k, path);
      assertSafePayload(v, path === '' ? k : `${path}.${k}`, depth + 1);
    }
    return;
  }
  throw new PiiInEventPayloadError(path, `unsupported type ${typeof value}`);
}
