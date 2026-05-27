import { describe, it, expect, afterEach } from 'vitest';
import { resolveClientIp } from './client-ip';

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers });
}

describe('resolveClientIp (SEC-203)', () => {
  const originalHops = process.env.TRUSTED_PROXY_HOPS;
  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = originalHops;
  });

  it('returns X-Real-IP when no XFF present', () => {
    expect(resolveClientIp(makeReq({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('returns unknown when no headers present', () => {
    expect(resolveClientIp(makeReq({}))).toBe('unknown');
  });

  it('with default N=1, returns the entry the trusted edge hop wrote (rightmost)', () => {
    // chain: client(1.1.1.1) → edge. Edge appends the remote-addr it
    // saw, so XFF on arrival is "1.1.1.1, <edge-observation>". With
    // one trusted hop, idx = length - N = 1 → '10.0.0.1' (what the
    // edge saw on the socket, the address NOT under client control).
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1' }))).toBe('10.0.0.1');
  });

  it('REJECTS spoofed leftmost entry — attacker prepends, we ignore it', () => {
    // Attacker sends X-Forwarded-For: 9.9.9.9 to spoof an identity.
    // Railway's edge then appends the real source (1.1.1.1) and forwards.
    // XFF on arrival: "9.9.9.9, 1.1.1.1". We must return 1.1.1.1, not 9.9.9.9.
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))).toBe('1.1.1.1');
  });

  it('with N=1 and a single XFF entry, returns that entry (it was written by the trusted hop)', () => {
    // length=1, idx = length - N = 0 → return entry 0. The single
    // entry IS what our edge saw as its remote address, which is what
    // we want to attribute.
    expect(
      resolveClientIp(makeReq({ 'x-forwarded-for': '10.0.0.1', 'x-real-ip': '1.2.3.4' })),
    ).toBe('10.0.0.1');
  });

  it('falls back to X-Real-IP when XFF length is below the trusted-hop count (chain shorter than configured)', () => {
    process.env.TRUSTED_PROXY_HOPS = '3';
    // N=3 trusted hops expected, but only 2 entries in XFF — chain
    // shape doesn't match config; safer to fall back than to return
    // an attacker-controlled leftmost.
    expect(
      resolveClientIp(makeReq({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1', 'x-real-ip': '2.2.2.2' })),
    ).toBe('2.2.2.2');
  });

  it('honours TRUSTED_PROXY_HOPS=2 for chained-proxy deployments (CF → Railway)', () => {
    process.env.TRUSTED_PROXY_HOPS = '2';
    // chain: client(1.1.1.1) → cloudflare → railway → app
    // XFF written by 2 trusted hops: rightmost 2 entries are provable.
    // The entry the outermost trusted hop saw (idx length-N) is the
    // "client as observed by CF".
    expect(
      resolveClientIp(makeReq({ 'x-forwarded-for': '1.1.1.1, cf-ingress, railway-edge' })),
    ).toBe('cf-ingress');
  });

  it('rejects TRUSTED_PROXY_HOPS=0 (would re-enable leftmost spoof)', () => {
    process.env.TRUSTED_PROXY_HOPS = '0';
    // 0 is invalid — falls back to default 1, NOT to "trust the leftmost".
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))).toBe('1.1.1.1');
  });

  it('rejects negative / NaN TRUSTED_PROXY_HOPS, falls back to default', () => {
    process.env.TRUSTED_PROXY_HOPS = '-3';
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))).toBe('1.1.1.1');
    process.env.TRUSTED_PROXY_HOPS = 'banana';
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '9.9.9.9, 1.1.1.1' }))).toBe('1.1.1.1');
  });

  it('handles whitespace / empty entries in XFF safely', () => {
    // Empties filtered out → effective chain [1.1.1.1, 10.0.0.1].
    // N=1 → idx 1 → '10.0.0.1' (the address our edge saw as remote).
    expect(resolveClientIp(makeReq({ 'x-forwarded-for': '  1.1.1.1 ,  , 10.0.0.1  ' }))).toBe(
      '10.0.0.1',
    );
  });
});
