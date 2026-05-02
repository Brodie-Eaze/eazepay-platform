import { Inject, Injectable, Logger } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { sha256Hex } from '@eazepay/shared-utils';
import type { SessionId, UserId } from '@eazepay/shared-types';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  jwtIssuer: string;
  jwtAudience: string;
  jwtAccessSecret: string; // dev-only; prod uses Cognito-issued JWTs verified via JWKS
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}

export interface AccessTokenClaims {
  sub: UserId;
  sid: SessionId;
}

export interface MintedTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string; // opaque, returned once
  refreshTokenHash: string; // what we persist
  refreshTokenExpiresAt: string;
}

/**
 * MVP token service: HS256 access JWTs signed with a dev secret + opaque
 * refresh tokens whose SHA-256 hashes are stored in Postgres for rotation.
 *
 * Production swap: access tokens are issued by Cognito (RS256, JWKS); we
 * verify locally using cached JWKS. Refresh tokens remain ours so we can
 * enforce device binding + rotation independently of Cognito's lifetime.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly accessKey: Uint8Array;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    this.accessKey = new TextEncoder().encode(this.config.jwtAccessSecret);
  }

  async mint(userId: UserId, sessionId: SessionId): Promise<MintedTokens> {
    const now = Math.floor(Date.now() / 1000);
    const accessExp = now + this.config.accessTokenTtlSeconds;
    const refreshExp = now + this.config.refreshTokenTtlSeconds;

    const accessToken = await new SignJWT({ sid: sessionId } as AccessTokenClaims)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(this.config.jwtIssuer)
      .setAudience(this.config.jwtAudience)
      .setIssuedAt(now)
      .setExpirationTime(accessExp)
      .sign(this.accessKey);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTokenHash = sha256Hex(refreshToken);

    return {
      accessToken,
      accessTokenExpiresAt: new Date(accessExp * 1000).toISOString(),
      refreshToken,
      refreshTokenHash,
      refreshTokenExpiresAt: new Date(refreshExp * 1000).toISOString(),
    };
  }

  async verifyAccess(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.accessKey, {
      issuer: this.config.jwtIssuer,
      audience: this.config.jwtAudience,
    });
    return { sub: payload.sub as UserId, sid: (payload as { sid: SessionId }).sid };
  }
}
