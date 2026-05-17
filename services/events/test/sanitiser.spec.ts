import { describe, expect, it } from 'vitest';
import { assertSafePayload, PiiInEventPayloadError } from '../src/internal/sanitiser.js';

/**
 * Sanitiser contract — this is the wall between the publisher and
 * the wire. If anything here regresses, raw consumer PII could flow
 * to SSE subscribers. Pin every boundary.
 */

describe('assertSafePayload — accepts safe shapes', () => {
  it('accepts UUIDs', () => {
    expect(() =>
      assertSafePayload({ applicationId: 'abc12345-1234-1234-1234-1234567890ab' }),
    ).not.toThrow();
  });

  it('accepts period ids + invoice numbers', () => {
    expect(() =>
      assertSafePayload({ periodId: '2026-05', invoiceNo: 'INV-2026-05-p_atlas' }),
    ).not.toThrow();
  });

  it('accepts status enums', () => {
    expect(() => assertSafePayload({ status: 'paid' })).not.toThrow();
    expect(() => assertSafePayload({ status: 'offers_presented' })).not.toThrow();
  });

  it('accepts ISO timestamps', () => {
    expect(() => assertSafePayload({ at: '2026-05-17T14:30:00.123Z' })).not.toThrow();
  });

  it('accepts numbers, booleans, null', () => {
    expect(() => assertSafePayload({ feeBps: 350, autoSend: true, ref: null })).not.toThrow();
  });

  it('accepts short labels (lender names)', () => {
    expect(() => assertSafePayload({ lender: 'BuzzPay' })).not.toThrow();
    expect(() => assertSafePayload({ lender: 'Cross River Bank' })).not.toThrow();
  });

  it('accepts nested arrays of safe primitives', () => {
    expect(() =>
      assertSafePayload({ tags: ['MedPay', 'tier_1'], counts: [1, 2, 3] }),
    ).not.toThrow();
  });
});

describe('assertSafePayload — rejects PII shapes', () => {
  it('rejects deny-listed property names regardless of value', () => {
    expect(() => assertSafePayload({ ssn: '123-45-6789' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ dob: '1990-01-15' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ email: 'a@b.com' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ phone: '+15551234' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ password: 'whatever' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ token: 'whatever' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ pan: 'whatever' })).toThrow(PiiInEventPayloadError);
  });

  it('rejects deny-listed name-like keys (firstName, lastName, fullName, consumerEmail)', () => {
    expect(() => assertSafePayload({ firstName: 'Sally' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ lastName: 'Smith' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ fullName: 'Sally Smith' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ consumerEmail: 'a@b' })).toThrow(PiiInEventPayloadError);
  });

  it('rejects strings beyond MAX_STRING_LEN', () => {
    expect(() => assertSafePayload({ ref: 'a'.repeat(201) })).toThrow(PiiInEventPayloadError);
  });

  it('rejects deeply nested structures', () => {
    const deep: Record<string, unknown> = { l1: { l2: { l3: { l4: { id: 'x' } } } } };
    expect(() => assertSafePayload(deep)).toThrow(PiiInEventPayloadError);
  });

  it('rejects oversized arrays', () => {
    expect(() => assertSafePayload({ ids: new Array(51).fill('x') })).toThrow(
      PiiInEventPayloadError,
    );
  });

  it('rejects oversized objects', () => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < 21; i++) obj[`k${i}`] = 1;
    expect(() => assertSafePayload(obj)).toThrow(PiiInEventPayloadError);
  });

  it('rejects non-plain objects (Date, Buffer, Map)', () => {
    expect(() => assertSafePayload({ at: new Date() })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ buf: Buffer.from('a') })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ m: new Map() })).toThrow(PiiInEventPayloadError);
  });

  it('rejects NaN / Infinity numbers', () => {
    expect(() => assertSafePayload({ x: NaN })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ x: Infinity })).toThrow(PiiInEventPayloadError);
  });

  it('case-insensitive deny-list check', () => {
    expect(() => assertSafePayload({ Email: 'a@b' })).toThrow(PiiInEventPayloadError);
    expect(() => assertSafePayload({ PASSWORD: 'x' })).toThrow(PiiInEventPayloadError);
  });

  it('reports the path of the offending key', () => {
    try {
      assertSafePayload({ outer: { ssn: '1' } });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PiiInEventPayloadError);
      expect((e as Error).message).toContain('outer.ssn');
    }
  });
});
