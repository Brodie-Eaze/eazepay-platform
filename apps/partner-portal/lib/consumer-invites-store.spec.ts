import { describe, expect, it } from 'vitest';
import {
  createConsumerInvite,
  getConsumerInvite,
  redeemConsumerInvite,
} from './consumer-invites-store';

/**
 * Partner-scoped consumer invite store smoke tests.
 *
 * The store backs the consumer-application flow that a partner
 * salesperson mints from inside the partner portal. Three things have
 * to be true for the demo flow to be safe:
 *
 *   1. Every mint gets a fresh, unique token (the URL `?invite=` value).
 *   2. Expiry math matches what we tell partners in the UI: 24h means
 *      now + 24*3600s, 7d means now + 7*24*3600s.
 *   3. Redeem is idempotent — bouncing on the consumer success page
 *      twice must not corrupt the row.
 *
 * The store persists to `.next/consumer-invites.json` on a real disk
 * but module-scope `Map` is the read path inside one Node lifetime, so
 * these specs don't need a fixture clean-up beyond unique tokens.
 */
describe('consumer invites store', () => {
  const baseInput = {
    partnerId: 'p_helio',
    brand: 'medpay' as const,
    salespersonEmail: 'rep@helio.example',
  };

  it('createConsumerInvite mints a UUID-shaped token', async () => {
    const inv = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    // why: UUID v4 hex pattern. We assert the shape, not equality, so
    // the test is stable across runs.
    expect(inv.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(inv.partnerId).toBe('p_helio');
    expect(inv.brand).toBe('medpay');
    expect(inv.status).toBe('active');
    expect(inv.applicationId).toBeNull();
    expect(inv.inviteUrl).toBe(`/apply/medpay?invite=${inv.token}`);
  });

  it('createConsumerInvite produces unique tokens across calls', async () => {
    // why: token collisions would let one consumer hijack another's
    // application. randomUUID's collision domain is astronomically
    // large, but we pin the property under test.
    const a = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    const b = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    const c = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    const set = new Set([a.token, b.token, c.token]);
    expect(set.size).toBe(3);
  });

  it('expiry stamping: 24h adds 24*3600*1000 ms ± a small window', async () => {
    const before = Date.now();
    const inv = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    const after = Date.now();
    const expiresAtMs = Date.parse(inv.expiresAt);
    // why: window math — the createdAt timestamp is `now`, captured
    // somewhere between `before` and `after`. So expiresAt must sit in
    // [before + 24h, after + 24h].
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 24 * 3_600_000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 24 * 3_600_000);
  });

  it('expiry stamping: 7d (168h) adds 168*3600*1000 ms', async () => {
    const before = Date.now();
    const inv = await createConsumerInvite({ ...baseInput, expiryHours: 168 });
    const after = Date.now();
    const expiresAtMs = Date.parse(inv.expiresAt);
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + 168 * 3_600_000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + 168 * 3_600_000);
  });

  it('getConsumerInvite returns null for an unknown token', async () => {
    // why: callers (the consumer apply page) need a clean null instead
    // of a thrown error, so the page can render an "invite not found"
    // empty state rather than a 500.
    const got = await getConsumerInvite('not-a-real-token-uuid-zzz');
    expect(got).toBeNull();
  });

  it('getConsumerInvite returns the same record we just minted', async () => {
    const inv = await createConsumerInvite({
      ...baseInput,
      expiryHours: 1,
      consumer: { firstName: 'Casey' },
    });
    const got = await getConsumerInvite(inv.token);
    expect(got).not.toBeNull();
    expect(got!.token).toBe(inv.token);
    expect(got!.consumerFirstName).toBe('Casey');
  });

  it('redeemConsumerInvite is idempotent — second redeem is a no-op', async () => {
    // why: the consumer can land on the success page twice (refresh,
    // back button, push notification re-open). We must not corrupt the
    // row or flip back to active. Terminal-state guarantee.
    const inv = await createConsumerInvite({ ...baseInput, expiryHours: 24 });
    const first = await redeemConsumerInvite(inv.token);
    expect(first?.status).toBe('redeemed');
    const second = await redeemConsumerInvite(inv.token);
    expect(second?.status).toBe('redeemed');
    expect(second?.token).toBe(inv.token);
  });

  it('redeemConsumerInvite returns null for unknown tokens', async () => {
    const got = await redeemConsumerInvite('not-a-real-token-uuid-zzz');
    expect(got).toBeNull();
  });
});
