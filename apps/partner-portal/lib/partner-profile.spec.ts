import { describe, it, expect } from 'vitest';
import {
  currentPartnerForBrand,
  partnerShareOfBrand,
  scaleByPartnerShare,
  partnerVariance,
  brandDisplayName,
} from './partner-profile';
import { partners as MASTER_PARTNERS } from './master-data';

describe('partner-profile', () => {
  describe('currentPartnerForBrand', () => {
    it('resolves medpay → p_helio', () => {
      const p = currentPartnerForBrand('medpay');
      expect(p?.id).toBe('p_helio');
      expect(p?.legalName).toBe('Helio Dental Group');
      expect(p?.product).toBe('MedPay');
    });

    it('resolves tradepay → p_orion', () => {
      const p = currentPartnerForBrand('tradepay');
      expect(p?.id).toBe('p_orion');
      expect(p?.legalName).toBe('Orion Roof & Solar');
    });

    it('resolves coachpay → p_atlas', () => {
      const p = currentPartnerForBrand('coachpay');
      expect(p?.id).toBe('p_atlas');
      expect(p?.legalName).toBe('Atlas Executive Coaching');
    });
  });

  describe('partnerShareOfBrand', () => {
    it('returns a fraction in [0, 1] for an in-brand partner', () => {
      const helio = MASTER_PARTNERS.find((p) => p.id === 'p_helio')!;
      const share = partnerShareOfBrand(helio, 'medpay');
      expect(share).toBeGreaterThan(0);
      expect(share).toBeLessThanOrEqual(1);
    });

    it('returns 0 for an out-of-brand partner', () => {
      const helio = MASTER_PARTNERS.find((p) => p.id === 'p_helio')!;
      // Helio is MedPay; asking for its share of TradePay → 0.
      expect(partnerShareOfBrand(helio, 'tradepay')).toBe(0);
    });

    it('shares sum to <= 1 across same-brand partners', () => {
      const medpayPartners = MASTER_PARTNERS.filter(
        (p) => p.product === 'MedPay' || p.product === 'Multi-brand',
      );
      const sum = medpayPartners.reduce((s, p) => s + partnerShareOfBrand(p, 'medpay'), 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('scaleByPartnerShare', () => {
    it('scales a brand-aggregate volume down to the partner slice', () => {
      const helio = MASTER_PARTNERS.find((p) => p.id === 'p_helio')!;
      const brandTotal = 2294; // example brand-aggregate funnel.applications
      const helioCount = scaleByPartnerShare(brandTotal, helio, 'medpay');
      expect(helioCount).toBeGreaterThan(0);
      expect(helioCount).toBeLessThan(brandTotal);
    });

    it('out-of-brand partner gets 0', () => {
      const helio = MASTER_PARTNERS.find((p) => p.id === 'p_helio')!;
      expect(scaleByPartnerShare(2294, helio, 'tradepay')).toBe(0);
    });

    it('returns an integer (no fractional loan counts)', () => {
      const helio = MASTER_PARTNERS.find((p) => p.id === 'p_helio')!;
      expect(Number.isInteger(scaleByPartnerShare(2294, helio, 'medpay'))).toBe(true);
    });
  });

  describe('partnerVariance', () => {
    it('is deterministic for the same id', () => {
      const a = partnerVariance('p_helio', 0.05);
      const b = partnerVariance('p_helio', 0.05);
      expect(a).toBe(b);
    });

    it('differs across partner ids', () => {
      const a = partnerVariance('p_helio', 0.05);
      const b = partnerVariance('p_orion', 0.05);
      expect(a).not.toBe(b);
    });

    it('respects amplitude bound', () => {
      const v = partnerVariance('p_anything', 0.05);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.05);
    });
  });

  describe('brandDisplayName', () => {
    it('returns the canonical name', () => {
      expect(brandDisplayName('medpay')).toBe('MedPay');
      expect(brandDisplayName('tradepay')).toBe('TradePay');
      expect(brandDisplayName('coachpay')).toBe('CoachPay');
    });
  });
});
