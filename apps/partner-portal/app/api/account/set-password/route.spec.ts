import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import {
  mintWelcomeToken,
  __resetWelcomeTokensForTests,
} from '../../../../lib/welcome-tokens';
import { __resetEdgeRateLimitForTests } from '../../../../lib/edge-rate-limit';
import {
  _resetAccountsForTest,
  createInvitedAccount,
} from '../../../../lib/accounts-store';
import { _resetMetricsForTest, getMetricsSnapshot } from '../../../../lib/observability/metrics';

/**
 * SEC-201 — route-level coverage of the welcome-token swap.
 *
 * The CSRF guard is satisfied by sending matching `x-csrf-token`
 * header + `eazepay_csrf` cookie (double-submit pattern). Each test
 * resets the rate-limit + accounts + welcome-token stores so cases
 * are hermetic.
 */

const STRONG_PASSWORD = 'CorrectHorseBattery!9';

async function postSetPassword(body: unknown): Promise<Response> {
  const csrf = 'a'.repeat(64); // 32-byte hex CSRF token (matches mintCsrfToken length)
  return POST(
    new NextRequest('http://localhost/api/account/set-password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrf,
        cookie: `eazepay_csrf=${csrf}`,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe('POST /api/account/set-password (SEC-201)', () => {
  beforeEach(async () => {
    __resetWelcomeTokensForTests();
    __resetEdgeRateLimitForTests();
    await _resetAccountsForTest();
    _resetMetricsForTest();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  async function seedInvitedAccount(): Promise<string> {
    const { userId } = await createInvitedAccount({
      email: 'owner@example.com',
      displayName: 'Owner Example',
      brand: 'medpay',
      partnerId: 'p_helio',
      role: 'Owner',
    });
    return userId;
  }

  it('happy path: valid token + strong password sets the session cookie', async () => {
    const userId = await seedInvitedAccount();
    const token = await mintWelcomeToken(userId, 'welcome');
    const res = await postSetPassword({ token, newPassword: STRONG_PASSWORD });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; brand: string };
    expect(body.ok).toBe(true);
    expect(body.brand).toBe('medpay');
    // Session cookie present.
    expect(res.headers.get('set-cookie')).toMatch(/eazepay_account=/);
  });

  it('rejects the legacy {userId, newPassword} body with 400 token_required', async () => {
    const userId = await seedInvitedAccount();
    const res = await postSetPassword({ userId, newPassword: STRONG_PASSWORD });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('token_required');
    // Counter ticked so the dashboard surfaces the legacy call.
    expect(getMetricsSnapshot()['welcome.legacy_userid_attempt']).toBe(1);
  });

  it('rejects an unknown token with 410 token_invalid', async () => {
    await seedInvitedAccount();
    const res = await postSetPassword({
      token: 'a'.repeat(64),
      newPassword: STRONG_PASSWORD,
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('token_invalid');
  });

  it('replay: a second POST of the same token fails with 410', async () => {
    const userId = await seedInvitedAccount();
    const token = await mintWelcomeToken(userId, 'welcome');
    const first = await postSetPassword({ token, newPassword: STRONG_PASSWORD });
    expect(first.status).toBe(200);
    const second = await postSetPassword({ token, newPassword: STRONG_PASSWORD });
    expect(second.status).toBe(410);
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('token_invalid');
  });

  it('rejects malformed token (not 64-hex) with 400 invalid_set_password_payload', async () => {
    const res = await postSetPassword({ token: 'not-hex', newPassword: STRONG_PASSWORD });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('invalid_set_password_payload');
  });

  it('rejects weak password (Zod) with 400', async () => {
    const userId = await seedInvitedAccount();
    const token = await mintWelcomeToken(userId, 'welcome');
    const res = await postSetPassword({ token, newPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown extra fields (Zod strict) with 400', async () => {
    const userId = await seedInvitedAccount();
    const token = await mintWelcomeToken(userId, 'welcome');
    const res = await postSetPassword({
      token,
      newPassword: STRONG_PASSWORD,
      extra: 'attacker-injected',
    });
    expect(res.status).toBe(400);
  });
});
