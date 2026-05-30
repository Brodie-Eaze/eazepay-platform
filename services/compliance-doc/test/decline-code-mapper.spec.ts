import { describe, expect, it } from 'vitest';
import { ADVERSE_ACTION_REASON_CODES, isValidReasonCode } from '@eazepay/service-admin';
import {
  LAWYER_REVIEW_REQUIRED_CODES,
  RAW_DECLINE_CODE_MAP,
  UnmappableDeclineCodeError,
  lookupDeclineCode,
  normalizeDeclineCodes,
} from '../src/notices/decline-code-mapper.js';
import { buildAdverseActionNotice } from '../src/notices/adverse-action-builder.js';

/**
 * ECOA-02 regression suite.
 *
 * The canonical list below is EVERY raw decline/exclusion code the
 * platform can emit into `application.declineReasonCodes`, enumerated by
 * reading the lender adapters, the risk service + its mock providers, and
 * the orchestration/decision policy. If a new raw code is introduced
 * without a mapping, `normalizeDeclineCodes` throws and these tests fail —
 * which is the point: a raw code with no Reg B mapping must never reach a
 * statutory notice silently.
 */
const RAW_ADAPTER_DECLINE_CODES = [
  // --- lender adapters (services/lender/src/adapters/*) ---
  'affordability_fail',
  'amount_above_max',
  'term_out_of_range',
  'risk_score_below_threshold',
  'requires_manual_review', // us-bank status mapping
  'requires_manual_underwriting', // queen-street status mapping
  'pending_manual_review', // engine-tech status mapping
  'rate_limited', // queen-street 429
  // --- orchestration synthetic per-lender failures ---
  'adapter_timeout',
  'adapter_exception',
  // --- risk gate (services/risk/src/policy.ts RISK_REASON_CODES) ---
  'velocity_user_24h',
  'velocity_ip_24h',
  'velocity_device_24h',
  'device_provider_high_risk',
  'email_provider_high_risk',
  'phone_provider_high_risk',
  'prior_charge_off',
  // --- risk mock providers (DEV) ---
  'mock_risky_device_fingerprint',
  'mock_automated_user_agent',
  'mock_no_signal',
  'mock_email_test_risky',
  'mock_email_disposable_domain',
  'mock_phone_test_prefix',
  // --- orchestration/decision policy own codes ---
  'underwriting_system_error',
] as const;

/** Codes the decision service already emits as valid taxonomy members. */
const ALREADY_TAXONOMY_CODES = [
  'amount_above_program_cap',
  'term_outside_program_range',
  'insufficient_residual_income',
  'no_lender_program_match',
] as const;

const baseNoticeInput = (reasonCodes: string[]) => ({
  recipient: { legalName: 'Applicant', email: 'a@b.com', phone: '+15551230000' },
  application: {
    id: 'app_123',
    amountDisplay: '$10,000.00',
    termDisplay: '36 months',
    categoryDisplay: 'Personal',
    decisionDate: '2026-05-31',
  },
  lenderOfRecord: {
    legalName: 'Partner Bank, N.A.',
    addressLine1: '123 Banking Way',
    city: 'New York',
    state: 'NY',
    zip: '10001',
  },
  reasonCodes,
  policyVersion: '2026.05.02-mvp1',
});

