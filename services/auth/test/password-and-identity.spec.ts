/**
 * Characterization tests for the password-handling surfaces of the auth
 * service: Argon2id hash + verify via {@link LocalIdentityAdapter}, and
 * the HIBP fail-open behaviour of {@link PasswordPolicyService}.
 *
 * External dependencies (Prisma, the global `fetch`) are mocked at the
 * port boundary so the assertions cover the auth code's branches
 * without dragging in DB or network state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hash as argon2Hash } from '@node-rs/argon2';
import { LocalIdentityAdapter } from '../src/adapters/local-identity.adapter.js';
import { PasswordPolicyService } from '../src/internal/password-policy.service.js';
import type { UserId } from '@eazepay/shared-types';

type UserRow = {
  id: string;
  email: string | null;
  phoneE164: string | null;
  passwordHash: string;
  status: string;
};

function makePrismaFake(initial: UserRow[] = []) {
  const users: UserRow[] = [...initial];
  const audit: Array<Record<string, unknown>> = [];

  const prisma = {
    user: {
      create: async ({
        data,
        select,
      }: {
        data: Partial<UserRow>;
        select?: unknown;
      }) => {
        const collision = users.find(
          (u) =>
            (data.email && u.email === data.email) ||
            (data.phoneE164 && u.phoneE164 === data.phoneE164),
        );
        if (collision) {
          const err = new Error('unique constraint failed') as Error & { code?: string };
          err.code = 'P2002';
          throw err;
        }
        const row: UserRow = {
          id: data.id ?? `user-${users.length + 1}`,
          email: data.email ?? null,
          phoneE164: data.phoneE164 ?? null,
          passwordHash: data.passwordHash!,
          status: data.status ?? 'pending_verification',
        };
        users.push(row);
        void select;
        return { id: row.id };
      },
      findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: unknown }) => {
        void select;
        return (
          users.find((u) => {
            if ('email' in where && where.email !== undefined) return u.email === where.email;
            if ('phoneE164' in where && where.phoneE164 !== undefined)
              return u.phoneE164 === where.phoneE164;
            return false;
          }) ?? null
        );
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<UserRow>;
      }) => {
        const row = users.find((u) => u.id === where.id);
        if (!row) {
          const err = new Error('not found') as Error & { code?: string };
          err.code = 'P2025';
          throw err;
        }
        Object.assign(row, data);
        return row;
      },
    },
    auditOutbox: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audit.push(data);
        return { id: `audit-${audit.length}` };
      },
    },
  };

  return { prisma, users, audit };
}

describe('LocalIdentityAdapter.signUp + checkPassword — Argon2id round-trip', () => {
  it('signUp creates a row and returns the new userId', async () => {
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    const result = await adapter.signUp({
      email: 'alice@example.com',
      password: 'corr3ct-horse-battery-staple!',
    });
    expect(result.userId).toBe(env.users[0]!.id);
    expect(env.users[0]!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('signUp without email OR phone throws identifier_required', async () => {
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await expect(
      adapter.signUp({ password: 'corr3ct-horse-battery-staple!' }),
    ).rejects.toMatchObject({ problem: { code: 'identifier_required' } });
  });

  it('signUp surfaces P2002 as account_exists without disclosing which field collided', async () => {
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await adapter.signUp({ email: 'dup@example.com', password: 'corr3ct-horse-battery-staple!' });
    await expect(
      adapter.signUp({ email: 'dup@example.com', password: 'another-strong-password-9' }),
    ).rejects.toMatchObject({ problem: { code: 'account_exists' } });
  });

  it('checkPassword returns the userId on a correct password', async () => {
    const passwordHash = await argon2Hash('the-right-password', {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const env = makePrismaFake([
      {
        id: 'user-1',
        email: 'alice@example.com',
        phoneE164: null,
        passwordHash,
        status: 'active',
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    const userId = await adapter.checkPassword({
      identifier: 'alice@example.com',
      password: 'the-right-password',
    });
    expect(userId).toBe('user-1');
  });

  it('checkPassword rejects a wrong password with invalid_credentials', async () => {
    const passwordHash = await argon2Hash('the-right-password', {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const env = makePrismaFake([
      {
        id: 'user-1',
        email: 'alice@example.com',
        phoneE164: null,
        passwordHash,
        status: 'active',
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await expect(
      adapter.checkPassword({ identifier: 'alice@example.com', password: 'WRONG' }),
    ).rejects.toMatchObject({ problem: { code: 'invalid_credentials' } });
  });

  it('checkPassword on a non-existent identifier ALSO returns invalid_credentials (no enumeration)', async () => {
    const env = makePrismaFake([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await expect(
      adapter.checkPassword({ identifier: 'ghost@example.com', password: 'anything' }),
    ).rejects.toMatchObject({ problem: { code: 'invalid_credentials' } });
  });

  it('checkPassword on a locked account returns account_unavailable', async () => {
    const passwordHash = await argon2Hash('pw', {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const env = makePrismaFake([
      {
        id: 'user-1',
        email: 'locked@example.com',
        phoneE164: null,
        passwordHash,
        status: 'locked',
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await expect(
      adapter.checkPassword({ identifier: 'locked@example.com', password: 'pw' }),
    ).rejects.toMatchObject({ problem: { code: 'account_unavailable' } });
  });

  it('setPassword swaps the Argon2id hash on the user row', async () => {
    const oldHash = await argon2Hash('old', {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    const env = makePrismaFake([
      {
        id: 'user-1',
        email: 'a@b.com',
        phoneE164: null,
        passwordHash: oldHash,
        status: 'active',
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new LocalIdentityAdapter(env.prisma as any);
    await adapter.setPassword({ userId: 'user-1' as UserId, newPassword: 'brand-new-password-1' });
    expect(env.users[0]!.passwordHash).not.toBe(oldHash);
    expect(env.users[0]!.passwordHash).toMatch(/^\$argon2id\$/);
  });
});

describe('PasswordPolicyService.checkBreached — SEC-015 HIBP', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Each test installs its own fetch stub.
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('flags a breached password whose suffix appears in the HIBP range response', async () => {
    // 'password' → SHA1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix=5BAA6, suffix=1E4C9B93F3F0682250B6CF8331B7EE68FD8
    globalThis.fetch = vi.fn(async () =>
      new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345\r\nDEADBEEF:1\r\n', {
        status: 200,
      }),
    ) as typeof fetch;
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new PasswordPolicyService(env.prisma as any);
    const result = await svc.checkBreached('password');
    expect(result.breached).toBe(true);
    expect(result.count).toBe(12345);
  });

  it('returns not-breached when the suffix is absent from the response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1\r\n', { status: 200 }),
    ) as typeof fetch;
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new PasswordPolicyService(env.prisma as any);
    const result = await svc.checkBreached('a-strong-novel-password-xyz-9876');
    expect(result.breached).toBe(false);
    expect(result.count).toBe(0);
  });

  it('fails open (breached=false) and writes a hibp_unchecked audit row on HTTP non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('', { status: 503 })) as typeof fetch;
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new PasswordPolicyService(env.prisma as any);
    const result = await svc.checkBreached('anything');
    expect(result.breached).toBe(false);
    expect(env.audit).toHaveLength(1);
    expect(env.audit[0]!.action).toBe('risk_signal.hibp_unchecked');
  });

  it('fails open (breached=false) on network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new PasswordPolicyService(env.prisma as any);
    const result = await svc.checkBreached('anything');
    expect(result.breached).toBe(false);
    expect(env.audit).toHaveLength(1);
    expect(env.audit[0]!.action).toBe('risk_signal.hibp_unchecked');
  });
});

// ─────────────────────────────────────────────────────────────────────
//  Pending behaviours — not yet implemented in services/auth/.
//
//  The brief asks for tests covering account lockout, CSRF token
//  mint/verify, welcome + reset token consume, and demo-session origin
//  allow-listing. Searching services/auth/ at the time of writing
//  surfaces NONE of those subsystems — they live elsewhere in the
//  monorepo (likely apps/api or services/user) and are out of scope for
//  this worktree. We leave the test names in place so the gap is
//  searchable.
// ─────────────────────────────────────────────────────────────────────

describe('Pending — not implemented in services/auth/ yet', () => {
  it.todo('account lockout: N failed login attempts → user.status=locked for the lockout window');
  it.todo('CSRF token mint + verify: round-trip, expiry, tamper rejection');
  it.todo('welcome token consume: atomic single-use (cross-check with PR #151 spec)');
  it.todo('reset token consume: atomic single-use, replay rejection');
  it.todo('demo session creation: origin allowlist + master gating per SEC-103/SEC-109');
});
