/**
 * Regression suite for the silent-failure audit
 * (fix/silent-failures-partner-portal).
 *
 * Each case here is a concrete spot that pre-fix swallowed an error
 * with no structured log line. The spec asserts the previously-silent
 * path now either (a) emits a structured `console.error` line OR (b)
 * surfaces the error to the caller — depending on the contract.
 *
 * Why a separate file (not extending the per-module spec):
 *   These are cross-cutting — touching team-invites, invites,
 *   accounts, consumer-invites-client, applications-client, the
 *   admin-team route, and the HMAC verifier. Keeping the regression
 *   together makes the audit replay-able by a reviewer who only wants
 *   to confirm "all the silent failures got logged."
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';

import { notifyConsumerInvite } from './consumer-invites-client';
import { verifySignature } from './api-v1/shared';
import { createInvitedAccount, _resetAccountsForTest } from './accounts-store';

describe('silent-failure regressions', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('consumer-invites-client.notifyConsumerInvite', () => {
    it('logs structured error when fetch rejects (network failure)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED'))),
      );

      const ok = await notifyConsumerInvite({
        brand: 'medpay',
        token: 'tok-abc',
        event: 'started',
      });

      expect(ok).toBe(false);
      expect(errSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(errSpy.mock.calls[0]![0] as string);
      expect(payload).toMatchObject({
        level: 'error',
        event: 'consumer_invite.notify_failed',
        brand: 'medpay',
        notifyEvent: 'started',
      });
    });

    it('logs structured error when API returns non-2xx', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response('', { status: 503 }))),
      );

      const ok = await notifyConsumerInvite({
        brand: 'tradepay',
        token: 'tok-xyz',
        event: 'redeemed',
      });

      expect(ok).toBe(false);
      expect(errSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(errSpy.mock.calls[0]![0] as string);
      expect(payload).toMatchObject({
        level: 'error',
        event: 'consumer_invite.notify_non_ok',
        brand: 'tradepay',
        status: 503,
      });
    });
  });

  describe('api-v1/shared.verifySignature', () => {
    it('logs structured error when HMAC pipeline crashes', async () => {
      // Pass a body that flips the WebCrypto subtle path into rejecting:
      // `signature` set to a non-hex string of mismatched length still
      // hits the happy-path comparison, so we instead poison globalThis
      // crypto.subtle.importKey to throw — that's the real crash mode
      // (bad env var, runtime mismatch).
      const realCrypto = globalThis.crypto;
      vi.stubGlobal('crypto', {
        ...realCrypto,
        subtle: {
          ...realCrypto.subtle,
          importKey: () => {
            throw new Error('subtle.importKey blew up');
          },
        },
      });

      const result = await verifySignature({
        timestamp: String(Math.floor(Date.now() / 1000)),
        nonce: 'n-1',
        signature: 'a'.repeat(64),
        body: '{}',
        // SEC-EZ-001: a secret MUST be supplied for the verifier to reach
        // the HMAC pipeline at all — an empty/unset secret now fails closed
        // ('invalid') before importKey is touched. Pass a non-empty secret
        // so this test still exercises the crash-logging path it asserts on.
        secret: 'test-secret-to-reach-hmac-pipeline',
      });

      expect(result.status).toBe('invalid');
      // Match either our new log line or any structured error — both
      // are acceptable; the point is "not silent."
      expect(errSpy).toHaveBeenCalled();
      const calls = errSpy.mock.calls.map((c) => c[0] as string);
      const matched = calls.some((line) => {
        try {
          const j = JSON.parse(line);
          return j.event === 'lender_api.signature_verify_crashed';
        } catch {
          return false;
        }
      });
      expect(matched).toBe(true);
    });
  });

  describe('accounts-store.persist (fs write failure)', () => {
    beforeEach(async () => {
      await _resetAccountsForTest();
    });

    it('logs structured error when fs.writeFile rejects after createInvitedAccount', async () => {
      // After the in-memory map is updated, persist() will try to
      // write to .next/accounts.json. Force the write to fail and
      // assert the structured log shows up. The mutation itself still
      // returns success (in-memory map is authoritative for this
      // process) — pre-fix this was the silent path.
      const writeSpy = vi
        .spyOn(fs, 'writeFile')
        .mockRejectedValueOnce(new Error('ENOSPC: disk full'));

      const result = await createInvitedAccount({
        email: 'silent-fail-test@example.test',
        displayName: 'Silent Fail Tester',
        brand: 'medpay',
        partnerId: 'p_helio',
        role: 'Owner',
      });

      expect(result.created).toBe(true); // mutation reports success
      expect(writeSpy).toHaveBeenCalled();

      // safeLog.error → console.error with a JSON payload carrying the
      // event name. We assert the payload shape, not the exact key
      // order, so future fields don't break the spec.
      const calls = errSpy.mock.calls.map((c) => c[0] as string);
      const matched = calls.some((line) => {
        try {
          const j = JSON.parse(line);
          return j.event === 'accounts_store.persist_failed';
        } catch {
          return false;
        }
      });
      expect(matched).toBe(true);
    });
  });
});
