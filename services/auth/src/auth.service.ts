import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BadRequest, sha256Hex } from '@eazepay/shared-utils';
import type { SessionId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from './ports/identity-provider.port.js';
import {
  NOTIFICATION_GATEWAY,
  type NotificationGateway,
} from './ports/notification.port.js';
import { OtpService } from './internal/otp.service.js';
import { TokenService } from './internal/token.service.js';
import { SessionService } from './internal/session.service.js';
import type {
  LoginResult,
  RefreshResult,
  RegisterResult,
  VerifyOtpResult,
} from './auth.types.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(NOTIFICATION_GATEWAY) private readonly notifications: NotificationGateway,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    // 1. Provision identity (creates User row + password hash).
    const { userId } = await this.identity.signUp({
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
    });

    // 2. Issue OTP challenge to the verified channel and write the audit
    //    row in one Postgres transaction (outbox pattern). Note the OTP
    //    record itself lives in Redis — failure between steps 1 and 2
    //    leaves a User in pending_verification, which is recoverable via
    //    a re-send-OTP endpoint (TODO).
    const channel: 'sms' | 'email' = dto.email ? 'email' : 'sms';
    const destination = dto.email ?? dto.phone!;
    const challenge = await this.otp.createChallenge({
      userId,
      channel,
      destination,
      purpose: 'register_verify',
    });

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'auth.register',
        targetType: 'User',
        targetId: userId,
        after: {
          channel,
          marketingConsent: dto.marketingConsent,
        },
      },
    });

    await this.notifications.deliverOtp({
      channel,
      to: destination,
      code: challenge.code,
      purpose: 'register_verify',
      ttlSeconds: 600,
    });

    return {
      userId,
      requiresVerification: dto.email ? 'email' : 'phone',
      challenge: {
        challengeId: challenge.challengeId,
        channel,
        expiresAt: challenge.expiresAt,
      },
    };
  }

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const userId = await this.identity.checkPassword({
      identifier: dto.identifier,
      password: dto.password,
    });

    // For MVP, every login requires OTP step-up. Decision matrix can
    // graduate to risk-based step-up once device fingerprinting + history
    // are in place.
    const isEmail = dto.identifier.includes('@');
    const channel: 'sms' | 'email' = isEmail ? 'email' : 'sms';
    const challenge = await this.otp.createChallenge({
      userId,
      channel,
      destination: dto.identifier,
      purpose: 'login_mfa',
    });

    await this.notifications.deliverOtp({
      channel,
      to: dto.identifier,
      code: challenge.code,
      purpose: 'login_mfa',
      ttlSeconds: 600,
    });

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: userId,
        action: 'auth.login.initiated',
        targetType: 'User',
        targetId: userId,
        after: { channel, ipAddress, userAgent },
      },
    });

    return {
      mfaRequired: true,
      challenge: {
        challengeId: challenge.challengeId,
        channel,
        expiresAt: challenge.expiresAt,
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    // Try register-verify first; fall back to login-mfa. Each call is
    // single-use against the same Redis key so this either consumes the
    // challenge or reports invalid.
    let userId: UserId;
    let action: 'auth.register.verified' | 'auth.login.completed';
    try {
      userId = await this.otp.verifyAndConsume({
        challengeId: dto.challengeId,
        code: dto.code,
        expectedPurpose: 'register_verify',
      });
      action = 'auth.register.verified';
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'active' },
      });
    } catch (registerErr: unknown) {
      // If purpose mismatched, the OTP service deleted the key — the
      // login-mfa path below will simply 401.
      try {
        userId = await this.otp.verifyAndConsume({
          challengeId: dto.challengeId,
          code: dto.code,
          expectedPurpose: 'login_mfa',
        });
        action = 'auth.login.completed';
      } catch {
        throw registerErr;
      }
    }

    return this.issueSession(userId, dto.deviceId, action);
  }

  async refresh(dto: RefreshDto): Promise<RefreshResult> {
    const refreshHash = sha256Hex(dto.refreshToken);
    const { userId } = await this.sessions.rotate(refreshHash, dto.deviceId);
    const result = await this.issueSession(userId, dto.deviceId, 'auth.token.refreshed');
    return { tokens: result.tokens, sessionId: result.sessionId };
  }

  async revoke(sessionId: SessionId): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: null,
        action: 'auth.session.revoked',
        targetType: 'Session',
        targetId: sessionId,
      },
    });
  }

  private async issueSession(
    userId: UserId,
    deviceId: string,
    action: string,
  ): Promise<VerifyOtpResult> {
    if (!deviceId || deviceId.length < 8) {
      throw BadRequest({ code: 'device_id_required' });
    }

    return this.prisma.$transaction(async (tx) => {
      // We mint tokens first because we need refreshTokenHash for the
      // session row. The transaction ensures the session + audit rows
      // commit atomically; on any failure the tokens are never delivered.
      // For now sessionId is generated by Postgres on insert, which means
      // we can't bake it into the access JWT without a second round-trip.
      // We pre-generate it client-side in TokenService later; for MVP we
      // emit access JWTs that reference sub only, and bind sid via a
      // session lookup on each request.
      const session = await tx.session.create({
        data: {
          userId,
          refreshTokenHash: 'pending', // placeholder, updated below
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
        select: { id: true },
      });

      const minted = await this.tokens.mint(userId, session.id as SessionId);

      await tx.session.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: minted.refreshTokenHash,
          expiresAt: new Date(minted.refreshTokenExpiresAt),
        },
      });

      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action,
          targetType: 'Session',
          targetId: session.id,
        },
      });

      return {
        sessionId: session.id as SessionId,
        tokens: {
          accessToken: minted.accessToken,
          refreshToken: minted.refreshToken,
          accessTokenExpiresAt: minted.accessTokenExpiresAt,
          refreshTokenExpiresAt: minted.refreshTokenExpiresAt,
        },
      };
    });
  }
}
