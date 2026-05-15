import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Idempotent } from '@eazepay/shared-utils';
import { Public } from './guards/public.decorator.js';
import { CurrentSession, CurrentUser } from './guards/current-user.decorator.js';
import type { SessionContext } from './auth.types.js';
import type { UserId } from '@eazepay/shared-types';
import type { AuthService } from './auth.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';
import type { ResendOtpDto } from './dto/resend-otp.dto.js';
import type { TotpEnrollInitDto, TotpEnrollVerifyDto } from './dto/totp-enroll.dto.js';
import type { TotpVerifyDto } from './dto/totp-verify.dto.js';

/**
 * Auth-route throttle profile: significantly tighter than the default
 * `long` tier (120/min/IP) configured globally in the API module. These
 * surfaces are the highest-value attack targets — credential stuffing,
 * password spray, OTP brute force, refresh-token replay — so each
 * endpoint gets its own cap.
 *
 * Counters are per-IP; the global ThrottlerGuard runs before the JWT
 * guard so unauthenticated floods get cut early.
 */
const REGISTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } }; // 5/min/IP — abuse signup
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } }; // 10/min/IP — password spray
const OTP_THROTTLE = { default: { limit: 5, ttl: 60_000 } }; // 5/min/IP — OTP brute force
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } }; // 30/min/IP — sliding sessions
// SEC-016 — TOTP surfaces are bracketed at the same 5/min/IP profile as
// SMS/email OTP. enrol-init is bounded similarly because each call mints
// a fresh secret + 10 recovery codes — an unbounded loop would burn
// entropy and write churn on the User row needlessly.
const TOTP_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
import type { LoginResult, RefreshResult, RegisterResult, VerifyOtpResult } from './auth.types.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(REGISTER_THROTTLE)
  @Post('register')
  @HttpCode(201)
  @Idempotent()
  @ApiOperation({ summary: 'Register a new consumer or merchant user account' })
  register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.auth.register(dto);
  }

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Initiate login with identifier + password; may require MFA' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<LoginResult> {
    return this.auth.login(dto, ip, userAgent);
  }

  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete an MFA / OTP challenge and issue tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    return this.auth.verifyOtp(dto);
  }

  /**
   * Re-send the OTP code for a challenge whose original SMS/email never
   * arrived (or expired before the user could read it). Uses the same
   * throttle profile as verify-otp — 5/min/IP — and additionally
   * inherits the per-identifier sliding-window quota enforced inside
   * OtpService (SEC-012). The prior challenge id is burned the moment
   * the resend succeeds; the response carries a fresh challenge id the
   * client must use on the subsequent verify-otp call.
   */
  @Public()
  @Throttle(OTP_THROTTLE)
  @Post('resend-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Re-issue the OTP code for an existing challenge' })
  resendOtp(
    @Body() dto: ResendOtpDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<{ challengeId: string; channel: 'sms' | 'email' | 'totp'; expiresAt: string }> {
    return this.auth.resendOtp(dto, ip, userAgent);
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  refresh(@Body() dto: RefreshDto): Promise<RefreshResult> {
    return this.auth.refresh(dto);
  }

  /**
   * Authenticated sign-out. Revokes the current session row (the one
   * the access JWT's `sid` claim points at) and writes an audit row.
   * The partner-portal Logout button posts here, then clears cookies
   * locally regardless of the response — we never want a half-state
   * where the cookie is gone but the server-side session lingers.
   */
  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the caller`s current session (authenticated)' })
  async logout(@CurrentSession() session: SessionContext): Promise<void> {
    await this.auth.revoke(session.sessionId);
  }

  /**
   * SEC-016 — TOTP enrolment, phase 1. Authenticated.
   *
   * Returns the freshly-minted base32 secret + an otpauth:// URI the
   * caller renders as a QR code, plus a list of plaintext recovery
   * codes the user MUST capture immediately (we never echo them
   * again — only hashes are persisted at verify time).
   *
   * Nothing is committed to the User row in this call. A second call
   * to `mfa/totp/enroll-verify` with the user's first authenticator
   * code is required to lock the secret in — see `enrolTotpVerify` in
   * auth.service.ts for the threat model.
   */
  @Throttle(TOTP_THROTTLE)
  @Post('mfa/totp/enroll-init')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin TOTP enrolment; returns secret + recovery codes' })
  async enrolTotpInit(
    @CurrentUser() userId: UserId,
    @Body() _dto: TotpEnrollInitDto,
  ): Promise<{
    secret: string;
    otpauthUri: string;
    recoveryCodesPlaintext: string[];
  }> {
    return this.auth.enrolTotpInit(userId);
  }

  /**
   * SEC-016 — TOTP enrolment, phase 2. Authenticated.
   *
   * Commits the secret + hashed recovery codes to the User row when
   * the supplied 6-digit code matches the secret returned by phase 1.
   */
  @Throttle(TOTP_THROTTLE)
  @Post('mfa/totp/enroll-verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm TOTP enrolment by verifying first code' })
  async enrolTotpVerify(
    @CurrentUser() userId: UserId,
    @Body() dto: TotpEnrollVerifyDto,
  ): Promise<{ ok: true; remaining: number }> {
    return this.auth.enrolTotpVerify(userId, dto);
  }

  /**
   * SEC-016 — TOTP login verify. Public (no session yet; the
   * challenge id from /auth/login carries the identity binding).
   *
   * Accepts either a 6-digit TOTP code or a formatted recovery code.
   * Returns access + refresh tokens on success. Throttled at 5/min/IP
   * to match the SMS/email OTP verify surface.
   */
  @Public()
  @Throttle(TOTP_THROTTLE)
  @Post('mfa/totp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete TOTP challenge and issue tokens' })
  verifyTotp(@Body() dto: TotpVerifyDto) {
    return this.auth.verifyTotp(dto);
  }
}
