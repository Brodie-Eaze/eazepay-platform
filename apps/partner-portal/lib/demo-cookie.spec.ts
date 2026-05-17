import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  signDemoPreset,
  readSignedDemoPreset,
  unsafeParseSignedDemoPreset,
  _resetDemoCookieKeyCache,
} from './demo-cookie';

describe('demo-cookie', () => {
  beforeEach(() => {
    _resetDemoCookieKeyCache();
    process.env.DEMO_COOKIE_SECRET = 'unit-test-secret-x'.padEnd(40, '_');
    vi.useRealTimers();
  });

  describe('signDemoPreset + readSignedDemoPreset', () => {
    it('round-trips a fresh signature', async () => {
      const value = await signDemoPreset('medpay', 60);
      const parsed = await readSignedDemoPreset(value);
      expect(parsed?.preset).toBe('medpay');
      expect(parsed?.expiresAtMs).toBeGreaterThan(Date.now());
    });

    it('rejects an expired signature', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const value = await signDemoPreset('medpay', 10);
      vi.setSystemTime(new Date('2026-01-01T00:00:11Z')); // 1 sec past expiry
      expect(await readSignedDemoPreset(value)).toBeNull();
    });

    it('rejects a forged signature (different secret)', async () => {
      const signed = await signDemoPreset('master', 60);
      // Rotate the secret and try to verify the previously-minted token.
      _resetDemoCookieKeyCache();
      process.env.DEMO_COOKIE_SECRET = 'rotated-different-secret'.padEnd(40, '_');
      expect(await readSignedDemoPreset(signed)).toBeNull();
    });

    it('rejects a preset swap with the original signature', async () => {
      const signed = await signDemoPreset('medpay', 60);
      // Swap the preset to master while keeping the signature.
      const lastDot = signed.lastIndexOf('.');
      const sig = signed.slice(lastDot + 1);
      const parts = signed.slice(0, lastDot).split('.');
      const swapped = `master.${parts[1]}.${sig}`;
      expect(await readSignedDemoPreset(swapped)).toBeNull();
    });

    it('rejects bare unsigned preset', async () => {
      expect(await readSignedDemoPreset('master')).toBeNull();
    });

    it('rejects empty / missing input', async () => {
      expect(await readSignedDemoPreset(undefined)).toBeNull();
      expect(await readSignedDemoPreset(null)).toBeNull();
      expect(await readSignedDemoPreset('')).toBeNull();
    });

    it('rejects malformed input (no dots)', async () => {
      expect(await readSignedDemoPreset('garbage')).toBeNull();
    });

    it('rejects malformed input (extra dots)', async () => {
      expect(await readSignedDemoPreset('a.b.c.d')).toBeNull();
    });

    it('rejects non-numeric expiry', async () => {
      expect(await readSignedDemoPreset('master.notanum.deadbeef')).toBeNull();
    });
  });

  describe('unsafeParseSignedDemoPreset', () => {
    it('returns the preset without verifying', async () => {
      const value = await signDemoPreset('medpay', 60);
      expect(unsafeParseSignedDemoPreset(value)?.preset).toBe('medpay');
    });

    it('returns null for malformed input', () => {
      expect(unsafeParseSignedDemoPreset('nope')).toBeNull();
      expect(unsafeParseSignedDemoPreset(undefined)).toBeNull();
    });
  });

  describe('production secret requirement', () => {
    it('throws if production has no DEMO_COOKIE_SECRET', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.DEMO_COOKIE_SECRET;
      try {
        // @ts-expect-error -- test mutates env
        process.env.NODE_ENV = 'production';
        delete process.env.DEMO_COOKIE_SECRET;
        _resetDemoCookieKeyCache();
        await expect(signDemoPreset('master', 60)).rejects.toThrow(/DEMO_COOKIE_SECRET/);
      } finally {
        // @ts-expect-error -- test restores env
        process.env.NODE_ENV = origNodeEnv;
        if (origSecret) process.env.DEMO_COOKIE_SECRET = origSecret;
        _resetDemoCookieKeyCache();
      }
    });

    it('throws if production secret is too short', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.DEMO_COOKIE_SECRET;
      try {
        // @ts-expect-error -- test mutates env
        process.env.NODE_ENV = 'production';
        process.env.DEMO_COOKIE_SECRET = 'short';
        _resetDemoCookieKeyCache();
        await expect(signDemoPreset('master', 60)).rejects.toThrow(/DEMO_COOKIE_SECRET/);
      } finally {
        // @ts-expect-error -- test restores env
        process.env.NODE_ENV = origNodeEnv;
        if (origSecret) process.env.DEMO_COOKIE_SECRET = origSecret;
        _resetDemoCookieKeyCache();
      }
    });
  });
});
