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
   * Atomic refresh-token rotation. Returns the userId on success; throws
   * if the token is unknown, expired, or already revoked. A reused refresh
   * token (replay) revokes the entire chain — we treat replay as compromise.
   */
  async rotate(
    refreshTokenHash: string,
    deviceId: string,
  ): Promise<{ userId: UserId; sessionId: SessionId }> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findFirst({
        where: { refreshTokenHash },
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
      if (session.deviceId && session.deviceId !== deviceId) {
        throw Unauthorized({ code: 'device_mismatch' });
      }
      // Mark current session revoked; caller will create a fresh one.
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      return {
        userId: session.userId as UserId,
        sessionId: session.id as SessionId,
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
