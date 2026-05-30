/**
 * SEC-EZ-001 — inbound lender webhook / quote-callback HMAC now verifies
 * against a per-lender secret read from env, with NO hardcoded fallback,
 * and FAILS CLOSED in production when the secret is unset.
 *
 * Threat being closed: pre-fix, `verifySignature()` fell back to a
 * source-committed constant (`demo_shared_secret_replace_in_prod`) and
 * no caller ever passed a real secret — so production verified every
 * inbound `loan.funded` / `loan.defaulted` / quote event against a
 * public key. Anyone with the git history could forge those events.
 *
 * These specs prove:
 *   (a) a signature produced with the env secret is ACCEPTED;
 *   (b) a signature produced with the OLD committed MOCK_SECRET is
 *       REJECTED (the leaked key no longer verifies);
 *   (c) production + unset secret FAILS CLOSED (never accepted) — the
 *       resolver returns '' and the verifier rejects.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

import { lenderWebhookSecret, verifySignature } from './shared';

// The exact value that used to be committed to source as `MOCK_SECRET`.
// An attacker who scraped git would sign with this. It MUST NOT verify.
const LEAKED_MOCK_SECRET = 'demo_shared_secret_replace_in_prod';

const LENDER_ID = 'lp_buzzpay_prime';
const PER_LENDER_ENV = `LENDER_${LENDER_ID.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_WEBHOOK_SECRET`;

/**
 * Recompute the HMAC-SHA256 hex over `${timestamp}.${nonce}.${body}`
 * using the SAME Web Crypto primitive the verifier uses, so the spec
 * exercises the real comparison path rather than a re-implementation.
 */
async function signHmac(secret: string, timestamp: string, nonce: string, body: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${nonce}.${body}`));
  return [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('SEC-EZ-001 — lender webhook HMAC uses env secret, fail-closed', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    // Clean slate every test so env from one case can't bleed into the
    // next (the resolver reads process.env at call time).
    delete process.env.LENDER_WEBHOOK_SECRET;
    delete process.env[PER_LENDER_ENV];
    delete process.env.REQUIRE_HMAC;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('lenderWebhookSecret() resolution', () => {
    it('prefers the per-lender secret over the shared fallback', () => {
      vi.stubEnv('LENDER_WEBHOOK_SECRET', 'shared-secret-value');
      vi.stubEnv(PER_LENDER_ENV, 'per-lender-secret-value');
      expect(lenderWebhookSecret(LENDER_ID)).toBe('per-lender-secret-value');
    });

    it('falls back to the shared secret when no per-lender override is set', () => {
      vi.stubEnv('LENDER_WEBHOOK_SECRET', 'shared-secret-value');
      expect(lenderWebhookSecret(LENDER_ID)).toBe('shared-secret-value');
    });

    it('returns empty string in production when nothing is configured (fail-closed)', () => {
      vi.stubEnv('NODE_ENV', 'production');
      expect(lenderWebhookSecret(LENDER_ID)).toBe('');
    });

    it('never returns the old committed MOCK_SECRET as a dev fallback', () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(lenderWebhookSecret(LENDER_ID)).not.toBe(LEAKED_MOCK_SECRET);
      // Dev fallback is non-empty so local demo flows still work…
      expect(lenderWebhookSecret(LENDER_ID).length).toBeGreaterThan(0);
    });
  });

  describe('(a) valid signature with the env secret → accepted', () => {
    it('verifies a signature produced with LENDER_WEBHOOK_SECRET', async () => {
      const secret = 'a'.repeat(48); // realistic ≥32-char secret
      vi.stubEnv('LENDER_WEBHOOK_SECRET', secret);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = 'nonce-accept';
      const body = JSON.stringify({ event_type: 'loan.funded', event_id: 'evt_1' });
      const signature = await signHmac(secret, timestamp, nonce, body);

      const result = await verifySignature({
        timestamp,
        nonce,
        signature,
        body,
        secret: lenderWebhookSecret(LENDER_ID),
      });

      expect(result.status).toBe('valid');
    });
  });

  describe('(b) signature against the old committed MOCK_SECRET → rejected', () => {
    it('rejects a forgery signed with the leaked demo_shared_secret_replace_in_prod', async () => {
      // The real configured secret (what the env now holds).
      const realSecret = 'b'.repeat(48);
      vi.stubEnv('LENDER_WEBHOOK_SECRET', realSecret);

      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = 'nonce-forge';
      const body = JSON.stringify({ event_type: 'loan.defaulted', event_id: 'evt_forged' });
      // Attacker signs with the value that was committed to git.
      const forgedSignature = await signHmac(LEAKED_MOCK_SECRET, timestamp, nonce, body);

      const result = await verifySignature({
        timestamp,
        nonce,
        signature: forgedSignature,
        body,
        secret: lenderWebhookSecret(LENDER_ID),
      });

      expect(result.status).toBe('invalid');
    });
  });

  describe('(c) production + unset secret → fail-closed (not accepted)', () => {
    it('rejects with status "invalid" when the resolver yields no secret in prod', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      // No LENDER_WEBHOOK_SECRET / per-lender override set.

      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = 'nonce-prod';
      const body = JSON.stringify({ event_type: 'loan.funded', event_id: 'evt_prod' });
      // Even a "valid-looking" signature can't be trusted: there is no
      // secret to verify against. Sign with the leaked constant to model
      // the worst case (attacker who knows the old key) — still rejected.
      const signature = await signHmac(LEAKED_MOCK_SECRET, timestamp, nonce, body);

      const result = await verifySignature({
        timestamp,
        nonce,
        signature,
        body,
        secret: lenderWebhookSecret(LENDER_ID), // '' in prod
      });

      expect(result.status).toBe('invalid');
      expect(result.status).not.toBe('valid');
      expect(result.status).not.toBe('skipped');
    });

    it('fails closed in prod even when the request omits all signature headers', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const result = await verifySignature({
        timestamp: null,
        nonce: null,
        signature: null,
        body: '{}',
        secret: lenderWebhookSecret(LENDER_ID), // '' in prod
      });

      // The empty-secret reject fires BEFORE the "skipped" (no-headers)
      // path, so an unconfigured prod deploy can never downgrade to the
      // lenient unsigned-allowed branch. 'invalid' is rejected by
      // requireSignatureCheck in EVERY environment.
      expect(result.status).toBe('invalid');
    });
  });
});
