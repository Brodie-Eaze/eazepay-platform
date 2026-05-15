/**
 * SEC-040 — typed audit-row payload contract.
 *
 * Threat being closed: the AuditOutbox table is the platform's
 * immutable system-of-record. The drain copies every row into the
 * append-only sink (S3/Dynamo + hash chain) and the legal/compliance
 * function leans on it during disputes, regulatory exams, and
 * adverse-action reviews. If a developer accidentally writes raw PII
 * (SSN, DOB, full legal name, account number) into the `before` /
 * `after` JSON columns, that PII propagates into the immutable sink
 * and there is NO supported way to redact it after the fact — the
 * hash chain breaks if we mutate published rows. Today nothing stops
 * a callsite from doing `after: { ssn: '123-45-6789' }`.
 *
 * Fix: a TypeScript type that rejects field names matching the
 * sensitive-name regex at every nesting depth, plus a runtime
 * `validateAuditPayload()` helper that throws if any banned key
 * appears in the JSON tree. The compile-time check catches honest
 * mistakes; the runtime check catches dynamic field names (e.g.
 * `Object.fromEntries(...)`) that the type system can't see through.
 *
 * Banned key pattern is intentionally inclusive: SSN, DOB, name,
 * address, phone, email, account, routing. Audit rows should
 * reference subjects by id and let unmask-with-approval reads
 * project the PII at read time — never by value in the row itself.
 */

const BANNED_KEY_PATTERN = /ssn|dob|name|address|phone|email|account|routing/i;

/**
 * Compile-time enforcement. Recursively walks an object type and
 * resolves to `never` if ANY key (at any depth) matches the
 * sensitive-name regex. Use as a constraint on the audit write
 * helper's `before` / `after` parameter.
 *
 * Limitation: TypeScript's mapped-type recursion is bounded; very
 * deeply nested types may bottom out at `unknown`. The runtime
 * validator below is the load-bearing check — the type is the
 * developer-ergonomics nudge.
 */
type IsBannedKey<K extends string> = K extends string
  ? Lowercase<K> extends `${string}ssn${string}`
    ? true
    : Lowercase<K> extends `${string}dob${string}`
      ? true
      : Lowercase<K> extends `${string}name${string}`
        ? true
        : Lowercase<K> extends `${string}address${string}`
          ? true
          : Lowercase<K> extends `${string}phone${string}`
            ? true
            : Lowercase<K> extends `${string}email${string}`
              ? true
              : Lowercase<K> extends `${string}account${string}`
                ? true
                : Lowercase<K> extends `${string}routing${string}`
                  ? true
                  : false
  : false;

export type BannedKeys<T> = T extends Array<infer U>
  ? Array<BannedKeys<U>>
  : T extends object
    ? {
        [K in keyof T]: K extends string
          ? IsBannedKey<K> extends true
            ? never
            : BannedKeys<T[K]>
          : T[K];
      }
    : T;

/**
 * Use as the type of `before` / `after` on the audit write helper.
 * `T` is the caller's payload shape; the mapped type collapses to
 * `never` if any banned key is present, surfacing the violation as
 * a compile error at the callsite.
 */
export type AuditWritePayload<T> = BannedKeys<T>;

/**
 * SEC-040 — runtime guard. Walks `payload` and throws on the first
 * banned key match at any depth. Idempotent and pure.
 *
 * Why we need both compile-time AND runtime: the compile-time check
 * fires on literal object expressions, but a lot of audit writes pass
 * `{ before: existingRow, after: updated }` where the object's shape
 * is computed at runtime (Prisma-returned rows, `Object.fromEntries`,
 * spread-from-DTO). The runtime walker catches those.
 *
 * Throws `Error` (not a Problem) because this is a programmer error,
 * not a user-facing condition — the request that triggered the bad
 * write should 500 and surface a server-side log.
 */
export function validateAuditPayload(payload: unknown, path = ''): void {
  if (payload === null || payload === undefined) return;
  if (typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      validateAuditPayload(payload[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (BANNED_KEY_PATTERN.test(key)) {
      throw new Error(
        `audit_payload_forbidden_field: '${path ? `${path}.${key}` : key}' matches sensitive-name regex; reference the subject by id instead`,
      );
    }
    validateAuditPayload(value, path ? `${path}.${key}` : key);
  }
}
