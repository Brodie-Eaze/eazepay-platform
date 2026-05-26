import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  BRAND_CODES,
  BRAND_LABEL,
  LENDER_STATUSES,
  LENDER_STATUS_LABEL,
  MID_STATUSES,
  MID_STATUS_LABEL,
  NICHES_BY_BRAND,
  NICHE_LABEL,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABEL,
  WEBHOOK_STATUSES,
  WEBHOOK_STATUS_LABEL,
  brandForNiche,
  isBrand,
  isNiche,
  nichesForBrand,
  normalizeLenderStatus,
  normalizePartnerStatus,
} from '../src/taxonomy.js';

describe('taxonomy / brands', () => {
  it('BRAND_CODES has the three consumer brands and no direct', () => {
    expect(BRAND_CODES).toEqual(['medpay', 'tradepay', 'coachpay']);
    expect((BRAND_CODES as readonly string[]).includes('direct')).toBe(false);
  });

  it('every brand has a label', () => {
    for (const b of BRAND_CODES) {
      expect(typeof BRAND_LABEL[b]).toBe('string');
      expect(BRAND_LABEL[b].length).toBeGreaterThan(0);
    }
  });

  it('isBrand narrows correctly', () => {
    expect(isBrand('medpay')).toBe(true);
    expect(isBrand('direct')).toBe(false);
    expect(isBrand('mortgage')).toBe(false);
  });
});

describe('taxonomy / niches', () => {
  it('every niche maps back to its brand', () => {
    for (const brand of BRAND_CODES) {
      for (const niche of NICHES_BY_BRAND[brand]) {
        expect(brandForNiche(niche)).toBe(brand);
      }
    }
  });

  it('every niche has a label', () => {
    for (const brand of BRAND_CODES) {
      for (const niche of NICHES_BY_BRAND[brand]) {
        expect(typeof NICHE_LABEL[niche]).toBe('string');
      }
    }
  });

  it('nichesForBrand returns the right set', () => {
    expect(nichesForBrand('medpay')).toEqual(['medical', 'dental', 'wellness', 'veterinary']);
  });

  it('isNiche rejects unknown', () => {
    expect(isNiche('dental')).toBe(true);
    expect(isNiche('consumer')).toBe(false); // orphan from old master-data
    expect(isNiche('')).toBe(false);
  });
});

describe('taxonomy / application status', () => {
  it('mirrors the pgEnum order', () => {
    expect(APPLICATION_STATUSES).toEqual([
      'submitted',
      'in_review',
      'approved',
      'funded',
      'declined',
    ]);
  });
  it('has a label for each status', () => {
    for (const s of APPLICATION_STATUSES) expect(APPLICATION_STATUS_LABEL[s]).toBeTruthy();
  });
});

describe('taxonomy / partner status', () => {
  it('canonical values are active/pending/suspended/archived', () => {
    expect(PARTNER_STATUSES).toEqual(['active', 'pending', 'suspended', 'archived']);
  });
  it('legacy "approved" normalizes to active', () => {
    expect(normalizePartnerStatus('approved')).toBe('active');
    expect(normalizePartnerStatus('Approved')).toBe('active');
  });
  it('canonical values round-trip', () => {
    for (const s of PARTNER_STATUSES) expect(normalizePartnerStatus(s)).toBe(s);
  });
  it('unknown values return undefined', () => {
    expect(normalizePartnerStatus('mystery')).toBeUndefined();
  });
  it('has a label for each status', () => {
    for (const s of PARTNER_STATUSES) expect(PARTNER_STATUS_LABEL[s]).toBeTruthy();
  });
});

describe('taxonomy / lender status', () => {
  it('canonical excludes the legacy "disabled" alias', () => {
    expect(LENDER_STATUSES).toEqual(['live', 'pending_integration', 'paused', 'archived']);
    expect((LENDER_STATUSES as readonly string[]).includes('disabled')).toBe(false);
  });
  it('"disabled" normalizes to paused', () => {
    expect(normalizeLenderStatus('disabled')).toBe('paused');
    expect(normalizeLenderStatus('DISABLED')).toBe('paused');
  });
  it('canonical values round-trip', () => {
    for (const s of LENDER_STATUSES) expect(normalizeLenderStatus(s)).toBe(s);
  });
  it('unknown values return undefined', () => {
    expect(normalizeLenderStatus('zombie')).toBeUndefined();
  });
  it('has a label for each status', () => {
    for (const s of LENDER_STATUSES) expect(LENDER_STATUS_LABEL[s]).toBeTruthy();
  });
});

describe('taxonomy / mid + webhook', () => {
  it('mid statuses labelled', () => {
    for (const s of MID_STATUSES) expect(MID_STATUS_LABEL[s]).toBeTruthy();
  });
  it('webhook statuses labelled', () => {
    for (const s of WEBHOOK_STATUSES) expect(WEBHOOK_STATUS_LABEL[s]).toBeTruthy();
  });
});
