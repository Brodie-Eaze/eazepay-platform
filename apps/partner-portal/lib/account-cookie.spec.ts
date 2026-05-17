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
      // Tamper: swap brand from medpay to tradepay, keep original HMAC.
      const lastDot = signed.lastIndexOf('.');
      const payload = signed.slice(0, lastDot);
      const sig = signed.slice(lastDot + 1);
      const tampered = payload.replace('.medpay.', '.tradepay.') + '.' + sig;
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects a partnerId swap with the original signature', async () => {
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const lastDot = signed.lastIndexOf('.');
      const payload = signed.slice(0, lastDot);
      const sig = signed.slice(lastDot + 1);
      const tampered = payload.replace('.p_helio.', '.p_orion.') + '.' + sig;
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
      // Extend expiry by 1 year.
      const original = Number(parts[3]);
      parts[3] = String(original + 365 * 24 * 3_600_000);
      const tampered = parts.join('.') + '.' + sig;
      expect(await readSignedAccountSession(tampered)).toBeNull();
    });

    it('rejects an unknown brand', async () => {
      // Mint with valid brand, then tamper to inject an unknown brand.
      const signed = await signAccountSession(
        { userId: 'u1', brand: 'medpay', partnerId: 'p_helio' },
        60,
      );
      const tampered = signed.replace('.medpay.', '.foopay.');
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

  describe('ACCOUNT_COOKIE constants', () => {
    it('exposes the canonical cookie name', () => {
      expect(ACCOUNT_COOKIE.name).toBe('eazepay_account');
    });

    it('uses an 8h TTL', () => {
      expect(ACCOUNT_COOKIE.ttlSeconds).toBe(60 * 60 * 8);
    });
  });
});
