/**
 * Pure validation for the partner onboarding wizard.
 *
 * Why extracted
 * -------------
 * Before this module, `validate()` lived inside `app/welcome/wizard.tsx`
 * as a closure over the component's React state. That coupled three
 * things that shouldn't be coupled:
 *
 *   1. The rules ("EIN must match XX-XXXXXXX")
 *   2. The error map shape (`Record<string, string>`)
 *   3. The component's `setErrors` call site
 *
 * Pulling the rules into a pure function means we can:
 *   • Write a spec that drives the validator directly with crafted
 *     `OnboardingState` shapes (no Testing-Library, no DOM).
 *   • Reuse the same rules on the server side — the
 *     `/api/onboarding/submit` route's Zod schema currently duplicates
 *     these checks; future PRs can drive both from the same source.
 *   • Iterate on a rule without touching the component (and without
 *     the noise of a JSX file).
 *
 * Why not Zod
 * -----------
 * Zod is already the validator on the server side (it gives 400 with
 * field-level errors). For the client-side wizard, we need per-step
 * validation — "is the current step valid, regardless of fields on
 * future steps?" Zod can do that with `partial()` + per-step schemas,
 * but the rule shapes here are bespoke (ownership-percentage sum
 * across an array, etc.) and writing them as a Zod-friendly schema
 * adds more friction than it saves. A small purpose-built validator
 * is clearer; the spec proves it.
 *
 * Error key convention
 * --------------------
 *   • Top-level field names match `OnboardingState` keys: `legalName`,
 *     `ein`, etc.
 *   • Owner fields are namespaced `owner_<index>_<field>` so the step
 *     UI can highlight the right input on the right owner row.
 *   • Cross-field rules use a synthesised key (`ownership_total`).
 *   • Review-step toggles use the toggle name (`terms`, `privacy`,
 *     `agreement`) rather than the underlying state field.
 */

import type { OnboardingState, StepKey } from '../app/welcome/state';

/** Map of `<field-or-key>` → human-readable error message. Empty
 *  object means the step is valid. */
export type StepErrors = Record<string, string>;

/* ─── Regex patterns ────────────────────────────────────────────────
 * Hoisted to constants so the spec can assert against the same regex
 * the component uses, and so a future rule tweak (e.g., allowing
 * international phone numbers) is a one-line change here. */
const EIN_RE = /^\d{2}-?\d{7}$/;
const PHONE_RE = /^\+?1?\d{10}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const ROUTING_RE = /^\d{9}$/;
const ACCOUNT_RE = /^\d{4,17}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate the slice of `OnboardingState` relevant to a given step.
 *
 * Always returns a {@link StepErrors} — the empty object means the
 * step is valid. The caller decides what to do with the result
 * (block navigation, render inline errors, etc.).
 *
 * Each step's branch is INDEPENDENT — validating `business_info`
 * doesn't read fields from `financial_profile`. That's deliberate:
 * a partial state at step N must validate only against step N's
 * rules, otherwise the user can never advance.
 */
export function validateStep(state: OnboardingState, step: StepKey): StepErrors {
  const errors: StepErrors = {};

  switch (step) {
    case 'industry':
      if (!state.industry) {
        errors['industry'] = 'Pick the option that matches your business.';
      }
      break;

    case 'business_info':
      if (!state.legalName.trim()) errors['legalName'] = 'Required';
      if (!EIN_RE.test(state.ein)) errors['ein'] = 'EIN format: XX-XXXXXXX';
      if (!PHONE_RE.test(state.phone)) errors['phone'] = '10-digit US phone';
      if (!state.addressLine1.trim()) errors['addressLine1'] = 'Required';
      if (!state.city.trim()) errors['city'] = 'Required';
      if (!state.state.trim()) errors['state'] = 'Required';
      if (!ZIP_RE.test(state.zip)) errors['zip'] = 'ZIP format: 90210 or 90210-1234';
      break;

    case 'business_details': {
      const total = state.owners.reduce(
        (sum, owner) => sum + Number(owner.ownershipPercentage || 0),
        0,
      );
      if (total !== 100) {
        errors['ownership_total'] = `Ownership must sum to 100% (currently ${total}%).`;
      }
      state.owners.forEach((owner, i) => {
        if (!owner.firstName.trim()) errors[`owner_${i}_firstName`] = 'Required';
        if (!owner.lastName.trim()) errors[`owner_${i}_lastName`] = 'Required';
        if (!owner.title.trim()) errors[`owner_${i}_title`] = 'Required';
        if (!EMAIL_RE.test(owner.email)) errors[`owner_${i}_email`] = 'Invalid email';
      });
      if (!state.yearsInBusiness || Number(state.yearsInBusiness) < 0) {
        errors['yearsInBusiness'] = 'Required';
      }
      break;
    }

    case 'financial_profile':
      if (!state.bankName.trim()) errors['bankName'] = 'Required';
      if (!ROUTING_RE.test(state.routingNumber)) errors['routingNumber'] = '9 digits';
      if (!ACCOUNT_RE.test(state.accountNumber)) errors['accountNumber'] = '4–17 digits';
      if (!state.avgMonthlyVolume) errors['avgMonthlyVolume'] = 'Required';
      if (!state.avgTicket) errors['avgTicket'] = 'Required';
      break;

    case 'review':
      if (!state.acceptedTerms) errors['terms'] = 'You must accept the terms.';
      if (!state.acceptedPrivacy) errors['privacy'] = 'You must accept the privacy notice.';
      if (!state.signedAgreement) errors['agreement'] = 'You must sign the merchant agreement.';
      break;
  }

  return errors;
}

/** Convenience predicate — true iff the validator returned no errors. */
export function isStepValid(state: OnboardingState, step: StepKey): boolean {
  return Object.keys(validateStep(state, step)).length === 0;
}
