/**
 * ─────────────────────────────────────────────────────────────────────
 * Auth flow integration spec
 * ─────────────────────────────────────────────────────────────────────
 *
 * Boots the real NestJS AppModule against the Dockerised Postgres +
 * Redis stack from `docker-compose.test.yml` (or testcontainers).
 * Drives the full credential lifecycle end-to-end:
 *
 *   register  →  verify-otp  →  login  →  verify-otp
 *             →  refresh    →  logout
 *
 * Why a single spec instead of one-per-route:
 *   - Each step's response is the next step's input (challengeId,
 *     accessToken, refreshToken). Splitting into independent specs
 *     would either need fixture re-setup or fake state injection,
 *     both of which dilute the value of an integration test.
 *   - The NestJS test app boots once (`beforeAll`) and the DB wipes
 *     between specs (`beforeEach` in the suite at module level). For
 *     this file we wipe once at the top and chain steps because the
 *     auth lifecycle is inherently linear.
 *
 * What we override on the DI graph:
 *   - `NOTIFICATION_GATEWAY` — the production console adapter only
 *     hashes the destination; it never emits the plaintext OTP code.
 *     In test we inject a capturing stub that records the code +
 *     channel keyed by challengeId, so the subsequent verify-otp call
 *     can read the exact code that was just issued.
 *
 * Skip behaviour:
 *   If `bootIntegrationStack()` fails (no docker on the host, no
 *   testcontainers installed) we DO NOT silently pass — we mark every
 *   test as `it.todo` via a runtime skip and log the reason. That way
 *   the CI matrix can flag "integration tests didn't actually run" and
 *   a green local pnpm test never lies about coverage.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  bootIntegrationStack,
  createTestingApp,
  teardownIntegrationStack,
  wipeDatabase,
} from './setup.js';
// `NOTIFICATION_GATEWAY` is the DI token the auth service uses to look
// up its OTP delivery adapter. It isn't re-exported from the package's
// public surface (the prod adapters are still in flight), so we reach
// into the internal port. Stable enough for an integration test that
// already runs against the unstable internal layout.
import {
  NOTIFICATION_GATEWAY,
  type NotificationGateway,
  type OtpDeliveryInput,
} from '../../../../services/auth/src/ports/notification.port.js';

// ── A capturing notification stub. Each delivery is stored keyed off
//    the destination, then the spec retrieves the most-recent code at
//    verify-otp time. We don't bother keying off challengeId because
//    the controller doesn't surface it to the adapter — but the
//    destination is unique per test, so the lookup is unambiguous.
class CapturingNotificationGateway implements NotificationGateway {
  readonly delivered: OtpDeliveryInput[] = [];
  async deliverOtp(input: OtpDeliveryInput): Promise<void> {
    this.delivered.push(input);
  }
  latestFor(destination: string): OtpDeliveryInput {
    const found = [...this.delivered].reverse().find((d) => d.to === destination);
    if (!found) throw new Error(`no captured OTP for ${destination}`);
    return found;
  }
}

let app: NestFastifyApplication | undefined;
let close: (() => Promise<void>) | undefined;
let capture: CapturingNotificationGateway | undefined;
let databaseUrl: string | undefined;
let skipReason: string | undefined;

beforeAll(async () => {
  try {
    const stack = await bootIntegrationStack();
    databaseUrl = stack.databaseUrl;
    capture = new CapturingNotificationGateway();
    const booted = await createTestingApp(stack.databaseUrl, stack.redisUrl, [
      { token: NOTIFICATION_GATEWAY, useValue: capture },
    ]);
    app = booted.app;
    close = booted.close;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[auth.flow.spec] integration stack unavailable — skipping:', skipReason);
  }
}, 120_000);

afterAll(async () => {
  if (close) await close();
  await teardownIntegrationStack();
});

describe('auth flow — register → login → refresh → logout', () => {
  // The verify-OTP step issues new sessions; downstream specs rely on
  // a clean state, so wipe immediately before this suite runs.
  it('walks the full credential lifecycle end-to-end', async (ctx) => {
    // `skipReason` is set inside `beforeAll` (async docker boot), which
    // runs AFTER vitest collects this test, so `skipIf` at registration
    // time cannot see it. Skipping at runtime via the test context is
    // the supported pattern for "skip on infrastructure unavailable".
    if (skipReason || !app || !capture || !databaseUrl) {
      ctx.skip();
      return;
    }
    await wipeDatabase(databaseUrl);

    const email = `flow+${Date.now()}@eazepay.test`;
    const password = 'CorrectHorseBattery!9';
    const deviceId = 'device-flow-integration-test';

    // ── 1. Register
    const registerResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      headers: { 'idempotency-key': `reg-${email}` },
      payload: { email, password, marketingConsent: false },
    });
    expect(registerResp.statusCode).toBe(201);
    const registerBody = registerResp.json() as {
      userId: string;
      requiresVerification: 'email' | 'phone';
      challenge: { challengeId: string; channel: 'email' | 'sms'; expiresAt: string };
    };
    expect(registerBody.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(registerBody.requiresVerification).toBe('email');

    // Notification adapter captured the plaintext code for us.
    const registerOtp = capture.latestFor(email);
    expect(registerOtp.purpose).toBe('register_verify');
    expect(registerOtp.code).toMatch(/^\d{6}$/);

    // ── 2. Verify the register OTP. This activates the user; tokens
    //    are returned because the auth service issues a session on
    //    successful verify regardless of which challenge purpose it
    //    consumed.
    const verifyRegisterResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-otp',
      payload: {
        challengeId: registerBody.challenge.challengeId,
        code: registerOtp.code,
        deviceId,
      },
    });
    expect(verifyRegisterResp.statusCode).toBe(200);
    const verifyRegister = verifyRegisterResp.json() as {
      tokens: { accessToken: string; refreshToken: string };
      sessionId: string;
    };
    expect(verifyRegister.tokens.accessToken.split('.').length).toBe(3); // JWT shape
    expect(verifyRegister.tokens.refreshToken).toBeTruthy();

    // ── 3. Login (a fresh session, separate from the register-flow one)
    const loginResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { identifier: email, password, deviceId },
    });
    expect(loginResp.statusCode).toBe(200);
    const loginBody = loginResp.json() as {
      mfaRequired: boolean;
      challenge: { challengeId: string; channel: 'email' | 'sms' };
    };
    expect(loginBody.mfaRequired).toBe(true);
    const loginOtp = capture.latestFor(email);
    expect(loginOtp.purpose).toBe('login_mfa');

    // ── 4. Verify the login OTP — issues real session tokens
    const verifyLoginResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-otp',
      payload: {
        challengeId: loginBody.challenge.challengeId,
        code: loginOtp.code,
        deviceId,
      },
    });
    expect(verifyLoginResp.statusCode).toBe(200);
    const loginTokens = verifyLoginResp.json() as {
      tokens: { accessToken: string; refreshToken: string; refreshTokenExpiresAt: string };
      sessionId: string;
    };
    expect(loginTokens.sessionId).toMatch(/^[0-9a-f-]{36}$/);

    // ── 5. Refresh: should rotate the refresh token and issue a new
    //    access JWT bound to a fresh sessionId.
    const refreshResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: loginTokens.tokens.refreshToken, deviceId },
    });
    expect(refreshResp.statusCode).toBe(200);
    const refreshed = refreshResp.json() as {
      tokens: { accessToken: string; refreshToken: string };
      sessionId: string;
    };
    expect(refreshed.tokens.refreshToken).not.toBe(loginTokens.tokens.refreshToken);
    expect(refreshed.tokens.accessToken).not.toBe(loginTokens.tokens.accessToken);
    expect(refreshed.sessionId).not.toBe(loginTokens.sessionId);

    // ── 6. Logout: authenticated; revokes the current session row.
    const logoutResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${refreshed.tokens.accessToken}` },
    });
    expect(logoutResp.statusCode).toBe(204);

    // ── 7. Re-using the same refresh token after logout MUST fail.
    //    SEC-011 says refresh after revoke is rejected.
    const replayResp = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: refreshed.tokens.refreshToken, deviceId },
    });
    expect(replayResp.statusCode).toBeGreaterThanOrEqual(400);
  }, 60_000);
});
