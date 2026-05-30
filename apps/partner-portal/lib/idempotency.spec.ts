import { describe, expect, it } from 'vitest';
import { deriveImplicitKey, hashRequestBody, newIdempotencyKey } from './idempotency';

describe('lib/idempotency', () => {
  it('hashRequestBody is stable across calls', () => {
    const a = hashRequestBody({ b: 2, a: 1 });
    const b = hashRequestBody({ b: 2, a: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('hashRequestBody differs when body differs', () => {
    expect(hashRequestBody({ x: 1 })).not.toBe(hashRequestBody({ x: 2 }));
  });

  it('deriveImplicitKey is stable, UUID-shaped, and differs by input', () => {
    const k1 = deriveImplicitKey(['partner_a', 'body_hash_1']);
    const k2 = deriveImplicitKey(['partner_a', 'body_hash_1']);
    const k3 = deriveImplicitKey(['partner_b', 'body_hash_1']);
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('newIdempotencyKey returns a UUIDv4-shaped value', () => {
    expect(newIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
