import { describe, expect, it } from 'vitest';
import { MockDeviceRiskAdapter } from '../src/adapters/mock-device-risk.adapter.js';
import { MockIdentityRiskAdapter } from '../src/adapters/mock-identity-risk.adapter.js';

describe('MockDeviceRiskAdapter heuristics', () => {
  const a = new MockDeviceRiskAdapter();

  it('flags risky-prefixed fingerprints high', async () => {
    const r = await a.evaluate({ deviceFingerprint: 'risky-abc', ipAddress: '1.2.3.4' });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('flags bot user-agents medium-high', async () => {
    const r = await a.evaluate({ userAgent: 'curl/7.x' });
    expect(r.score).toBe(75);
  });

  it('returns null when no signal', async () => {
    const r = await a.evaluate({});
    expect(r.score).toBeNull();
  });

  it('low risk on a normal session', async () => {
    const r = await a.evaluate({ deviceFingerprint: 'fp-normal', userAgent: 'Mozilla/5.0' });
    expect(r.score).toBe(5);
  });
});

describe('MockIdentityRiskAdapter heuristics', () => {
  const a = new MockIdentityRiskAdapter();

  it('flags disposable domains as medium', async () => {
    const r = await a.evaluate({ email: 'x@mailinator.com' });
    expect(r.emailScore).toBe(70);
  });

  it('flags +test+risky as high', async () => {
    const r = await a.evaluate({ email: 'me+test+risky@example.com' });
    expect(r.emailScore).toBe(90);
  });

  it('flags +1555 phone numbers as medium', async () => {
    const r = await a.evaluate({ phone: '+15555550123' });
    expect(r.phoneScore).toBe(70);
  });

  it('low risk on normal inputs', async () => {
    const r = await a.evaluate({ email: 'me@example.com', phone: '+12025550123' });
    expect(r.emailScore).toBe(10);
    expect(r.phoneScore).toBe(10);
  });
});
