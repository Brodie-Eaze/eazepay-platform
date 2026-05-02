import { Injectable, Logger } from '@nestjs/common';
import { InternalError } from '@eazepay/shared-utils';
import type {
  AuthTokens,
  LoginResult,
  RefreshResult,
  RegisterResult,
  VerifyOtpResult,
} from './auth.types.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { RefreshDto } from './dto/refresh.dto.js';

/**
 * AuthService — interface-only at this stage.
 *
 * Implementation will integrate AWS Cognito user pool for primary identity,
 * a custom session table (Postgres) for device-bound refresh tokens, and a
 * step-up MFA layer. See ADR-0005 for the rationale and split.
 *
 * Each method below documents the regulated obligations it must satisfy
 * before it ships:
 *  - audit log entry on success and failure
 *  - device binding stored on session
 *  - refresh-token rotation (one-time-use; replay = revoke chain)
 *  - rate limiting + lockout per identifier (handled by gateway, but
 *    the service must not leak existence of accounts via timing).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async register(_dto: RegisterDto): Promise<RegisterResult> {
    throw InternalError({ code: 'not_implemented', detail: 'auth.register pending Cognito wiring' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async login(_dto: LoginDto, _ipAddress?: string, _userAgent?: string): Promise<LoginResult> {
    throw InternalError({ code: 'not_implemented', detail: 'auth.login pending Cognito wiring' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async verifyOtp(_dto: VerifyOtpDto): Promise<VerifyOtpResult> {
    throw InternalError({ code: 'not_implemented', detail: 'auth.verifyOtp pending Cognito wiring' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refresh(_dto: RefreshDto): Promise<RefreshResult> {
    throw InternalError({ code: 'not_implemented', detail: 'auth.refresh pending Cognito wiring' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async revoke(_sessionId: string): Promise<void> {
    throw InternalError({ code: 'not_implemented', detail: 'auth.revoke pending session-store wiring' });
  }

  // Helper signatures kept for future use; bodies will follow.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private mintTokens(_userId: string, _sessionId: string): Promise<AuthTokens> {
    throw InternalError({ code: 'not_implemented' });
  }
}
