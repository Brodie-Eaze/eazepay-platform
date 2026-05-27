import { describe, expect, it, beforeEach } from 'vitest';
import {
  mintWelcomeToken,
  consumeWelcomeToken,
  __resetWelcomeTokensForTests,
} from './welcome-tokens';

/**
 * SEC-201 — welcome-token lifecycle.
 *
 * The DB-backed path is unit-tested implicitly via the contract
 * (mint → consume → null-on-replay). These tests exercise the
 * in-memory fallback that runs in `next dev` and Railway-preview
 * deployments without DATABASE_URL — same surface contract.
 */
describe('welcome-tokens (in-memory fallback)', () => {
  beforeEach(() => {
    __resetWelcomeTokensForTests();
  });

  it('mints a 64-char hex token', async () => {
    const token = await mintWelcomeToken('user-1', 'welcome');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two mints for the same user return different tokens', async () => {
    const a = await mintWelcomeToken('user-1', 'welcome');
    const b = await mintWelcomeToken('user-1', 'welcome');
    expect(a).not.toEqual(b);
  });

  it('happy path: consume returns the user id and kind', async () => {
    const token = await mintWelcomeToken('user-7', 'welcome');
    const out = await consumeWelcomeToken(token);
    expect(out).toEqual({ userId: 'user-7', kind: 'welcome' });
  });

  it('single-use: second consume of the same token returns null', async () => {
    const token = await mintWelcomeToken('user-7', 'welcome');
    await consumeWelcomeToken(token);
    const replay = await consumeWelcomeToken(token);
    expect(replay).toBeNull();
  });

  it('unknown token returns null', async () => {
    const out = await consumeWelcomeToken('a'.repeat(64));
    expect(out).toBeNull();
  });

  it('empty / non-string token returns null without throwing', async () => {
    expect(await consumeWelcomeToken('')).toBeNull();
    // @ts-expect-error — adversarial input
    expect(await consumeWelcomeToken(null)).toBeNull();
    // @ts-expect-error — adversarial input
    expect(await consumeWelcomeToken(123)).toBeNull();
  });

  it('reset kind is supported and round-trips', async () => {
    const token = await mintWelcomeToken('user-9', 'reset');
    const out = await consumeWelcomeToken(token);
    expect(out).toEqual({ userId: 'user-9', kind: 'reset' });
  });
});
