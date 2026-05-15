import { Body, Controller, Headers, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Idempotent } from '@eazepay/shared-utils';
import { Public } from './guards/public.decorator.js';
import { CurrentSession } from './guards/current-user.decorator.js';
import type { SessionContext } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';

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
const REGISTER_THROTTLE = { default: { limit: 5, ttl: 60_000 } };   // 5/min/IP — abuse signup
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } };     // 10/min/IP — password spray
const OTP_THROTTLE = { default: { limit: 5, ttl: 60_000 } };        // 5/min/IP — OTP brute force
const REFRESH_THROTTLE = { default: { limit: 30, ttl: 60_000 } };   // 30/min/IP — sliding sessions
import type {
  LoginResult,
  RefreshResult,
  RegisterResult,
  VerifyOtpResult,
} from './auth.types.js';

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
}
