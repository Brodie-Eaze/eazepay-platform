import { describe, it, expect } from 'vitest';
import { isStepValid, validateStep } from './onboarding-validation';
import { EMPTY_STATE, type OnboardingState } from '../app/welcome/state';

/**
 * Spec coverage for `lib/onboarding-validation.ts`.
 *
 * The validator is a pure function — the spec exercises it directly
 * by handing it crafted `OnboardingState` shapes and asserting the
 * error map.
 *
 * Test posture: each step's branch has at least one valid case + one
 * representative invalid case per field. The point isn't exhaustive
 * regex coverage (those tests would just re-encode the regex
 * literals); it's pinning the BEHAVIOUR — "an empty legal name on
 * step 2 blocks the user" — so a future rule change can't silently
 * regress the gate.
 */

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** A valid 2-step state — passes business_info validation. */
function validBusinessInfo(): OnboardingState {
  return {
    ...EMPTY_STATE,
    industry: 'medical',
    legalName: 'Brodie Dental',
    ein: '12-3456789',
    phone: '5551234567',
    addressLine1: '123 Main St',
    city: 'Beverly Hills',
    state: 'CA',
    zip: '90210',
  };
}

/** A valid 3-step state — extends business_info with details + owners. */
function validBusinessDetails(): OnboardingState {
  return {
    ...validBusinessInfo(),
    yearsInBusiness: '5',
    employeeCount: '2-5',
    owners: [
      {
        firstName: 'Brodie',
        lastName: 'Smith',
        title: 'Owner',
        ownershipPercentage: '100',
        email: 'brodie@brodiedental.example',
        phone: '5551234567',
        isControlPerson: true,
      },
    ],
  };
}

/** A valid 4-step state — extends details with bank + volume. */
function validFinancial(): OnboardingState {
  return {
    ...validBusinessDetails(),
    bankName: 'Test Bank',
    routingNumber: '021000021',
    accountNumber: '1234567890',
    accountType: 'checking',
    avgMonthlyVolume: '50k-250k',
    avgTicket: '2500-10k',
    hasProcessingHistory: false,
  };
}

/** A fully-valid state ready for review submission. */
function validForReview(): OnboardingState {
  return {
    ...validFinancial(),
    acceptedTerms: true,
    acceptedPrivacy: true,
    signedAgreement: true,
  };
}

/* ─── Tests ───────────────────────────────────────────────────────── */

