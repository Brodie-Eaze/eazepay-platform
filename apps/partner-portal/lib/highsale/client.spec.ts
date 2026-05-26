import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * SEC-002 — fail-closed webhook signature verification for HighSale +
 * Milly inbound webhooks. Mirrors the MiCamp spec; see
 * `lib/micamp/client.spec.ts` for the rationale comment block.
 */

const SECRET = 'unit-test-secret'.padEnd(40, '_');

function signBody(body: string, secret: string, timestampSeconds: number): string {
  const hex = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');
  return `t=${timestampSeconds},v1=${hex}`;
}

async function freshImport(
  env: Record<string, string | undefined>,
): Promise<typeof import('./client')> {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  vi.resetModules();
  return await import('./client');
}

describe('lib/highsale/client — verifyHighsaleSignature (SEC-002)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.HIGHSALE_WEBHOOK_SECRET;
    delete process.env.HIGHSALE_WEBHOOK_INSECURE_ALLOW;
    (process.env as Record<string, string>).NODE_ENV = 'test';
    vi.useRealTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns { valid: true } for a fresh, well-formed signature', async () => {
    const body = '{"type":"milly.invoice.paid","amountCents":12300}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signBody(body, SECRET, ts);

    const { verifyHighsaleSignature } = await freshImport({ HIGHSALE_WEBHOOK_SECRET: SECRET });
    expect(verifyHighsaleSignature(body, header)).toEqual({ valid: true });
  });

  it('returns bad_signature when the body is tampered post-signing', async () => {
    const body = '{"type":"milly.invoice.paid","amountCents":12300}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signBody(body, SECRET, ts);
    const tampered = '{"type":"milly.invoice.paid","amountCents":99999900}';

    const { verifyHighsaleSignature } = await freshImport({ HIGHSALE_WEBHOOK_SECRET: SECRET });
    expect(verifyHighsaleSignature(tampered, header)).toEqual({
      valid: false,
      reason: 'bad_signature',
    });
  });

  it('returns stale_timestamp when the signature is > 5 min old', async () => {
    const body = '{"type":"pull.completed"}';
    const stale = Math.floor(Date.now() / 1000) - 301;
    const header = signBody(body, SECRET, stale);

    const { verifyHighsaleSignature } = await freshImport({ HIGHSALE_WEBHOOK_SECRET: SECRET });
    expect(verifyHighsaleSignature(body, header)).toEqual({
      valid: false,
      reason: 'stale_timestamp',
    });
  });

  it('returns missing_signature when the header is empty', async () => {
    const { verifyHighsaleSignature } = await freshImport({ HIGHSALE_WEBHOOK_SECRET: SECRET });
    expect(verifyHighsaleSignature('{}', '')).toEqual({
      valid: false,
      reason: 'missing_signature',
    });
  });

  it('returns malformed when the header lacks t= or v1=', async () => {
    const { verifyHighsaleSignature } = await freshImport({ HIGHSALE_WEBHOOK_SECRET: SECRET });
    expect(verifyHighsaleSignature('{}', 'foo=bar')).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('THROWS at module load when NODE_ENV=production and secret is unset', async () => {
    await expect(
      freshImport({ NODE_ENV: 'production', HIGHSALE_WEBHOOK_SECRET: undefined }),
    ).rejects.toThrow(/HIGHSALE_WEBHOOK_SECRET is unset in production/);
  });

  it('loads in production when the secret IS set', async () => {
    await expect(
      freshImport({ NODE_ENV: 'production', HIGHSALE_WEBHOOK_SECRET: SECRET }),
    ).resolves.toBeDefined();
  });

  it('returns missing_secret in dev with no secret + no opt-in', async () => {
    const { verifyHighsaleSignature } = await freshImport({
      NODE_ENV: 'development',
      HIGHSALE_WEBHOOK_SECRET: undefined,
    });
    expect(verifyHighsaleSignature('{}', 't=1,v1=deadbeef')).toEqual({
      valid: false,
      reason: 'missing_secret',
    });
  });

  it('returns missing_secret AND logs a warning when INSECURE_ALLOW=true', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { verifyHighsaleSignature } = await freshImport({
      NODE_ENV: 'development',
      HIGHSALE_WEBHOOK_SECRET: undefined,
      HIGHSALE_WEBHOOK_INSECURE_ALLOW: 'true',
    });
    const result = verifyHighsaleSignature('{}', '');
    expect(result).toEqual({ valid: false, reason: 'missing_secret' });
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('highsale.webhook.insecure_allow');
  });
});
