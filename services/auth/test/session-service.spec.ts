/**
 * Characterization tests for {@link SessionService}.
 *
 * Driven against an in-memory Prisma fake so the tests can prove the
 * exact branching of `rotateAtomic` (SEC-011) — replay detection,
 * device-mismatch, expiry — without standing up Postgres. The fake's
 * `$transaction` is a passthrough; correctness of *atomicity* is a
 * Prisma concern, what we characterise here is the sequence of writes
 * the service issues against the client.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ProblemError } from '@eazepay/shared-utils';
import { SessionService } from '../src/internal/session.service.js';
import type { SessionId, UserId } from '@eazepay/shared-types';

type SessionRow = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

function makePrismaFake() {
  const sessions: SessionRow[] = [];
  const audit: Array<Record<string, unknown>> = [];

  const sessionApi = {
    create: async ({ data, select }: { data: Partial<SessionRow>; select?: unknown }) => {
      const row: SessionRow = {
        id: (data.id as string) ?? `sess-${sessions.length + 1}`,
        userId: data.userId as string,
        refreshTokenHash: data.refreshTokenHash as string,
        expiresAt: data.expiresAt as Date,
        revokedAt: (data.revokedAt as Date | null | undefined) ?? null,
        deviceId: (data.deviceId as string) ?? null,
        ipAddress: (data.ipAddress as string) ?? null,
        userAgent: (data.userAgent as string) ?? null,
      };
      sessions.push(row);
      void select;
      return { id: row.id };
    },
    findFirst: async ({
      where,
      select,
    }: {
      where: { refreshTokenHash: string };
      select?: unknown;
    }) => {
      void select;
      return sessions.find((s) => s.refreshTokenHash === where.refreshTokenHash) ?? null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<SessionRow> }) => {
      const row = sessions.find((s) => s.id === where.id);
      if (!row) throw new Error('session not found');
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { userId: string; revokedAt: null | { equals: null }; expiresAt?: { gt: Date } };
      data: Partial<SessionRow>;
    }) => {
      let count = 0;
      for (const s of sessions) {
        if (s.userId !== where.userId) continue;
        if (s.revokedAt !== null) continue;
        if (where.expiresAt && s.expiresAt.getTime() <= where.expiresAt.gt.getTime()) continue;
        Object.assign(s, data);
        count += 1;
      }
      return { count };
    },
  };

  const auditApi = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      audit.push(data);
      return { id: `audit-${audit.length}` };
    },
  };

  const prisma = {
    session: sessionApi,
    auditOutbox: auditApi,
    $transaction: async <T>(cb: (tx: typeof prisma) => Promise<T>): Promise<T> => cb(prisma),
  };

  return { prisma, sessions, audit };
}

const USER_A = '00000000-0000-4000-8000-00000000aaaa' as UserId;
const DEVICE_A = 'device-aaaaaaaa';

describe('SessionService.create', () => {
  it('persists the session row with the supplied fields', async () => {
    const { prisma, sessions } = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new SessionService(prisma as any);
    const id = await svc.create({
      userId: USER_A,
      refreshTokenHash: 'hash-1',
      refreshTokenExpiresAt: new Date(Date.now() + 60_000),
      deviceId: DEVICE_A,
      ipAddress: '203.0.113.7',
      userAgent: 'vitest/1.0',
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(id);
    expect(sessions[0]!.deviceId).toBe(DEVICE_A);
    expect(sessions[0]!.ipAddress).toBe('203.0.113.7');
    expect(sessions[0]!.userAgent).toBe('vitest/1.0');
  });
});

describe('SessionService.rotateAtomic — SEC-011', () => {
  let env: ReturnType<typeof makePrismaFake>;
  let svc: SessionService;

  beforeEach(() => {
    env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc = new SessionService(env.prisma as any);
  });

  async function seedLive(overrides: Partial<SessionRow> = {}): Promise<SessionRow> {
    await env.prisma.session.create({
      data: {
        id: 'old-session',
        userId: USER_A,
        refreshTokenHash: 'old-hash',
        expiresAt: new Date(Date.now() + 60_000),
        deviceId: DEVICE_A,
        ...overrides,
      },
    });
    return env.sessions[env.sessions.length - 1]!;
  }

  it('happy path: revokes old, creates new, writes auth.session.rotated audit row', async () => {
    await seedLive();
    const newExpiresAt = new Date(Date.now() + 120_000);
    const result = await svc.rotateAtomic({
      refreshTokenHash: 'old-hash',
      deviceId: DEVICE_A,
      newSessionId: 'new-session' as SessionId,
      newRefreshTokenHash: 'new-hash',
      newRefreshTokenExpiresAt: newExpiresAt,
    });

    expect(result.oldSessionId).toBe('old-session');
    expect(result.newSessionId).toBe('new-session');
    expect(result.userId).toBe(USER_A);

    const oldRow = env.sessions.find((s) => s.id === 'old-session')!;
    const newRow = env.sessions.find((s) => s.id === 'new-session')!;
    expect(oldRow.revokedAt).not.toBeNull();
    expect(newRow.revokedAt).toBeNull();
    expect(newRow.refreshTokenHash).toBe('new-hash');

    expect(env.audit).toHaveLength(1);
    expect(env.audit[0]!.action).toBe('auth.session.rotated');
    expect(env.audit[0]!.targetId).toBe('new-session');
  });

  it('rejects an unknown refresh token hash with invalid_refresh', async () => {
    await expect(
      svc.rotateAtomic({
        refreshTokenHash: 'never-issued',
        deviceId: DEVICE_A,
        newSessionId: 'new-session' as SessionId,
        newRefreshTokenHash: 'new-hash',
        newRefreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ problem: { code: 'invalid_refresh', status: 401 } });
  });

  it('replay detection: presenting a refresh token already revoked nukes every live session for the user', async () => {
    await seedLive({ revokedAt: new Date() });
    // A second live session belonging to the same user — should be
    // collateral-revoked on replay.
    await env.prisma.session.create({
      data: {
        id: 'sibling-session',
        userId: USER_A,
        refreshTokenHash: 'sibling-hash',
        expiresAt: new Date(Date.now() + 60_000),
        deviceId: DEVICE_A,
      },
    });

    await expect(
      svc.rotateAtomic({
        refreshTokenHash: 'old-hash',
        deviceId: DEVICE_A,
        newSessionId: 'new-session' as SessionId,
        newRefreshTokenHash: 'new-hash',
        newRefreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ problem: { code: 'refresh_replay_detected', status: 401 } });

    const sibling = env.sessions.find((s) => s.id === 'sibling-session')!;
    expect(sibling.revokedAt).not.toBeNull();
  });

  it('rejects when the refresh token has expired', async () => {
    await seedLive({ expiresAt: new Date(Date.now() - 1_000) });
    await expect(
      svc.rotateAtomic({
        refreshTokenHash: 'old-hash',
        deviceId: DEVICE_A,
        newSessionId: 'new-session' as SessionId,
        newRefreshTokenHash: 'new-hash',
        newRefreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ problem: { code: 'refresh_expired', status: 401 } });
  });

  it('rejects device mismatch when the bound device id does not match the request', async () => {
    await seedLive({ deviceId: 'device-original' });
    await expect(
      svc.rotateAtomic({
        refreshTokenHash: 'old-hash',
        deviceId: 'device-different',
        newSessionId: 'new-session' as SessionId,
        newRefreshTokenHash: 'new-hash',
        newRefreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ problem: { code: 'device_mismatch', status: 401 } });
    // The old session must NOT have been revoked — device-mismatch is a
    // hard reject, not a replay collateral.
    expect(env.sessions[0]!.revokedAt).toBeNull();
  });

  it('errors are ProblemError instances (not plain Error)', async () => {
    await expect(
      svc.rotateAtomic({
        refreshTokenHash: 'never-issued',
        deviceId: DEVICE_A,
        newSessionId: 'x' as SessionId,
        newRefreshTokenHash: 'y',
        newRefreshTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toBeInstanceOf(ProblemError);
  });
});

describe('SessionService.revoke / revokeAllForUser — SEC-009', () => {
  it('revoke() stamps revokedAt on the named session', async () => {
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new SessionService(env.prisma as any);
    await env.prisma.session.create({
      data: {
        id: 'sess-1',
        userId: USER_A,
        refreshTokenHash: 'h',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await svc.revoke('sess-1' as SessionId);
    expect(env.sessions[0]!.revokedAt).not.toBeNull();
  });

  it('revokeAllForUser() returns the count of live sessions it just revoked', async () => {
    const env = makePrismaFake();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new SessionService(env.prisma as any);
    for (let i = 0; i < 3; i += 1) {
      await env.prisma.session.create({
        data: {
          id: `live-${i}`,
          userId: USER_A,
          refreshTokenHash: `h-${i}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    // One already-revoked + one for a different user → should NOT count.
    await env.prisma.session.create({
      data: {
        id: 'already-revoked',
        userId: USER_A,
        refreshTokenHash: 'h-x',
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });
    await env.prisma.session.create({
      data: {
        id: 'other-user',
        userId: 'someone-else',
        refreshTokenHash: 'h-other',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const result = await svc.revokeAllForUser(USER_A);
    expect(result.revokedCount).toBe(3);

    const otherUser = env.sessions.find((s) => s.id === 'other-user')!;
    expect(otherUser.revokedAt).toBeNull(); // untouched
  });
});
