import { describe, expect, it } from 'vitest';
import { extractBearerToken, verifyPartnerApiKey } from './partner-api-key';

describe('partner-api-key (SEC-202)', () => {
  describe('extractBearerToken', () => {
    it('returns null for missing header', () => {
      expect(extractBearerToken(null)).toBeNull();
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken('')).toBeNull();
    });

    it('returns null for non-Bearer schemes', () => {
      expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
      expect(extractBearerToken('Token abc')).toBeNull();
    });

    it('extracts the token for a well-formed Bearer header', () => {
      expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('is case-insensitive on the scheme', () => {
      expect(extractBearerToken('bearer abc')).toBe('abc');
      expect(extractBearerToken('BEARER abc')).toBe('abc');
    });

    it('returns null for an empty token after the scheme', () => {
      expect(extractBearerToken('Bearer ')).toBeNull();
      expect(extractBearerToken('Bearer    ')).toBeNull();
    });
  });

  describe('verifyPartnerApiKey', () => {
    it('fails closed: every token currently rejects', async () => {
      // SEC-202 stub posture — no real keys provisioned yet, so the
      // verifier MUST reject everything. If this test starts failing,
      // it means real-key lookup landed and the callers' 401 path needs
      // matching coverage.
      expect(await verifyPartnerApiKey('anything')).toBeNull();
      expect(await verifyPartnerApiKey('')).toBeNull();
      expect(await verifyPartnerApiKey('a'.repeat(256))).toBeNull();
    });
  });
});
