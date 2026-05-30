import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assertProdEnv, _resetEnvAssertion } from './env';

/**
 * `assertProdEnv()` is the boot-time guard that prevents a deploy with
 * missing secrets from accepting a single request. These specs pin its
 * three behaviours:
 *
 *   1. In production, throws when any REQUIRED secret is missing or
 *      malformed.
 *   2. In production, throws when a secret is set but too short.
 *   3. In non-production, returns a result object without throwing
 *      (so dev + CI keep working with the dev placeholder secrets).
 *
 * The validator caches its result — we reset it before every test via
 * `_resetEnvAssertion()` so each test starts clean.
 */

const VALID_SECRET = 'a'.repeat(40);
const VALID_ORIGIN = 'https://app.eazepay.com';

describe('lib/env — assertProdEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetEnvAssertion();
    // Strip the variables under test; restore at the end so other
    // tests in the suite don't see our mutations.
    delete process.env.DEMO_COOKIE_SECRET;
    delete process.env.ACCOUNT_COOKIE_SECRET;
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    delete process.env.MICAMP_WEBHOOK_SECRET;
    delete process.env.HIGHSALE_WEBHOOK_SECRET;
    delete process.env.ALLOWED_ORIGINS;
    // SEC-EZ-002: the prod boot guard refuses when this is truthy — keep
    // it unset by default so the unrelated prod-throw tests aren't
    // tripped by a stray value, and assert the guard explicitly below.
    delete process.env.DEMO_MODE_ENABLED;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('production mode', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
    });

    it('throws when DEMO_COOKIE_SECRET is missing', () => {
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      expect(() => assertProdEnv()).toThrow(/refusing to boot/);
    });

    it('throws when ACCOUNT_COOKIE_SECRET is missing', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      expect(() => assertProdEnv()).toThrow(/refusing to boot/);
    });

    it('does NOT throw when MICAMP_WEBHOOK_SECRET is missing — downgraded to RECOMMENDED', () => {
      // Stub integration: runtime guard in lib/micamp/client.ts already
      // fail-closes on missing secret. Re-promote to REQUIRED when the
      // real partner webhook is wired with their actual signing key.
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      const result = assertProdEnv();
      expect(result.ok).toBe(true);
    });

    it('does NOT throw when HIGHSALE_WEBHOOK_SECRET is missing — downgraded to RECOMMENDED', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      const result = assertProdEnv();
      expect(result.ok).toBe(true);
    });

    it('does NOT throw when ALLOWED_ORIGINS is missing — downgraded to RECOMMENDED', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      const result = assertProdEnv();
      expect(result.ok).toBe(true);
    });

    it('throws when a secret is set but too short', () => {
      process.env.DEMO_COOKIE_SECRET = 'too-short';
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      expect(() => assertProdEnv()).toThrow(/refusing to boot/);
    });

    it('throws when NEXT_PUBLIC_APP_ORIGIN is missing the scheme', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = 'app.eazepay.com'; // missing https://
      expect(() => assertProdEnv()).toThrow(/refusing to boot/);
    });

    it('does not throw when every required var is valid', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      const result = assertProdEnv();
      expect(result.ok).toBe(true);
    });

    it('SEC-209 — throws when MICAMP_WEBHOOK_INSECURE_ALLOW=true in prod', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.MICAMP_WEBHOOK_INSECURE_ALLOW = 'true';
      expect(() => assertProdEnv()).toThrow(/MICAMP_WEBHOOK_INSECURE_ALLOW/);
      delete process.env.MICAMP_WEBHOOK_INSECURE_ALLOW;
    });

    it('SEC-209 — throws when MICAMP_DEV_SKIP_WEBHOOK_SIG=1 in prod', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.MICAMP_DEV_SKIP_WEBHOOK_SIG = '1';
      expect(() => assertProdEnv()).toThrow(/MICAMP_DEV_SKIP_WEBHOOK_SIG/);
      delete process.env.MICAMP_DEV_SKIP_WEBHOOK_SIG;
    });

    it('SEC-209 — does not throw when dev-skip flag is unset / false', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.MICAMP_DEV_SKIP_WEBHOOK_SIG = 'false';
      expect(() => assertProdEnv()).not.toThrow();
      delete process.env.MICAMP_DEV_SKIP_WEBHOOK_SIG;
    });

    // SEC-EZ-002 — DEMO_MODE_ENABLED is intentionally NOT boot-blocked.
    // The demo-auth surface is closed at the auth boundary
    // (isDemoFallbackAllowed() hard-returns false in prod), so the flag is
    // inert for auth. Boot-blocking it would brick the canonical
    // demo/preview deploy, which runs NODE_ENV=production but legitimately
    // sets the flag. These tests pin that boot stays GREEN with the flag on.
    it('SEC-EZ-002 — does NOT throw when DEMO_MODE_ENABLED=true in prod (demo deploy must boot)', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.DEMO_MODE_ENABLED = 'true';
      expect(() => assertProdEnv()).not.toThrow();
      delete process.env.DEMO_MODE_ENABLED;
    });

    it('SEC-EZ-002 — does NOT throw when DEMO_MODE_ENABLED=1 in prod (truthy variants still boot)', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.DEMO_MODE_ENABLED = '1';
      expect(() => assertProdEnv()).not.toThrow();
      delete process.env.DEMO_MODE_ENABLED;
    });

    it('SEC-EZ-002 — does NOT throw when DEMO_MODE_ENABLED=false in prod', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.DEMO_MODE_ENABLED = 'false';
      expect(() => assertProdEnv()).not.toThrow();
      delete process.env.DEMO_MODE_ENABLED;
    });

    it('SEC-EZ-002 — does NOT throw when DEMO_MODE_ENABLED is unset in prod', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      delete process.env.DEMO_MODE_ENABLED;
      expect(() => assertProdEnv()).not.toThrow();
    });

    it('aggregates multiple failures into one error message', () => {
      // All three required vars missing → one throw with all three counted.
      let caught: Error | null = null;
      try {
        assertProdEnv();
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).not.toBeNull();
      expect(caught?.message).toMatch(/3 required env var/);
    });
  });

  describe('non-production mode', () => {
    beforeEach(() => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
    });

    it('does not throw when secrets are missing — dev placeholders kick in', () => {
      expect(() => assertProdEnv()).not.toThrow();
    });

    it('returns ok:false with the list of errors so callers can surface them', () => {
      const result = assertProdEnv();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('returns ok:true when every required var is set', () => {
      process.env.DEMO_COOKIE_SECRET = VALID_SECRET;
      process.env.ACCOUNT_COOKIE_SECRET = VALID_SECRET;
      process.env.NEXT_PUBLIC_APP_ORIGIN = VALID_ORIGIN;
      process.env.MICAMP_WEBHOOK_SECRET = VALID_SECRET;
      process.env.HIGHSALE_WEBHOOK_SECRET = VALID_SECRET;
      process.env.ALLOWED_ORIGINS = VALID_ORIGIN;
      const result = assertProdEnv();
      expect(result.ok).toBe(true);
    });
  });

  describe('idempotency', () => {
    it('caches the result — second call returns the same object', () => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      const first = assertProdEnv();
      const second = assertProdEnv();
      expect(second).toBe(first);
    });
  });
});
