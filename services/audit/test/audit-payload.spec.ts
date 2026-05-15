import { describe, expect, it } from 'vitest';
import { validateAuditPayload } from '../src/audit-payload.js';

/**
 * SEC-040 — runtime guard for the AuditOutbox payload.
 *
 * The threat model is "developer accidentally writes raw PII into the
 * immutable audit sink." The validator must throw on any banned KEY
 * (ssn, dob, name, address, phone, email, account, routing) at any
 * nesting depth, including inside arrays. It should NOT throw when
 * those substrings appear as VALUES — audit notes like
 * "consumer address verified" need to remain expressible.
 */
describe('validateAuditPayload', () => {
  it('passes a clean payload of ids and amounts', () => {
    expect(() =>
      validateAuditPayload({
        applicationId: 'app_123',
        partnerId: 'p_helio',
        amountCents: 250_000,
        status: 'approved',
      }),
    ).not.toThrow();
  });

  it('passes when payload is null / undefined / primitive', () => {
    // why: helper is called on `before` / `after` columns that legitimately
    // can be null on insert and `undefined` on no-op updates.
    expect(() => validateAuditPayload(null)).not.toThrow();
    expect(() => validateAuditPayload(undefined)).not.toThrow();
    expect(() => validateAuditPayload('a string')).not.toThrow();
    expect(() => validateAuditPayload(42)).not.toThrow();
  });

  it('throws on a top-level banned key (ssn)', () => {
    expect(() => validateAuditPayload({ ssn: '123-45-6789' })).toThrow(
      /audit_payload_forbidden_field/,
    );
  });

  it('throws on every banned key family', () => {
    // why: the regex is the line of defence. If a future refactor drops
    // one of these tokens we want a red light immediately.
    const banned: Array<Record<string, unknown>> = [
      { ssn: 'x' },
      { dob: '1990-01-01' },
      { firstName: 'Casey' }, // matches /name/
      { homeAddress: '1 Main St' }, // matches /address/
      { phoneNumber: '555' }, // matches /phone/
      { email: 'a@b.co' },
      { accountNumber: '0000' }, // matches /account/
      { routingNumber: '111000025' }, // matches /routing/
    ];
    for (const p of banned) {
      expect(() => validateAuditPayload(p)).toThrow(/audit_payload_forbidden_field/);
    }
  });

  it('throws on a deeply nested banned key', () => {
    // why: the walker must recurse through nested objects + arrays.
    expect(() =>
      validateAuditPayload({
        consumer: { profile: { contact: { email: 'a@b.co' } } },
      }),
    ).toThrow(/audit_payload_forbidden_field/);
  });

  it('throws on a banned key inside an array element', () => {
    expect(() =>
      validateAuditPayload({
        applicants: [{ id: 'a1' }, { id: 'a2', dob: '1990-01-01' }],
      }),
    ).toThrow(/audit_payload_forbidden_field/);
  });

  it('error path identifies the offending key', () => {
    // why: when this fires in prod logs the engineer needs to know which
    // callsite to fix. The error message includes the dotted path.
    expect(() => validateAuditPayload({ consumer: { profile: { phone: '555' } } })).toThrow(
      /consumer\.profile\.phone/,
    );
  });

  it('allows substrings only as VALUES, not as keys', () => {
    // why: a note like "consumer address verified by signature pad" is a
    // legitimate audit narrative — only the KEY namespace is banned. The
    // guard is name-based, not content-based; content scrubbing is a
    // separate concern handled at the DTO layer.
    expect(() =>
      validateAuditPayload({
        note: 'address verified at signing',
        outcome: 'approved by name match',
      }),
    ).not.toThrow();
  });

  it('case-insensitive — uppercase keys still trip the guard', () => {
    // why: BANNED_KEY_PATTERN uses the `i` flag. SSN / DOB are the
    // canonical examples and frequently written all-caps.
    expect(() => validateAuditPayload({ SSN: 'x' })).toThrow();
    expect(() => validateAuditPayload({ DOB: 'x' })).toThrow();
    expect(() => validateAuditPayload({ Email: 'x' })).toThrow();
  });

  it('allows an empty object and empty array', () => {
    expect(() => validateAuditPayload({})).not.toThrow();
    expect(() => validateAuditPayload([])).not.toThrow();
    expect(() => validateAuditPayload({ items: [] })).not.toThrow();
  });
});
