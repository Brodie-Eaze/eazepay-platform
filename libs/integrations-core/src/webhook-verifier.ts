/**
 * WebhookVerifier — shared contract + reference HMAC implementation for
 * inbound webhook signature verification across every integration we
 * own (MiCamp today, HighSale + Milly today, Trutopia next).
 *
 * Why this lives here (and not duplicated per-vendor):
 *
 *   - SEC-002 fail-closed semantics are identical across providers:
 *     timestamp freshness window, constant-time compare, structured
 *     rejection reasons. Pre-refactor, MiCamp and HighSale each carried
 *     their own near-identical 60-line HMAC verifier; any future fix
 *     (e.g. tightening the freshness window after an incident) would
 *     have had to be applied N times and audited for drift.
 *   - The WebhookVerificationResult shape is what route handlers + the
 *     audit log key off. Sharing the type means a new provider cannot
 *     accidentally invent a slightly different `reason` vocabulary that
 *     breaks the dashboard query.
 *   - Future providers that sign differently (e.g. a JWT or a base64
 *     HMAC instead of hex) implement the WebhookVerifier interface
 *     with their own logic — but the result shape stays uniform.
 *
 * NOTE: This module is intentionally pure-crypto. It does NOT read
 * process.env, does NOT log, and does NOT know about provider names.
 * Provider-specific wiring (env, safeLog, the production-load assert)
 * stays in each adapter so adapter-level test isolation is preserved.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { WebhookVerificationResult } from './webhook-verification-result.js';

export interface WebhookVerifier {
  /**
   * Verify a single inbound webhook delivery. Implementations MUST be
   * constant-time on the cryptographic comparison and MUST fail closed
   * (return invalid rather than throw) on any malformed input.
   *
   * @param rawBody          The exact bytes received from the upstream.
   *                         Re-serialising via JSON.parse + stringify
   *                         WILL break HMAC — pass the raw string.
   * @param signatureHeader  Provider-specific signature header value
   *                         (e.g. `t=...,v1=...`). Implementations parse
   *                         their own format.
   */
  verifySignature(rawBody: string, signatureHeader: string): WebhookVerificationResult;
}

/**
 * Tunables for the Stripe-style HMAC verifier. Defaults match what
 * MiCamp + HighSale ship today; future providers can override.
 */
export interface HmacWebhookVerifierOptions {
  /**
   * Shared secret. When empty, every verify returns
   * `{ valid: false, reason: 'missing_secret' }` — adapters are
   * responsible for refusing to load if their secret is unset in
   * production (SEC-002).
   */
  secret: string;
  /**
   * Replay window in seconds. Mirrors Stripe's `tolerance` default.
   * 300s is the production setting today.
   */
  freshnessSeconds?: number;
  /**
   * Override Date.now-style clock for deterministic tests. Returns
   * seconds since epoch. Defaults to `() => Date.now() / 1000`.
   */
  now?: () => number;
}

const DEFAULT_FRESHNESS_SECONDS = 300;

/**
 * Reference implementation of the Stripe-style `t=<unix>,v1=<hex>`
 * HMAC-SHA256 verifier. This is the exact algorithm MiCamp + HighSale
 * use; extracted here so the next provider (Trutopia) gets it for free
 * and any hardening fix lands once.
 *
 * Fail-closed branches:
 *   - missing_secret      -> caller MUST guard with their own env check;
 *                            this returns invalid rather than crash.
 *   - missing_signature   -> header empty / absent.
 *   - malformed           -> header present but unparseable.
 *   - stale_timestamp     -> timestamp outside freshness window.
 *   - bad_signature       -> length mismatch OR timingSafeEqual fails.
 */
export function createHmacWebhookVerifier(opts: HmacWebhookVerifierOptions): WebhookVerifier {
  const freshnessSeconds = opts.freshnessSeconds ?? DEFAULT_FRESHNESS_SECONDS;
  const now = opts.now ?? (() => Date.now() / 1000);
  const secret = opts.secret;

  return {
    verifySignature(rawBody: string, signatureHeader: string): WebhookVerificationResult {
      if (!secret) {
        return { valid: false, reason: 'missing_secret' };
      }
      if (!signatureHeader) {
        return { valid: false, reason: 'missing_signature' };
      }

      const parts = Object.fromEntries(
        signatureHeader.split(',').map((kv) => {
          const [k, v] = kv.split('=');
          return [k?.trim() ?? '', v?.trim() ?? ''];
        }),
      );
      const timestamp = parts.t;
      const signature = parts.v1;
      if (!timestamp || !signature) {
        return { valid: false, reason: 'malformed' };
      }

      const tsNum = Number(timestamp);
      if (!Number.isFinite(tsNum)) {
        return { valid: false, reason: 'malformed' };
      }
      if (Math.abs(now() - tsNum) > freshnessSeconds) {
        return { valid: false, reason: 'stale_timestamp' };
      }

      const payload = `${timestamp}.${rawBody}`;
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      if (expected.length !== signature.length) {
        return { valid: false, reason: 'bad_signature' };
      }
      let expectedBuf: Buffer;
      let sigBuf: Buffer;
      try {
        expectedBuf = Buffer.from(expected, 'hex');
        sigBuf = Buffer.from(signature, 'hex');
      } catch {
        return { valid: false, reason: 'malformed' };
      }
      if (expectedBuf.length !== sigBuf.length) {
        return { valid: false, reason: 'bad_signature' };
      }
      return timingSafeEqual(expectedBuf, sigBuf)
        ? { valid: true }
        : { valid: false, reason: 'bad_signature' };
    },
  };
}