describe('ECOA-02 decline-code mapper', () => {
  describe('every raw adapter code maps to a valid taxonomy code', () => {
    it.each(RAW_ADAPTER_DECLINE_CODES)('%s → valid Reg B taxonomy code', (raw) => {
      const mapped = lookupDeclineCode(raw);
      expect(mapped, `raw code "${raw}" must map to a taxonomy code`).not.toBeNull();
      expect(isValidReasonCode(mapped as string)).toBe(true);
      // The mapped line must exist (no blank consumer-facing reason).
      expect(
        ADVERSE_ACTION_REASON_CODES[mapped as keyof typeof ADVERSE_ACTION_REASON_CODES],
      ).toBeTruthy();
    });

    it('every value in RAW_DECLINE_CODE_MAP is a real taxonomy key', () => {
      for (const [raw, code] of Object.entries(RAW_DECLINE_CODE_MAP)) {
        expect(isValidReasonCode(code), `${raw} → ${code} not in taxonomy`).toBe(true);
      }
    });
  });

  describe('taxonomy codes pass through unchanged', () => {
    it.each(ALREADY_TAXONOMY_CODES)('%s passes through', (code) => {
      expect(lookupDeclineCode(code)).toBe(code);
    });
  });

  describe('accuracy of substantive mappings (no generic filler where specificity exists)', () => {
    it('affordability_fail → income reason, not a credit-score reason', () => {
      expect(lookupDeclineCode('affordability_fail')).toBe('insufficient_residual_income');
    });
    it('risk_score_below_threshold → credit-score reason (accurate)', () => {
      expect(lookupDeclineCode('risk_score_below_threshold')).toBe('credit_score_below_threshold');
    });
    it('amount/term envelope map to program-limit reasons', () => {
      expect(lookupDeclineCode('amount_above_max')).toBe('amount_above_program_cap');
      expect(lookupDeclineCode('term_out_of_range')).toBe('term_outside_program_range');
    });
    it('operational timeout/exception are NOT mapped to a credit reason', () => {
      const creditReasons = new Set([
        'credit_score_below_threshold',
        'bureau_no_credit_file',
        'bureau_recent_serious_delinquency',
        'bureau_charge_off',
        'insufficient_residual_income',
        'debt_to_income_too_high',
      ]);
      for (const op of ['adapter_timeout', 'adapter_exception', 'rate_limited']) {
        const mapped = lookupDeclineCode(op);
        expect(mapped).not.toBeNull();
        expect(creditReasons.has(mapped as string)).toBe(false);
      }
    });
  });

  describe('lawyer-review set is locked (cannot silently grow)', () => {
    it('exactly the operational codes are flagged for review', () => {
      expect([...LAWYER_REVIEW_REQUIRED_CODES].sort()).toEqual(
        [
          'adapter_exception',
          'adapter_timeout',
          'pending_manual_review',
          'rate_limited',
          'requires_manual_review',
          'requires_manual_underwriting',
          'underwriting_system_error',
          // velocity (anti-fraud throttle) declines — flagged because a
          // fraud-hold may warrant a different notice than an adverse action.
          'velocity_user_24h',
          'velocity_ip_24h',
          'velocity_device_24h',
        ].sort(),
      );
    });
  });

  describe('normalizeDeclineCodes — dedup, cap, order', () => {
    it('dedupes codes that collapse to the same taxonomy reason', () => {
      // three fraud-signal raw codes → one taxonomy reason
      const out = normalizeDeclineCodes([
        'device_provider_high_risk',
        'email_provider_high_risk',
        'phone_provider_high_risk',
      ]);
      expect(out).toEqual(['fraud_signals']);
    });

    it('caps at 4 reasons (Reg B §1002.9(b)(2))', () => {
      const out = normalizeDeclineCodes([
        'insufficient_residual_income',
        'credit_score_below_threshold',
        'amount_above_program_cap',
        'term_outside_program_range',
        'no_lender_program_match', // 5th distinct — must be dropped
      ]);
      expect(out).toHaveLength(4);
      expect(out).not.toContain('no_lender_program_match');
    });

    it('preserves first-seen order', () => {
      const out = normalizeDeclineCodes(['term_out_of_range', 'affordability_fail']);
      expect(out).toEqual(['term_outside_program_range', 'insufficient_residual_income']);
    });
  });

  describe('FAIL LOUD on unmappable input (never silent)', () => {
    it('throws UnmappableDeclineCodeError for an unknown code', () => {
      expect(() => normalizeDeclineCodes(['totally_made_up_code'])).toThrow(
        UnmappableDeclineCodeError,
      );
    });
    it('the thrown error names every offender', () => {
      try {
        normalizeDeclineCodes(['affordability_fail', 'bogus_a', 'bogus_b']);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(UnmappableDeclineCodeError);
        expect((e as UnmappableDeclineCodeError).unmappedCodes.sort()).toEqual([
          'bogus_a',
          'bogus_b',
        ]);
      }
    });
    it('throws on an empty reason set (no reasonless AAN)', () => {
      expect(() => normalizeDeclineCodes([])).toThrow(UnmappableDeclineCodeError);
    });
  });
});

describe('ECOA-02 adverse-action builder integration', () => {
  it('renders a complete AAN for the no-lender-approved aggregate decline (the common P0 path)', () => {
    // Exactly what persistResults aggregates when no lender approves: a mix
    // of raw adapter decline + operational codes. Previously this threw and
    // the notice never rendered.
    const content = buildAdverseActionNotice(
      baseNoticeInput([
        'affordability_fail',
        'risk_score_below_threshold',
        'adapter_timeout',
        'term_out_of_range',
      ]),
    );
    expect(content.reasons.length).toBeGreaterThan(0);
    expect(content.reasons.length).toBeLessThanOrEqual(4);
    // Every rendered reason is a real consumer-readable line, not a code.
    for (const line of content.reasons) {
      expect(Object.values(ADVERSE_ACTION_REASON_CODES)).toContain(line);
    }
    // Stamped codes are taxonomy codes, not raw adapter strings.
    for (const code of content.reasonCodes) {
      expect(isValidReasonCode(code)).toBe(true);
    }
    expect(content.reasonCodes).toContain('insufficient_residual_income');
    expect(content.reasonCodes).toContain('credit_score_below_threshold');
  });

  it('renders the bare fallback (only no_lender_program_match)', () => {
    const content = buildAdverseActionNotice(baseNoticeInput(['no_lender_program_match']));
    expect(content.reasonCodes).toEqual(['no_lender_program_match']);
    expect(content.reasons).toEqual([ADVERSE_ACTION_REASON_CODES.no_lender_program_match]);
  });

  it('FAILS LOUD (throws) when given an unmappable code — does not silently drop the notice', () => {
    expect(() => buildAdverseActionNotice(baseNoticeInput(['some_unknown_lender_code']))).toThrow(
      UnmappableDeclineCodeError,
    );
  });
});
