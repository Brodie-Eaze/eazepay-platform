import { describe, expect, it } from 'vitest';
import { ADVERSE_ACTION_REASON_CODES } from '../../admin/src/reason-codes.js';
import { buildAdverseActionNotice } from '../src/notices/adverse-action-builder.js';

const recipient = { legalName: 'Jane Doe', email: 'j@x.com' };
const application = {
  id: 'app-1',
  amountDisplay: '$10,000.00',
  termDisplay: '36 months',
  categoryDisplay: 'Personal',
  decisionDate: '2026-05-27',
};
const lenderOfRecord = {
  legalName: 'Partner Bank, N.A.',
  addressLine1: '123 Banking Way',
  city: 'New York',
  state: 'NY',
  zip: '10001',
};

describe('buildAdverseActionNotice — characterisation', () => {
  it('maps each reasonCode to its consumer-readable line in input order', () => {
    const out = buildAdverseActionNotice({
      recipient,
      application,
      lenderOfRecord,
      reasonCodes: ['credit_score_below_threshold', 'debt_to_income_too_high'],
      policyVersion: 'v1',
    });
    expect(out.reasons).toEqual([
      ADVERSE_ACTION_REASON_CODES.credit_score_below_threshold,
      ADVERSE_ACTION_REASON_CODES.debt_to_income_too_high,
    ]);
    expect(out.reasonCodes).toEqual(['credit_score_below_threshold', 'debt_to_income_too_high']);
  });

  it('fails closed: unknown reason code throws (never ships placeholder line)', () => {
    expect(() =>
      buildAdverseActionNotice({
        recipient,
        application,
        lenderOfRecord,
        reasonCodes: ['credit_score_below_threshold', 'this_code_is_unknown'],
        policyVersion: 'v1',
      }),
    ).toThrow(/unknown reason code/);
  });

  it('every documented Reg B / FCRA code resolves (full taxonomy coverage)', () => {
    for (const code of Object.keys(ADVERSE_ACTION_REASON_CODES)) {
      expect(() =>
        buildAdverseActionNotice({
          recipient,
          application,
          lenderOfRecord,
          reasonCodes: [code],
          policyVersion: 'v1',
        }),
      ).not.toThrow();
    }
  });

  it('omits bureau when not provided; preserves it when provided', () => {
    const noBureau = buildAdverseActionNotice({
      recipient,
      application,
      lenderOfRecord,
      reasonCodes: ['credit_score_below_threshold'],
      policyVersion: 'v1',
    });
    expect(noBureau.bureau).toBeUndefined();

    const withBureau = buildAdverseActionNotice({
      recipient,
      application,
      lenderOfRecord,
      reasonCodes: ['credit_score_below_threshold'],
      bureau: {
        name: 'Experian',
        addressLine1: '475 Anton Blvd',
        city: 'Costa Mesa',
        state: 'CA',
        zip: '92626',
        phone: '1-888-397-3742',
        score: 640,
        scoreRangeDisplay: '300-850',
        keyFactors: ['Length of credit history', 'High utilisation'],
      },
      policyVersion: 'v1',
    });
    expect(withBureau.bureau?.name).toBe('Experian');
    expect(withBureau.bureau?.score).toBe(640);
  });

  it('stamps policyVersion verbatim and produces an ISO generatedAt', () => {
    const out = buildAdverseActionNotice({
      recipient,
      application,
      lenderOfRecord,
      reasonCodes: ['credit_score_below_threshold'],
      policyVersion: 'reg-b-2026-05-02',
    });
    expect(out.policyVersion).toBe('reg-b-2026-05-02');
    expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(() => new Date(out.generatedAt)).not.toThrow();
  });
});
