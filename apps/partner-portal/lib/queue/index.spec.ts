import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

/**
 * Spec for the queue substrate (Task #50).
 *
 * Covers the `hasQueue()` graceful-degradation contract and the
 * `getConnection()` precondition. A live Redis test is NOT in scope
 * — that's covered by the integration suite behind a flag.
 *
 * Note: we vi.mock ioredis so importing the module doesn't try to
 * resolve a real socket. The IORedis ctor is a class; the mock just
 * captures its arguments.
 */

vi.mock('ioredis', () => {
  return {
    default: class FakeRedis {
      url: string;
      options: unknown;
      constructor(url: string, options: unknown) {
        this.url = url;
        this.options = options;
      }
      // closeConnection awaits `.quit()` so the test must not block.
      async quit(): Promise<void> {
        return;
      }
    },
  };
});

describe('queue/index — hasQueue', () => {
  const ORIGINAL = process.env.REDIS_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = ORIGINAL;
    }
    vi.resetModules();
    // Clear our globalThis stash between tests so the singleton
    // resets cleanly.
    const g = globalThis as { __ezpRedis?: unknown };
    g.__ezpRedis = undefined;
  });

  beforeEach(() => {
    const g = globalThis as { __ezpRedis?: unknown };
    g.__ezpRedis = undefined;
  });

  it('returns false when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const mod = await import('./index');
    expect(mod.hasQueue()).toBe(false);
  });

  it('returns true when REDIS_URL is set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const mod = await import('./index');
    expect(mod.hasQueue()).toBe(true);
  });

  it('getConnection throws when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const mod = await import('./index');
    expect(() => mod.getConnection()).toThrow(/REDIS_URL is not set/);
  });

  it('getConnection caches the IORedis instance on the globalThis singleton', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const mod = await import('./index');
    const a = mod.getConnection();
    const b = mod.getConnection();
    expect(a).toBe(b);
  });

  it('closeConnection clears the singleton + tolerates a missing connection', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const mod = await import('./index');
    mod.getConnection(); // open
    await mod.closeConnection();
    // Calling again must not throw — empty close is a no-op.
    await mod.closeConnection();
    // After close, the next getConnection creates a fresh instance.
    const fresh = mod.getConnection();
    expect(fresh).toBeDefined();
  });
});
