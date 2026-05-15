import { describe, expect, it } from 'vitest';
import { computeSignature, webhookSecretAadContext } from '../src/internal/webhook-signing.js';

/**
 * Smoke tests for the outbound webhook signing primitive.
 *
 * The HMAC contract is shared by the dispatcher and any merchant-side
 * verifier, so the property under test is: given the same inputs, the
 * function returns the same hex string. We also pin the AAD context
 * shape — the PiiVaultService relies on it being a stable object so the
 * GCM auth tag for a ciphertext sealed under endpoint A cannot be
 * lifted onto endpoint B's row.
 */
describe('Webhook signing primitive', () => {
  it('computeSignature is deterministic for known inputs', () => {
    const sig = computeSignature('hunter2', 1_700_000_000, '{"event":"ping"}');
    // Same call again must produce the exact same hex.
    expect(sig).toBe(computeSignature('hunter2', 1_700_000_000, '{"event":"ping"}'));
    // 64 hex chars (SHA-256 digest size).
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different body → different signature', () => {
    const a = computeSignature('hunter2', 1_700_000_000, '{"event":"a"}');
    const b = computeSignature('hunter2', 1_700_000_000, '{"event":"b"}');
    expect(a).not.toBe(b);
  });

  it('AAD context binds to the endpoint id', () => {
    const aad = webhookSecretAadContext('wh_ep_123');
    expect(aad).toEqual({
      scope: 'webhook_endpoint_secret',
      endpointId: 'wh_ep_123',
    });
    // A different endpoint id must produce a different object.
    expect(webhookSecretAadContext('wh_ep_456')).not.toEqual(aad);
  });

  it('different endpointId produces different AAD context', () => {
    // why: the PiiVaultService wraps the signing secret with the AAD as
    // additional-authenticated-data. If two endpoints produced the same
    // AAD object, a ciphertext sealed for endpoint A could be
    // replayed against endpoint B's row. Make sure that path is closed.
    const a = webhookSecretAadContext('wh_ep_alpha');
    const b = webhookSecretAadContext('wh_ep_beta');
    expect(a.endpointId).not.toBe(b.endpointId);
    expect(a).not.toEqual(b);
  });

  it('computeSignature is deterministic across multiple invocations', () => {
    // why: a merchant's verifier re-runs computeSignature on the inbound
    // body. If our implementation introduced any non-deterministic
    // behaviour (timestamps, randomness) every webhook would fail
    // verification.
    const args = ['hunter2', 1_700_000_000, '{"x":1}'] as const;
    const sigs = Array.from({ length: 5 }, () => computeSignature(...args));
    for (const s of sigs) expect(s).toBe(sigs[0]);
  });

  it('signs an empty body cleanly', () => {
    // why: a ping/health webhook can ship `{}` as the body. The signer
    // must not crash, and the digest must still be a 64-hex SHA-256.
    const sig = computeSignature('hunter2', 1_700_000_000, '');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    // And `{}` (a non-empty string but semantically empty payload) too.
    const sigEmptyObj = computeSignature('hunter2', 1_700_000_000, '{}');
    expect(sigEmptyObj).toMatch(/^[0-9a-f]{64}$/);
    expect(sigEmptyObj).not.toBe(sig);
  });

  it('tampered body produces a different signature', () => {
    // why: the whole point of the HMAC is body integrity. Flip one
    // character and the signature must change — verifies the digest is
    // body-sensitive end-to-end.
    const original = computeSignature('hunter2', 1_700_000_000, '{"amt":100}');
    const tampered = computeSignature('hunter2', 1_700_000_000, '{"amt":900}');
    expect(tampered).not.toBe(original);
  });

  it('different secret produces a different signature for same body', () => {
    // why: rotating an endpoint's secret must invalidate previously
    // captured signatures. Different keys → different HMAC.
    const body = '{"event":"ping"}';
    const ts = 1_700_000_000;
    const a = computeSignature('secret-a', ts, body);
    const b = computeSignature('secret-b', ts, body);
    expect(a).not.toBe(b);
  });

  it('different timestamp produces a different signature for same body', () => {
    // why: this is the replay-protection contract. The merchant rejects
    // requests with a stale timestamp; we make sure the signature itself
    // covers the timestamp so an attacker can't keep an old signature
    // valid by replaying the body alone.
    const body = '{"event":"ping"}';
    const a = computeSignature('hunter2', 1_700_000_000, body);
    const b = computeSignature('hunter2', 1_700_000_001, body);
    expect(a).not.toBe(b);
  });
});
