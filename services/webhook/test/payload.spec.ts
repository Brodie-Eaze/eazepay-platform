import { describe, expect, it } from 'vitest';
import { stableJsonSha256 } from '@eazepay/shared-utils';

/**
 * Webhook payload contract: payloads must hash deterministically
 * regardless of object key order, because the signature is computed
 * over the JSON-stringified body. This test pins the property other
 * services rely on.
 */
describe('Webhook payload determinism', () => {
  it('same payload, different key order → same hash', () => {
    const a = { applicationId: 'app-1', offerCount: 3, lender: 'BuzzPay' };
    const b = { lender: 'BuzzPay', offerCount: 3, applicationId: 'app-1' };
    expect(stableJsonSha256(a)).toBe(stableJsonSha256(b));
  });

  it('different value → different hash', () => {
    const a = { applicationId: 'app-1', offerCount: 3 };
    const b = { applicationId: 'app-2', offerCount: 3 };
    expect(stableJsonSha256(a)).not.toBe(stableJsonSha256(b));
  });
});