describe('lib/onboarding-validation', () => {
  describe('industry step', () => {
    it('blocks when industry is unset (the EMPTY_STATE default)', () => {
      expect(validateStep(EMPTY_STATE, 'industry')).toEqual({
        industry: expect.stringContaining('Pick the option'),
      });
    });

    it('passes when industry is selected', () => {
      const state = { ...EMPTY_STATE, industry: 'medical' as const };
      expect(validateStep(state, 'industry')).toEqual({});
      expect(isStepValid(state, 'industry')).toBe(true);
    });

    it("accepts 'other' as a selection (downstream API rejects, not the wizard)", () => {
      const state = { ...EMPTY_STATE, industry: 'other' as const };
      expect(validateStep(state, 'industry')).toEqual({});
    });
  });

  describe('business_info step', () => {
    it('accepts a fully populated business_info', () => {
      expect(validateStep(validBusinessInfo(), 'business_info')).toEqual({});
    });

    it('flags every missing required field at once', () => {
      const errors = validateStep(EMPTY_STATE, 'business_info');
      expect(errors).toHaveProperty('legalName');
      expect(errors).toHaveProperty('ein');
      expect(errors).toHaveProperty('phone');
      expect(errors).toHaveProperty('addressLine1');
      expect(errors).toHaveProperty('city');
      expect(errors).toHaveProperty('state');
      expect(errors).toHaveProperty('zip');
    });

    it('accepts EIN both with and without the dash separator', () => {
      const withDash = { ...validBusinessInfo(), ein: '12-3456789' };
      const withoutDash = { ...validBusinessInfo(), ein: '123456789' };
      expect(validateStep(withDash, 'business_info')).toEqual({});
      expect(validateStep(withoutDash, 'business_info')).toEqual({});
    });

    it('flags formatted phone numbers (paren/dash) — must be digits only', () => {
      const state = { ...validBusinessInfo(), phone: '(555) 123-4567' };
      const errors = validateStep(state, 'business_info');
      expect(errors['phone']).toBeDefined();
    });

    it('accepts ZIP+4 format', () => {
      const state = { ...validBusinessInfo(), zip: '90210-1234' };
      expect(validateStep(state, 'business_info')).toEqual({});
    });
  });

  describe('business_details step', () => {
    it('accepts a single 100%-owner', () => {
      expect(validateStep(validBusinessDetails(), 'business_details')).toEqual({});
    });

    it('flags when ownership does not sum to 100', () => {
      const state = {
        ...validBusinessDetails(),
        owners: [{ ...validBusinessDetails().owners[0]!, ownershipPercentage: '40' }],
      };
      const errors = validateStep(state, 'business_details');
      expect(errors['ownership_total']).toContain('100%');
      expect(errors['ownership_total']).toContain('40%');
    });

    it('flags missing fields on EACH owner using namespaced keys', () => {
      const state = {
        ...validBusinessDetails(),
        owners: [
          { ...validBusinessDetails().owners[0]!, ownershipPercentage: '60' },
          {
            firstName: '',
            lastName: '',
            title: '',
            ownershipPercentage: '40',
            email: 'not-an-email',
            phone: '',
            isControlPerson: false,
          },
        ],
      };
      const errors = validateStep(state, 'business_details');
      expect(errors['owner_1_firstName']).toBe('Required');
      expect(errors['owner_1_lastName']).toBe('Required');
      expect(errors['owner_1_title']).toBe('Required');
      expect(errors['owner_1_email']).toBe('Invalid email');
      // owner 0 is valid — its keys should not appear
      expect(errors['owner_0_firstName']).toBeUndefined();
    });

    it('flags empty yearsInBusiness', () => {
      const state = { ...validBusinessDetails(), yearsInBusiness: '' };
      expect(validateStep(state, 'business_details')['yearsInBusiness']).toBe('Required');
    });

    it('accepts yearsInBusiness = "0" (newly formed business)', () => {
      // The rule guards against empty string AND negative numbers. The
      // string "0" is truthy + numerically non-negative, so it passes —
      // matches the form's "0 if newly formed" hint copy.
      const state = { ...validBusinessDetails(), yearsInBusiness: '0' };
      expect(validateStep(state, 'business_details')['yearsInBusiness']).toBeUndefined();
    });

    it('flags negative yearsInBusiness', () => {
      const state = { ...validBusinessDetails(), yearsInBusiness: '-3' };
      expect(validateStep(state, 'business_details')['yearsInBusiness']).toBe('Required');
    });

    it('flags empty yearsInBusiness explicitly', () => {
      const state = { ...validBusinessDetails(), yearsInBusiness: '' };
      expect(validateStep(state, 'business_details')['yearsInBusiness']).toBe('Required');
    });
  });

  describe('financial_profile step', () => {
    it('accepts a fully populated financial_profile', () => {
      expect(validateStep(validFinancial(), 'financial_profile')).toEqual({});
    });

    it('flags non-9-digit routing numbers', () => {
      const tooShort = { ...validFinancial(), routingNumber: '12345' };
      const tooLong = { ...validFinancial(), routingNumber: '1234567890' };
      const alpha = { ...validFinancial(), routingNumber: '12345abcd' };
      expect(validateStep(tooShort, 'financial_profile')['routingNumber']).toBe('9 digits');
      expect(validateStep(tooLong, 'financial_profile')['routingNumber']).toBe('9 digits');
      expect(validateStep(alpha, 'financial_profile')['routingNumber']).toBe('9 digits');
    });

    it('accepts account numbers from 4 to 17 digits', () => {
      const short = { ...validFinancial(), accountNumber: '1234' };
      const long = { ...validFinancial(), accountNumber: '12345678901234567' };
      expect(validateStep(short, 'financial_profile')).toEqual({});
      expect(validateStep(long, 'financial_profile')).toEqual({});
    });

    it('flags account numbers outside the 4-17 digit range', () => {
      const tooShort = { ...validFinancial(), accountNumber: '123' };
      const tooLong = { ...validFinancial(), accountNumber: '123456789012345678' };
      expect(validateStep(tooShort, 'financial_profile')['accountNumber']).toBeDefined();
      expect(validateStep(tooLong, 'financial_profile')['accountNumber']).toBeDefined();
    });
  });

  describe('review step', () => {
    it('passes when all three agreements are accepted', () => {
      expect(validateStep(validForReview(), 'review')).toEqual({});
    });

    it('flags each unchecked agreement independently', () => {
      const state = { ...validFinancial() }; // none of the toggles set
      const errors = validateStep(state, 'review');
      expect(errors['terms']).toBeDefined();
      expect(errors['privacy']).toBeDefined();
      expect(errors['agreement']).toBeDefined();
    });

    it('does NOT re-validate earlier-step fields (independence)', () => {
      // A blank state shouldn't return business_info errors when
      // we ask about the review step — that's the wizard's
      // step-by-step contract.
      const state = { ...EMPTY_STATE };
      const errors = validateStep(state, 'review');
      expect(errors['legalName']).toBeUndefined();
      expect(errors['ein']).toBeUndefined();
      expect(errors['terms']).toBeDefined();
    });
  });

  describe('isStepValid()', () => {
    it('returns true when validateStep returns no errors', () => {
      expect(isStepValid(validForReview(), 'review')).toBe(true);
    });

    it('returns false when there is at least one error', () => {
      expect(isStepValid(EMPTY_STATE, 'business_info')).toBe(false);
    });
  });
});
