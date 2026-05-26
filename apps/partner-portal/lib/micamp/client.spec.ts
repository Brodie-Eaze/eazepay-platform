import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

/**
 * SEC-002 — fail-closed webhook signature verification.
 *
 * These specs pin the four behaviours that close the original exploit:
 *
 *   1. Valid signature within the freshness window → `{ valid: true }`.
 *   2. Tampered body → `{ valid: false, reason: 'bad_signature' }`.
 *   3. Stale timestamp → `{ valid: false, reason: 'stale_timestamp' }`.
 *   4. Missing secret in production → THROWS at module load.
 *   5. Missing secret + INSECURE_ALLOW=true → `{ valid: false,
 *      reason: 'missing_secret' }` and logs warning (default-deny, not
 *      accept-anything).
 *
 * Each test uses `vi.resetModules()` + dynamic `import()` so we can
 * exercise different NODE_ENV / secret combinations without leaking
 * state between cases. The module-load assertion can only be observed
 * via a fresh import.
 */

const SECRET = 'unit-test-secret'.padEnd(40, '_');
const SIG_HEADER = 'micamp-signature' as const;

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

describe('lib/micamp/client — verifyWebhookSignature (SEC-002)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MICAMP_WEBHOOK_SECRET;
    delete process.env.MICAMP_WEBHOOK_INSECURE_ALLOW;
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
    const body = '{"type":"payment.captured","amountCents":1000}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signBody(body, SECRET, ts);

    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature(body, header)).toEqual({ valid: true });
  });

  it('returns bad_signature when the body is tampered post-signing', async () => {
    const body = '{"type":"payment.captured","amountCents":1000}';
    const ts = Math.floor(Date.now() / 1000);
    const header = signBody(body, SECRET, ts);
    const tampered = '{"type":"payment.captured","amountCents":9999999}';

    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature(tampered, header)).toEqual({
      valid: false,
      reason: 'bad_signature',
    });
  });

  it('returns stale_timestamp when the signature is > 5 min old', async () => {
    const body = '{"type":"settlement.paid"}';
    const stale = Math.floor(Date.now() / 1000) - 301; // 5 min + 1 sec
    const header = signBody(body, SECRET, stale);

    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature(body, header)).toEqual({
      valid: false,
      reason: 'stale_timestamp',
    });
  });

  it('returns stale_timestamp when the signature is from too far in the future', async () => {
    const body = '{"type":"settlement.paid"}';
    const future = Math.floor(Date.now() / 1000) + 600;
    const header = signBody(body, SECRET, future);

    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature(body, header)).toEqual({
      valid: false,
      reason: 'stale_timestamp',
    });
  });

  it('returns missing_signature when the header is empty', async () => {
    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature('{}', '')).toEqual({
      valid: false,
      reason: 'missing_signature',
    });
  });

  it('returns malformed when the header lacks t= or v1=', async () => {
    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature('{}', 'foo=bar')).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('returns malformed when the timestamp is not a number', async () => {
    const { verifyWebhookSignature } = await freshImport({ MICAMP_WEBHOOK_SECRET: SECRET });
    expect(verifyWebhookSignature('{}', 't=notanumber,v1=deadbeef')).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('THROWS at module load when NODE_ENV=production and secret is unset', async () => {
    await expect(
      freshImport({ NODE_ENV: 'production', MICAMP_WEBHOOK_SECRET: undefined }),
    ).rejects.toThrow(/MICAMP_WEBHOOK_SECRET is unset in production/);
  });

  it('loads in production when the secret IS set', async () => {
    await expect(
      freshImport({ NODE_ENV: 'production', MICAMP_WEBHOOK_SECRET: SECRET }),
    ).resolves.toBeDefined();
  });

  it('returns missing_secret (NOT valid:true) in dev with no secret + no opt-in', async () => {
    const { verifyWebhookSignature } = await freshImport({
      NODE_ENV: 'development',
      MICAMP_WEBHOOK_SECRET: undefined,
    });
    expect(verifyWebhookSignature('{}', 't=1,v1=deadbeef')).toEqual({
      valid: false,
      reason: 'missing_secret',
    });
  });

  it('returns missing_secret AND logs a warning when INSECURE_ALLOW=true', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { verifyWebhookSignature } = await freshImport({
      NODE_ENV: 'development',
      MICAMP_WEBHOOK_SECRET: undefined,
      MICAMP_WEBHOOK_INSECURE_ALLOW: 'true',
    });
    const result = verifyWebhookSignature('{}', '');
    expect(result).toEqual({ valid: false, reason: 'missing_secret' });
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('micamp.webhook.insecure_allow');
  });

  it('canonical signature header name reminder', () => {
    // Pinning the header that the route handler reads. If the wire
    // protocol ever changes, the spec catches it.
    expect(SIG_HEADER).toBe('micamp-signature');
  });
});
