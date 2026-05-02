import type { UserId, SessionId } from '@eazepay/shared-types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string; // ISO datetime
  refreshTokenExpiresAt: string; // ISO datetime
}

export interface AuthChallenge {
  challengeId: string;
  channel: 'sms' | 'email' | 'totp';
  expiresAt: string;
}

export interface RegisterResult {
  userId: UserId;
  requiresVerification: 'email' | 'phone';
  challenge: AuthChallenge;
}

export interface LoginResult {
  /** When MFA is required, no tokens are issued; the client must call verify-otp. */
  mfaRequired: boolean;
  challenge?: AuthChallenge;
  tokens?: AuthTokens;
  sessionId?: SessionId;
}

export interface VerifyOtpResult {
  tokens: AuthTokens;
  sessionId: SessionId;
}

export interface RefreshResult {
  tokens: AuthTokens;
  sessionId: SessionId;
}

export interface SessionContext {
  userId: UserId;
  sessionId: SessionId;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}
