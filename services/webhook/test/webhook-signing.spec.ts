import { describe, expect, it } from 'vitest';
import {
  computeSignature,
  webhookSecretAadContext,
} from '../src/internal/webhook-signing.js';

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
    expect(sig).toBe(
      computeSignature('hunter2', 1_700_000_000, '{"event":"ping"}'),
    );
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
});
