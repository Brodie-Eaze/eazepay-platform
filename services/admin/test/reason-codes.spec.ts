import { describe, expect, it } from 'vitest';
import { ADVERSE_ACTION_REASON_CODES, isValidReasonCode } from '../src/reason-codes.js';

describe('Reg B / FCRA reason-code taxonomy', () => {
  it('accepts every documented code', () => {
    for (const code of Object.keys(ADVERSE_ACTION_REASON_CODES)) {
      expect(isValidReasonCode(code)).toBe(true);
    }
  });

  it('rejects unknown codes', () => {
    expect(isValidReasonCode('credit_policy')).toBe(false);
    expect(isValidReasonCode('')).toBe(false);
    expect(isValidReasonCode('not_a_code')).toBe(false);
  });

  it('every code has a non-empty consumer-readable line', () => {
    for (const [code, line] of Object.entries(ADVERSE_ACTION_REASON_CODES)) {
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
      expect(code).not.toContain(' ');
    }
  });
});
