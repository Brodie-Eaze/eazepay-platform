import { describe, it, expect } from 'vitest';
import { redactForLog } from './safe-log';

describe('redactForLog', () => {
  it('passes primitives through untouched', () => {
    expect(redactForLog('hello')).toBe('hello');
    expect(redactForLog(42)).toBe(42);
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(true)).toBe(true);
  });

  it('redacts top-level deny-listed keys', () => {
    expect(redactForLog({ ssn: '123-45-6789', name: 'ok' })).toEqual({
      ssn: '[redacted]',
      name: 'ok',
    });
  });

  it('redacts ownerSsnLast4 (suffix-tolerant match)', () => {
    expect(redactForLog({ ownerSsnLast4: '6789' })).toEqual({
      ownerSsnLast4: '[redacted]',
    });
  });

  it('redacts ownerDob, ownerEmail, ownerPhone, ownerAddress', () => {
    expect(
      redactForLog({
        ownerDob: '1990-01-01',
        ownerEmail: 'a@b.com',
        ownerPhone: '555-0100',
        ownerAddress: '1 Main St',
        unrelated: 'keep',
      }),
    ).toEqual({
      ownerDob: '[redacted]',
      ownerEmail: '[redacted]',
      ownerPhone: '[redacted]',
      ownerAddress: '[redacted]',
      unrelated: 'keep',
    });
  });

  it('walks into arrays and nested objects', () => {
    expect(
      redactForLog({
        merchants: [
          { name: 'A', owner: { firstName: 'Alice', ssn: 'X' } },
          { name: 'B', owner: { firstName: 'Bob', ssn: 'Y' } },
        ],
      }),
    ).toEqual({
      merchants: [
        { name: 'A', owner: { firstName: '[redacted]', ssn: '[redacted]' } },
        { name: 'B', owner: { firstName: '[redacted]', ssn: '[redacted]' } },
      ],
    });
  });

  it('redacts secrets / tokens', () => {
    expect(
      redactForLog({
        password: 'p',
        apiKey: 'k',
        accessToken: 't',
        refreshToken: 'r',
        authorization: 'Bearer xyz',
      }),
    ).toEqual({
      password: '[redacted]',
      apiKey: '[redacted]',
      accessToken: '[redacted]',
      refreshToken: '[redacted]',
      authorization: '[redacted]',
    });
  });

  it('handles cycles without throwing', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a.self = a;
    expect(() => redactForLog(a)).not.toThrow();
  });

  it('caps recursion depth', () => {
    let nested: Record<string, unknown> = { ssn: 'leak' };
    for (let i = 0; i < 10; i++) nested = { child: nested };
    const result = JSON.stringify(redactForLog(nested));
    expect(result).not.toContain('leak');
  });
});
