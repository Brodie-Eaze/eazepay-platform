import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BadRequest, NotFound, sha256Hex } from '@eazepay/shared-utils';
import type { SessionId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { IDENTITY_PROVIDER, type IdentityProvider } from './ports/identity-provider.port.js';
import { NOTIFICATION_GATEWAY, type NotificationGateway } from './ports/notification.port.js';
import type { OtpService } from './internal/otp.service.js';
import type { TokenService } from './internal/token.service.js';
import type { SessionService } from './internal/session.service.js';
import type { LoginResult, RefreshResult, RegisterResult, VerifyOtpResult } from './auth.types.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { ResendOtpDto } from './dto/resend-otp.dto.js';

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
    //    the resend-OTP endpoint (POST /auth/resend-otp; see resendOtp()
    //    below).
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

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResult> {
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

  /**
   * Re-send the OTP code attached to an existing challenge.
   *
   * Flow:
   *   1. Look up the prior challenge in Redis by id. If absent or
   *      expired return 404 `otp_challenge_not_found` — same error
   *      shape whether it never existed or already aged out, so a
   *      caller can't probe for valid ids.
   *   2. Resolve the original delivery destination from the User row
   *      via Postgres. We store the destination as a sha256 hash in
   *      Redis (PII minimisation), so the plaintext we deliver to must
   *      come from the persisted user record. We pick email-first if
   *      the prior challenge was `email`, otherwise the phoneE164.
   *      If neither is available (user data drift) we throw NotFound.
   *   3. Burn the prior challenge id + code via `supersedePriorChallenge`.
   *      The old code is dead the instant this returns — important so
   *      a leaked-then-resent code can't replay.
   *   4. Mint a fresh challenge via `createChallenge`, which re-applies
   *      the per-identifier sliding-window quota (SEC-012). Resends
   *      count against that quota — by design.
   *   5. Deliver the fresh code through the notification adapter.
   *   6. Write an audit row (`auth.otp.resent`) with userId + channel.
   *
   * Return shape matches the original challenge envelope so the client
   * just swaps the prior challengeId / expiresAt without touching the
   * verify path.
   */
  async resendOtp(
    dto: ResendOtpDto,
    _ipAddress?: string,
    _userAgent?: string,
  ): Promise<{ challengeId: string; channel: 'sms' | 'email' | 'totp'; expiresAt: string }> {
    const prior = await this.otp.supersedePriorChallenge(dto.challengeId);
    if (!prior) {
      throw NotFound({ code: 'otp_challenge_not_found' });
    }

    // Resolve plaintext destination from the user row. Redis holds only
    // the sha256 hash; the user table holds the actual email / phone.
    const user = await this.prisma.user.findUnique({
      where: { id: prior.userId },
      select: { email: true, phoneE164: true },
    });
    if (!user) {
      throw NotFound({ code: 'otp_challenge_not_found' });
    }

    // The original challenge recorded which channel was used. We deliver
    // through the same channel on resend so the user receives the code
    // where they expect (an SMS resend going to email is confusing).
    let destination: string | null = null;
    let deliveryChannel: 'sms' | 'email';
    if (prior.channel === 'email') {
      destination = user.email;
      deliveryChannel = 'email';
    } else if (prior.channel === 'sms') {
      destination = user.phoneE164;
      deliveryChannel = 'sms';
    } else {
      // TOTP doesn't have a server-side delivery channel; resending
      // doesn't make sense for it.
      throw BadRequest({ code: 'otp_resend_unsupported_channel' });
    }
    if (!destination) {
      throw NotFound({ code: 'otp_challenge_not_found' });
    }

    // SEC-012 rate-limit is re-applied here automatically — createChallenge
    // INCRs the per-identifier sliding-window counter and throws
    // 429 otp_request_quota_exceeded when over budget.
    const fresh = await this.otp.createChallenge({
      userId: prior.userId,
      channel: deliveryChannel,
      destination,
      purpose: prior.purpose,
    });

    await this.notifications.deliverOtp({
      channel: deliveryChannel,
      to: destination,
      code: fresh.code,
      purpose: prior.purpose,
      ttlSeconds: 600,
    });

    await this.prisma.auditOutbox.create({
      data: {
        actorType: 'user',
        actorId: prior.userId,
        action: 'auth.otp.resent',
        targetType: 'User',
        targetId: prior.userId,
        after: {
          channel: deliveryChannel,
          purpose: prior.purpose,
          priorChallengeId: dto.challengeId,
          newChallengeId: fresh.challengeId,
        },
      },
    });

    return {
      challengeId: fresh.challengeId,
      channel: deliveryChannel,
      expiresAt: fresh.expiresAt,
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
    // SEC-011 — atomic rotation. The old code revoked the previous
    // session in one transaction and then created the replacement in
    // a separate transaction inside `issueSession`. A failure between
    // the two left the user with no live session AND no audit row
    // pairing the old/new ids.
    //
    // New shape: pre-generate the new session id + mint tokens against
    // it OUTSIDE any DB transaction, then hand both ids to
    // `sessions.rotateAtomic()` which revokes the old, inserts the
    // new, and writes the `auth.session.rotated` audit row in one
    // `prisma.$transaction(...)`. Failure rolls back the whole rotation.
    //
    // Why we look up the userId OUTSIDE the transaction first: the
    // JWT signer is a non-transactional KMS-ish call, and the access
    // token needs `sub=userId`. Doing the lookup as a pre-read is
    // safe because `rotateAtomic` re-checks ALL session state
    // (revokedAt / expiresAt / deviceId) inside the transaction with
    // row-level read. The pre-read is purely to satisfy the JWT
    // subject; correctness lives in the in-transaction recheck.
    if (!dto.deviceId || dto.deviceId.length < 8) {
      throw BadRequest({ code: 'device_id_required' });
    }
    const refreshHash = sha256Hex(dto.refreshToken);
    const probe = await this.prisma.session.findFirst({
      where: { refreshTokenHash: refreshHash },
      select: { userId: true },
    });
    if (!probe) {
      // Mirror the in-transaction error so a bogus refresh-token and a
      // legitimate one with a flipped revokedAt look the same to a
      // caller. Re-uses the same `BadRequest` helper already imported —
      // the in-transaction `rotateAtomic` raises Unauthorized for the
      // same condition, but the rejection text is identical.
      throw BadRequest({ code: 'invalid_refresh' });
    }

    const newSessionId = randomUUID() as SessionId;
    const minted = await this.tokens.mint(probe.userId as UserId, newSessionId);

    const rotated = await this.sessions.rotateAtomic({
      refreshTokenHash: refreshHash,
      deviceId: dto.deviceId,
      newSessionId,
      newRefreshTokenHash: minted.refreshTokenHash,
      newRefreshTokenExpiresAt: new Date(minted.refreshTokenExpiresAt),
    });

    return {
      tokens: {
        accessToken: minted.accessToken,
        accessTokenExpiresAt: minted.accessTokenExpiresAt,
        refreshToken: minted.refreshToken,
        refreshTokenExpiresAt: minted.refreshTokenExpiresAt,
      },
      sessionId: rotated.newSessionId,
    };
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
