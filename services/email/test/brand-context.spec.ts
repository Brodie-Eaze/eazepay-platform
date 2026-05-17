import { describe, it, expect } from 'vitest';
import { resolveBrandContext, BRAND_EMAIL_CONTEXTS } from '../src/brand-context.js';

describe('resolveBrandContext', () => {
  it('returns medpay-flavored sender for medpay', () => {
    const ctx = resolveBrandContext('medpay');
    expect(ctx.brand).toBe('medpay');
    expect(ctx.brandName).toBe('MedPay');
    expect(ctx.fromAddress).toContain('@medpay.');
    expect(ctx.accentHex).toBe('#0e7c66');
  });

  it('returns tradepay-flavored sender for tradepay', () => {
    const ctx = resolveBrandContext('tradepay');
    expect(ctx.brandName).toBe('TradePay');
    expect(ctx.fromAddress).toContain('@tradepay.');
    expect(ctx.accentHex).toBe('#f97316');
  });

  it('returns coachpay-flavored sender for coachpay', () => {
    const ctx = resolveBrandContext('coachpay');
    expect(ctx.brandName).toBe('CoachPay');
    expect(ctx.fromAddress).toContain('@coachpay.');
    expect(ctx.accentHex).toBe('#6366f1');
  });

  it('returns operator-flavored sender for master', () => {
    const ctx = resolveBrandContext('master');
    expect(ctx.brand).toBe('master');
    expect(ctx.fromAddress).toContain('ops@');
    expect(ctx.fromAddress).not.toMatch(/medpay|tradepay|coachpay/);
  });

  it('each brand has distinct from-addresses (no shared sender)', () => {
    const seen = new Set<string>();
    for (const brand of ['medpay', 'tradepay', 'coachpay', 'direct', 'master'] as const) {
      const ctx = resolveBrandContext(brand);
      const addrPart = ctx.fromAddress.match(/<([^>]+)>/)?.[1] ?? ctx.fromAddress;
      expect(seen.has(addrPart)).toBe(false);
      seen.add(addrPart);
    }
    expect(seen.size).toBe(5);
  });

  it('BRAND_EMAIL_CONTEXTS exposes all 5 brands', () => {
    const keys = Object.keys(BRAND_EMAIL_CONTEXTS).sort();
    expect(keys).toEqual(['coachpay', 'direct', 'master', 'medpay', 'tradepay']);
  });

  it('every context has a non-empty legal entity (CAN-SPAM footer)', () => {
    for (const brand of ['medpay', 'tradepay', 'coachpay', 'direct', 'master'] as const) {
      expect(resolveBrandContext(brand).legalEntity.length).toBeGreaterThan(0);
    }
  });
});
