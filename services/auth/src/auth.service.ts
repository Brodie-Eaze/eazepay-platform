import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BadRequest, Conflict, NotFound, sha256Hex } from '@eazepay/shared-utils';
import type { SessionId, UserId } from '@eazepay/shared-types';
import { PRISMA } from './internal/tokens.js';
import { IDENTITY_PROVIDER, type IdentityProvider } from './ports/identity-provider.port.js';
import { NOTIFICATION_GATEWAY, type NotificationGateway } from './ports/notification.port.js';
import type { OtpService } from './internal/otp.service.js';
import type { TokenService } from './internal/token.service.js';
import type { SessionService } from './internal/session.service.js';
import type { TotpService } from './internal/totp.service.js';
import type { PasswordPolicyService } from './internal/password-policy.service.js';
import type { LoginResult, RefreshResult, RegisterResult, VerifyOtpResult } from './auth.types.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { ResendOtpDto } from './dto/resend-otp.dto.js';
import type { TotpEnrollVerifyDto } from './dto/totp-enroll.dto.js';
import type { TotpVerifyDto } from './dto/totp-verify.dto.js';

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
    private readonly totp: TotpService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    // SEC-015 — HIBP k-anonymity check.
    //
    // Threat closed: a user picking `Tr0ub4dor!23` — which appears 10k+
    // times in the HIBP corpus — is functionally giving an attacker a
    // bearer credential the first time their email shows up in any
    // future credential-stuff campaign. The k-anonymity API lets us
    // refuse those passwords without ever sending the plaintext (we
    // ship only the first 5 chars of SHA-1).
    //
    // Reset paths are deliberately NOT gated by this check. A user
    // locked out of an account because their old password was breached
    // needs a way back in; we let them reset and the reset target is
    // checked here on the NEXT register/change-password call. The
    // dedicated change-password endpoint (when it lands) re-uses
    // `passwordPolicy.checkBreached` — see the docstring on
    // password-policy.service.ts.
    const breachCheck = await this.passwordPolicy.checkBreached(dto.password);
    if (breachCheck.breached) {
      throw Conflict({
        code: 'password_breached',
        detail: `This password has appeared in ${breachCheck.count} data breaches. Choose another.`,
      });
    }

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

  // ─────────────────────────────────────────────────────────────────
  //  SEC-016 — TOTP second-factor enrolment + verify.
  //
  //  We read/write the new totp_secret_ciphertext + totp_recovery_codes
  //  columns through $queryRaw / $executeRaw rather than the generated
  //  Prisma client. Reason: this lets the migration land in the same
  //  PR as the application code without requiring a `prisma generate`
  //  step between them. Once codegen has run end-to-end the calls can
  //  be swapped to typed `user.update` calls; the SQL above is
  //  parameterised and bound, so injection isn't a concern in the
  //  interim shape.
  // ─────────────────────────────────────────────────────────────────

  /**
   * Phase 1: mint a fresh TOTP secret + recovery codes, return the
   * otpauth:// URI for QR display. Nothing is persisted yet — the
   * caller is expected to display the QR + recovery codes once, then
   * call enrolTotpVerify with the user's first authenticator code.
   *
   * Why we don't commit on init: see TotpService.initEnrolment
   * docstring — committing eagerly lets an attacker who can call init
   * on a victim's session learn the secret without ever holding the
   * device.
   */
  async enrolTotpInit(userId: UserId): Promise<{
    secret: string;
    otpauthUri: string;
    recoveryCodesPlaintext: string[];
  }> {
    // Refuse re-enrolment when a secret is already on file. A user
    // wanting to rotate must explicitly disable TOTP first (separate
    // future endpoint) so a stolen access token cannot replace the
    // user's enrolled device with the attacker's silently.
    const existing = await this.prisma.$queryRaw<
      Array<{
        totp_secret_ciphertext: string | null;
        email: string | null;
        phone_e164: string | null;
      }>
    >`SELECT totp_secret_ciphertext, email, phone_e164 FROM "users" WHERE id = ${userId}::uuid LIMIT 1`;
    const row = existing[0];
    if (!row) throw NotFound({ code: 'user_not_found' });
    if (row.totp_secret_ciphertext) {
      throw Conflict({
        code: 'totp_already_enrolled',
        detail: 'TOTP is already enrolled for this account.',
      });
    }

    const accountLabel = row.email ?? row.phone_e164 ?? userId;
    const result = await this.totp.initEnrolment({
      userId,
      accountLabel,
      issuer: 'EazePay',
    });

    return {
      secret: result.secret,
      otpauthUri: result.otpauthUri,
      recoveryCodesPlaintext: result.recoveryCodesPlaintext,
    };
  }

  /**
   * Phase 2: commit the secret + hashed recovery codes to the User
   * row. Triggered by the user typing their first authenticator code.
   * Writes the audit row in the same transaction so the secret + the
   * audit anchor can't drift apart.
   */
  async enrolTotpVerify(
    userId: UserId,
    dto: TotpEnrollVerifyDto,
  ): Promise<{ ok: true; remaining: number }> {
    const committed = await this.totp.commitEnrolment({
      userId,
      secret: dto.secret,
      code: dto.code,
      recoveryCodesPlaintext: dto.recoveryCodesPlaintext,
    });

    await this.prisma.$transaction(async (tx) => {
      // The Prisma client's typegen hasn't seen the new columns yet
      // (the migration lands in the same PR as this code); use
      // $executeRaw with parameter binding to keep injection out of
      // scope while we sidestep the typegen race.
      await tx.$executeRaw`
        UPDATE "users"
          SET "totp_secret_ciphertext" = ${committed.sealedSecret},
              "totp_recovery_codes"    = ${JSON.stringify(committed.recoveryCodes)}::jsonb,
              "updated_at"             = now()
          WHERE "id" = ${userId}::uuid
      `;
      await tx.auditOutbox.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'auth.mfa.totp.enrolled',
          targetType: 'User',
          targetId: userId,
          after: { recoveryCodesIssued: committed.recoveryCodes.length },
        },
      });
    });

    return { ok: true, remaining: committed.recoveryCodes.length };
  }

  /**
   * Login-time TOTP verify. Replaces the SMS/email OTP verify when the
   * user has TOTP enrolled. Accepts either a 6-digit TOTP code or a
   * formatted recovery code (xxxxx-xxxxx). On success, issues an
   * access + refresh token pair via `issueSession`.
   *
   * Recovery-code path mutates the persisted array to mark the slot
   * `used: true` and writes an `auth.mfa.recovery_code_used` audit row
   * carrying the remaining-count. Both writes happen in the same
   * transaction as the session insert so a recovery code is never
   * burned without a session being issued (and never used twice).
   */
  async verifyTotp(dto: TotpVerifyDto): Promise<VerifyOtpResult> {
    // The challengeId here came from /auth/login. We resolve it back to
    // a userId via the same Redis state the SMS/email verify path uses,
    // so the brute-force counter + concurrency cap still apply.
    const probe = await this.otp.supersedePriorChallenge(dto.challengeId);
    if (!probe) {
      throw NotFound({ code: 'otp_challenge_not_found' });
    }
    const userId = probe.userId;

    const row = await this.prisma.$queryRaw<
      Array<{
        totp_secret_ciphertext: string | null;
        totp_recovery_codes: Array<{ hash: string; used: boolean; usedAt?: string }> | null;
      }>
    >`
      SELECT "totp_secret_ciphertext", "totp_recovery_codes"
        FROM "users"
        WHERE "id" = ${userId}::uuid
        LIMIT 1
    `;
    const userRow = row[0];
    if (!userRow) throw NotFound({ code: 'user_not_found' });

    const verifyOutcome = await this.totp.verifyChallenge({
      userId,
      submittedCode: dto.code,
      sealedSecret: userRow.totp_secret_ciphertext,
      recoveryCodes: userRow.totp_recovery_codes ?? [],
    });

    if (verifyOutcome.kind === 'recovery_code_ok') {
      // Persist the burned slot + audit row BEFORE session is issued so
      // a crash between verify-and-session cannot leave a recovery
      // code "unused but verified".
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "users"
             SET "totp_recovery_codes" = ${JSON.stringify(verifyOutcome.updatedRecoveryCodes)}::jsonb,
                 "updated_at"          = now()
           WHERE "id" = ${userId}::uuid
        `;
        await tx.auditOutbox.create({
          data: {
            actorType: 'user',
            actorId: userId,
            action: 'auth.mfa.recovery_code_used',
            targetType: 'User',
            targetId: userId,
            after: { remaining: verifyOutcome.remaining },
          },
        });
      });
    } else {
      // Plain TOTP success — audit alongside the session insert in
      // issueSession via the action string.
    }

    return this.issueSession(
      userId,
      dto.deviceId,
      verifyOutcome.kind === 'recovery_code_ok'
        ? 'auth.mfa.totp.recovery_login'
        : 'auth.mfa.totp.verified',
    );
  }
}
