import { describe, expect, it } from 'vitest';
import { TEMPLATES, getTemplate } from '../src/templates/registry.js';

describe('Notification template registry', () => {
  it('exposes every documented MVP template key', () => {
    const keys = Object.keys(TEMPLATES).sort();
    expect(keys).toEqual(
      [
        'application.contracted',
        'application.declined',
        'application.funded',
        'application.funding_failed',
        'application.offers_presented',
        'payment.repayment.collected',
        'payment.repayment.failed',
      ].sort(),
    );
  });

  it('getTemplate returns undefined for unknown keys (not throw)', () => {
    expect(getTemplate('does.not.exist')).toBeUndefined();
  });

  it('getTemplate returns the same registry reference', () => {
    expect(getTemplate('application.funded')).toBe(TEMPLATES['application.funded']);
  });

  describe('per-template channel lists (priority-ordered)', () => {
    it('application.offers_presented → push, email, in_app', () => {
      expect(TEMPLATES['application.offers_presented']!.channels).toEqual([
        'push',
        'email',
        'in_app',
      ]);
    });
    it('application.declined → email, in_app (no push: privacy)', () => {
      expect(TEMPLATES['application.declined']!.channels).toEqual(['email', 'in_app']);
    });
    it('payment.repayment.failed → push, email, sms, in_app (loudest channel mix)', () => {
      expect(TEMPLATES['payment.repayment.failed']!.channels).toEqual([
        'push',
        'email',
        'sms',
        'in_app',
      ]);
    });
  });

  describe('render: required fields are surfaced verbatim', () => {
    it('application.funded renders principalCents as $X.XX and firstPaymentDate verbatim', () => {
      const t = TEMPLATES['application.funded']!;
      expect(t.title({})).toBe('Your funds have been disbursed');
      const body = t.body({ principalCents: 1_000_000, firstPaymentDate: '2026-07-01' });
      expect(body).toContain('$10000.00');
      expect(body).toContain('2026-07-01');
    });

    it('application.funded accepts bigint principalCents (Prisma typical)', () => {
      const t = TEMPLATES['application.funded']!;
      expect(t.body({ principalCents: 250_000n, firstPaymentDate: '2026-08-15' })).toContain(
        '$2500.00',
      );
    });

    it('application.funded falls back to "$0.00" / "soon" when fields are absent', () => {
      const t = TEMPLATES['application.funded']!;
      expect(t.body({})).toContain('$0.00');
      expect(t.body({})).toContain('soon');
    });

    it('application.offers_presented renders offerCount with "a few" fallback', () => {
      const t = TEMPLATES['application.offers_presented']!;
      expect(t.body({ offerCount: 3 })).toContain('3 offers');
      expect(t.body({})).toContain('a few offers');
    });

    it('application.contracted renders lenderOfRecord verbatim with fallback', () => {
      const t = TEMPLATES['application.contracted']!;
      expect(t.body({ lenderOfRecord: 'Mock Prime Bank, N.A.' })).toContain('Mock Prime Bank, N.A.');
      expect(t.body({})).toContain('your lender');
    });

    it('payment.repayment.failed surfaces reasonCode and amount', () => {
      const t = TEMPLATES['payment.repayment.failed']!;
      const body = t.body({ amountCents: 12_345, reasonCode: 'insufficient_funds' });
      expect(body).toContain('$123.45');
      expect(body).toContain('insufficient_funds');
    });

    it('application.declined body references the FCRA & ECOA notice rights', () => {
      const t = TEMPLATES['application.declined']!;
      const body = t.body({});
      expect(body).toContain('Adverse Action Notice');
      expect(body).toContain('Fair Credit Reporting Act');
      expect(body).toContain('Equal Credit Opportunity Act');
    });
  });

  it('every template body is ≤ 1600 chars (SMS-safe ceiling per registry contract)', () => {
    for (const t of Object.values(TEMPLATES)) {
      expect(t.body({}).length).toBeLessThanOrEqual(1600);
    }
  });
});
