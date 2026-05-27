/**
 * Characterization tests for {@link TokenService}.
 *
 * The legacy / current behavior is the oracle: each assertion captures
 * what the HS256-on-jose path *actually* produces today. When the
 * Cognito (RS256 + JWKS) swap lands, the same harness should drive both
 * implementations and surface any drift.
 */
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@eazepay/shared-utils';
import { SignJWT, jwtVerify, decodeJwt, decodeProtectedHeader } from 'jose';
import { TokenService, type AuthConfig } from '../src/internal/token.service.js';
import type { SessionId, UserId } from '@eazepay/shared-types';

const CONFIG: AuthConfig = {
  jwtIssuer: 'eazepay-test',
  jwtAudience: 'eazepay-test-aud',
  jwtAccessSecret: 'unit-test-secret-do-not-use-in-prod-0123456789',
  accessTokenTtlSeconds: 900, // 15 min — production value per SEC-009 docstring
  refreshTokenTtlSeconds: 60 * 60 * 24 * 30, // 30 days
};

const USER_ID = '00000000-0000-4000-8000-000000000001' as UserId;
const SESSION_ID = '00000000-0000-4000-8000-0000000000aa' as SessionId;

describe('TokenService.mint', () => {
  const svc = new TokenService(CONFIG);

  it('emits HS256 access JWT carrying sub=userId and sid=sessionId', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    const header = decodeProtectedHeader(minted.accessToken);
    const payload = decodeJwt(minted.accessToken);

    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
    expect(payload.sub).toBe(USER_ID);
    expect(payload.sid).toBe(SESSION_ID);
    expect(payload.iss).toBe(CONFIG.jwtIssuer);
    expect(payload.aud).toBe(CONFIG.jwtAudience);
  });

  it('sets exp = iat + accessTokenTtlSeconds on the access JWT', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    const payload = decodeJwt(minted.accessToken);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp! - payload.iat!).toBe(CONFIG.accessTokenTtlSeconds);
  });

  it('returns accessTokenExpiresAt matching the JWT exp claim', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    const payload = decodeJwt(minted.accessToken);
    const expectedIso = new Date(payload.exp! * 1000).toISOString();
    expect(minted.accessTokenExpiresAt).toBe(expectedIso);
  });

  it('returns refresh token + matching SHA-256 hash (the value stored in DB)', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    // 48 bytes base64url-encoded => 64 chars (no padding).
    expect(minted.refreshToken).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(minted.refreshTokenHash).toBe(sha256Hex(minted.refreshToken));
    expect(minted.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('mints unique refresh tokens across successive calls (48 bytes of fresh randomness each time)', async () => {
    const a = await svc.mint(USER_ID, SESSION_ID);
    const b = await svc.mint(USER_ID, SESSION_ID);
    expect(a.refreshToken).not.toBe(b.refreshToken);
    expect(a.refreshTokenHash).not.toBe(b.refreshTokenHash);
    // Access JWT may collide when minted in the same second (same iat,
    // same sub/sid/iss/aud) — this is observed behavior of the current
    // HS256 path and not a bug, so we do NOT assert uniqueness there.
  });
});

describe('TokenService.verifyAccess', () => {
  const svc = new TokenService(CONFIG);

  it('round-trips: mint then verify returns the same {sub, sid}', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    const claims = await svc.verifyAccess(minted.accessToken);
    expect(claims.sub).toBe(USER_ID);
    expect(claims.sid).toBe(SESSION_ID);
  });

  it('rejects a token signed with a DIFFERENT secret (signature verification)', async () => {
    const other = new TokenService({ ...CONFIG, jwtAccessSecret: 'a-totally-different-secret-xx' });
    const minted = await other.mint(USER_ID, SESSION_ID);
    await expect(svc.verifyAccess(minted.accessToken)).rejects.toThrow();
  });

  it('rejects an expired token (exp claim enforcement)', async () => {
    // Hand-sign a JWT whose exp is in the past so we can drive the
    // expiry branch without faking timers.
    const key = new TextEncoder().encode(CONFIG.jwtAccessSecret);
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = await new SignJWT({ sid: SESSION_ID })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(CONFIG.jwtIssuer)
      .setAudience(CONFIG.jwtAudience)
      .setIssuedAt(past - CONFIG.accessTokenTtlSeconds)
      .setExpirationTime(past)
      .sign(key);
    await expect(svc.verifyAccess(expired)).rejects.toThrow();
  });

  it('rejects a token whose issuer does not match the configured issuer', async () => {
    const key = new TextEncoder().encode(CONFIG.jwtAccessSecret);
    const wrongIssuer = await new SignJWT({ sid: SESSION_ID })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer('not-eazepay')
      .setAudience(CONFIG.jwtAudience)
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(key);
    await expect(svc.verifyAccess(wrongIssuer)).rejects.toThrow();
  });

  it('rejects a token whose audience does not match the configured audience', async () => {
    const key = new TextEncoder().encode(CONFIG.jwtAccessSecret);
    const wrongAud = await new SignJWT({ sid: SESSION_ID })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(USER_ID)
      .setIssuer(CONFIG.jwtIssuer)
      .setAudience('not-the-real-audience')
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(key);
    await expect(svc.verifyAccess(wrongAud)).rejects.toThrow();
  });

  it('rejects a tampered token (last byte flipped breaks the HMAC)', async () => {
    const minted = await svc.mint(USER_ID, SESSION_ID);
    // Flip the last char of the signature segment.
    const lastChar = minted.accessToken.slice(-1);
    const replacement = lastChar === 'A' ? 'B' : 'A';
    const tampered = minted.accessToken.slice(0, -1) + replacement;
    await expect(svc.verifyAccess(tampered)).rejects.toThrow();
  });

  it('rejects a non-JWT string outright', async () => {
    await expect(svc.verifyAccess('not.a.jwt')).rejects.toThrow();
  });
});
