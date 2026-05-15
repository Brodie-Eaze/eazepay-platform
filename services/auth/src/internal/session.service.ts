import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PRISMA } from './tokens.js';
import { Unauthorized } from '@eazepay/shared-utils';
import type { SessionId, UserId } from '@eazepay/shared-types';

export interface CreateSessionInput {
  userId: UserId;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Input to {@link SessionService.rotateAtomic}. The caller pre-mints the
 * new session id + refresh token OUTSIDE the rotation transaction (token
 * minting talks to the JWT signer, which is non-transactional) and hands
 * the result back here so the revoke-old / create-new pair commits or
 * rolls back as one unit.
 */
export interface AtomicRotationInput {
  refreshTokenHash: string;
  deviceId: string;
  newSessionId: SessionId;
  newRefreshTokenHash: string;
  newRefreshTokenExpiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(
    input: CreateSessionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SessionId> {
    const client = tx ?? this.prisma;
    const session = await client.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.refreshTokenExpiresAt,
        deviceId: input.deviceId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      select: { id: true },
    });
    return session.id as SessionId;
  }

  /**
   * SEC-011 — atomic refresh-token rotation.
   *
   * Threat closed: previously `rotate()` revoked the old session inside
   * its own transaction, then `AuthService.issueSession()` opened a
   * SEPARATE transaction to create the replacement session + audit row.
   * If the second transaction failed (deadlock, KMS hiccup, Postgres
   * blip), the user was left with a revoked old session and no new
   * session, forcing a fresh login — and worse, the audit trail showed
   * only "revoked" with no matching "rotated" row, breaking the chain
   * we rely on for reconstructing session lifecycles.
   *
   * Fix: collapse revoke-old, create-new, and the `auth.session.rotated`
   * audit row into one `prisma.$transaction(...)`. Caller pre-generates
   * the new session id (via `randomUUID()`) and mints tokens against
   * that id BEFORE entering the transaction, so the JWT signer call
   * never sits inside a DB transaction.
   *
   * Returns the rotated userId + old/new session ids for the auth-service
   * caller to mint and return to the client.
   */
  async rotateAtomic(input: AtomicRotationInput): Promise<{
    userId: UserId;
    oldSessionId: SessionId;
    newSessionId: SessionId;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { refreshTokenHash: input.refreshTokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          revokedAt: true,
          deviceId: true,
        },
      });
      if (!session) throw Unauthorized({ code: 'invalid_refresh' });
      if (session.revokedAt) {
        // Replay: revoke all live sessions for this user.
        await tx.session.updateMany({
          where: { userId: session.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw Unauthorized({ code: 'refresh_replay_detected' });
      }
      if (session.expiresAt.getTime() < Date.now()) {
        throw Unauthorized({ code: 'refresh_expired' });
      }
      if (session.deviceId && session.deviceId !== input.deviceId) {
        throw Unauthorized({ code: 'device_mismatch' });
      }

      // Revoke the old session. Stamping `revokedAt` here means the
      // JwtAuthGuard's revokedAt check (SEC-009) will reject the
      // outgoing access token the instant this commit lands.
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      // Create the replacement session in the SAME transaction. The new
      // session id was pre-generated client-side so the freshly minted
      // access JWT already carries it as `sid`.
      await tx.session.create({
        data: {
          id: input.newSessionId,
          userId: session.userId,
          refreshTokenHash: input.newRefreshTokenHash,
          expiresAt: input.newRefreshTokenExpiresAt,
          deviceId: input.deviceId,
        },
      });

      // Audit row pairs the two ids so the lifecycle is reconstructable.
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: session.userId,
          action: 'auth.session.rotated',
          targetType: 'Session',
          targetId: input.newSessionId,
          before: { sessionId: session.id },
          after: { sessionId: input.newSessionId },
        },
      });

      return {
        userId: session.userId as UserId,
        oldSessionId: session.id as SessionId,
        newSessionId: input.newSessionId,
      };
    });
  }

  async revoke(sessionId: SessionId): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
}
