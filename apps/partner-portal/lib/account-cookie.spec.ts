import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  signAccountSession,
  readSignedAccountSession,
  ACCOUNT_COOKIE,
  _resetAccountCookieKeyCache,
} from './account-cookie';

describe('account-cookie', () => {
  beforeEach(() => {
    _resetAccountCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    vi.useRealTimers();
  });

  describe('signAccountSession + readSignedAccountSession', () => {
    it('round-trips a fresh signature', async () => {
      const value = await signAccountSession(
        { userId: '11111111-1111-1111-1111-111111111111', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const parsed = await readSignedAccountSession(value);
      expect(parsed?.userId).toBe('11111111-1111-1111-1111-111111111111');
      expect(parsed?.brand).toBe('medpay');
      expect(parsed?.partnerId).toBe('p_helio');
      expect(parsed?.expiresAtMs).toBeGreaterThan(Date.now());
    });

    it('rejects an expired signature', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const value = await signAccountSession(
        { userId: 'u1', brand: 'tradepay', partnerId: 'p_orion' },
        10,
      );
      vi.setSystemTime(new Date('2026-01-01T00:00:11Z'));
      expect(await readSignedAccountSession(value)).toBeNull();
    });

    it('rejects a forged signature (different secret)', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'coachpay', partnerId: 'p_atlas' },
        60,
      );
      _resetAccountCookieKeyCache();
      process.env.DEMO_COOKIE_SECRET = 'rotated-different-secret'.padEnd(40, '_');
      expect(await readSignedAccountSession(signed)).toBeNull();
    });

    it('rejects a brand swap with the original signature', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      // v2 — tamper the b64u-encoded brand segment, keep HMAC.
      const b64Medpay = Buffer.from('medpay').toString('base64url');
      const b64Tradepay = Buffer.from('tradepay').toString('base64url');
      const tampered = signed.replace('.' + b64Medpay + '.', '.' + b64Tradepay + '.');
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects a partnerId swap with the original signature', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const b64Helio = Buffer.from('p_helio').toString('base64url');
      const b64Orion = Buffer.from('p_orion').toString('base64url');
      const tampered = signed.replace('.' + b64Helio + '.', '.' + b64Orion + '.');
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects an expiry extension', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const lastDot = signed.lastIndexOf('.');
      const payload = signed.slice(0, lastDot);
      const sig = signed.slice(lastDot + 1);
      const parts = payload.split('.');
      // v2 layout: ['v2', b64UserId, b64Brand, b64PartnerId, expires]
      // Extend the expiry slot (index 4 in v2) by 1 year.
      const original = Number(parts[4]);
      parts[4] = String(original + 365 * 24 * 3_600_000);
      const tampered = parts.join('.') + '.' + sig;
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects an unknown brand (b64u-encoded)', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const b64Medpay = Buffer.from('medpay').toString('base64url');
      const b64Foopay = Buffer.from('foopay').toString('base64url');
      const tampered = signed.replace('.' + b64Medpay + '.', '.' + b64Foopay + '.');
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('returns null for empty / malformed input', async () => {
      expect(await readSignedAccountSession(null)).toBeNull();
      expect(await readSignedAccountSession(undefined)).toBeNull();
      expect(await readSignedAccountSession('')).toBeNull();
      expect(await readSignedAccountSession('not-a-cookie')).toBeNull();
      expect(await readSignedAccountSession('a.b.c.d.zzz-not-hex')).toBeNull();
    });
  });

  describe('SEC-204 — v2 canonicalization-safe shape', () => {
    it('mints v2 cookies by default (b64url-encoded fields)', async () => {
      const value = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      expect(value.startsWith('v2.')).toBe(true);
      // v2 has 6 dot-separated parts: ['v2', b64u..., b64u..., b64u..., expires, sig]
      expect(value.split('.').length).toBe(6);
    });

    it('round-trips a partnerId containing a literal dot (would have broken v1)', async () => {
      // v1 would have split this into 5 parts and rejected as malformed.
      // v2 encodes each field as b64url so embedded `.` chars are
      // transported without ambiguity.
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p.helio.with.dots' },
        60,
      );
      const parsed = await readSignedAccountSession(signed);
      expect(parsed?.partnerId).toBe('p.helio.with.dots');
    });

    it('rejects a v2 cookie whose b64u brand decodes to a non-allowlisted brand', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      // Tamper: replace the b64u(medpay) segment with b64u(foopay) but
      // keep the same HMAC. Must reject.
      const b64Medpay = Buffer.from('medpay').toString('base64url');
      const b64Foopay = Buffer.from('foopay').toString('base64url');
      const tampered = signed.replace('.' + b64Medpay + '.', '.' + b64Foopay + '.');
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects a v2 cookie whose b64u segment contains illegal chars', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      // Inject a literal `=` into a b64u field — not in the b64url
      // alphabet, must be rejected by the decoder.
      const parts = signed.split('.');
      parts[1] = parts[1] + '=';
      expect(await readSignedAccountSession(parts.join('.'))).toBeNull();
    });
  });

  describe('ACCOUNT_COOKIE constants', () => {
    it('exposes the canonical cookie name', () => {
      expect(ACCOUNT_COOKIE.name).toBe('eazepay_account');
    });

    it('uses an 8h TTL', () => {
      expect(ACCOUNT_COOKIE.ttlSeconds).toBe(60 * 60 * 8);
    });
  });
});
