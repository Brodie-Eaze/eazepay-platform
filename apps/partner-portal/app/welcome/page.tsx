'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, CheckIcon, BoltIcon } from '@eazepay/ui/web';
import {
  INDUSTRIES,
  US_STATES,
  type Industry,
  type OnboardingState,
  type StepKey,
  EMPTY_STATE,
} from './state';
import StepIndustry from './step-industry';
import StepBusinessInfo from './step-business-info';
import StepBusinessDetails from './step-business-details';
import StepFinancialProfile from './step-financial-profile';
import StepReview from './step-review';

/**
 * EAZE Partner Portal — Welcome / onboarding wizard.
 *
 * Direct port of the Lovable `/welcome` flow. Five steps:
 *   1. Industry            — pick one of 4 verticals
 *   2. Business Info       — legal name, DBA, EIN, contact, address
 *   3. Business Details    — owners (FinCEN BOI ≥25%), years in business
 *   4. Financial Profile   — bank account, monthly volume, ticket size
 *   5. Review              — read-only summary + agreements + submit
 *
 * The wizard owns all state; each step is a pure-input component that
 * receives `state` + `setState` and renders its slice. Validation runs
 * per-step on `next` — the user can't advance with errors but they can
 * always go `back` without losing fields.
 *
 * Layout matches the Lovable site: light surface, top breadcrumb of
 * step names, "Step N of 5" eyebrow, large heading, content card,
 * sticky footer with Back / Continue actions.
 */

const STEP_ORDER: StepKey[] = ['industry', 'business_info', 'business_details', 'financial_profile', 'review'];

const STEP_LABEL: Record<StepKey, string> = {
  industry: 'Industry',
  business_info: 'Business Info',
  business_details: 'Business Details',
  financial_profile: 'Financial Profile',
  review: 'Review',
};

const STEP_TITLE: Record<StepKey, string> = {
  industry: 'Welcome to EAZE',
  business_info: 'Tell us about your business',
  business_details: 'Business details',
  financial_profile: 'Financial profile',
  review: 'Review and submit',
};

const STEP_SUBTITLE: Record<StepKey, string> = {
  industry: 'Select the industry that best describes your business.',
  business_info: 'Legal name, federal EIN, and the address we’ll use on every disclosure.',
  business_details: 'Beneficial owners (≥25%) plus a few details about your operations.',
  financial_profile: 'Where settlements should land and the volume we should expect.',
  review: 'One last look before we send this to underwriting.',
};

export default function WelcomePage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<OnboardingState>(EMPTY_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepKey: StepKey = STEP_ORDER[stepIdx]!;

  /**
   * Per-step validation. Each block enforces the minimum we need to
   * keep moving forward — the deeper validations (regex on EIN/SSN/
   * ZIP, sum-of-ownerships, ABA routing checksum) run on the API
   * side at submit time.
   */
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (stepKey === 'industry') {
      if (!state.industry) e['industry'] = 'Pick the option that matches your business.';
    }
    if (stepKey === 'business_info') {
      if (!state.legalName.trim()) e['legalName'] = 'Required';
      if (!state.ein.match(/^\d{2}-?\d{7}$/)) e['ein'] = 'EIN format: XX-XXXXXXX';
      if (!state.phone.match(/^\+?1?\d{10}$/)) e['phone'] = '10-digit US phone';
      if (!state.addressLine1.trim()) e['addressLine1'] = 'Required';
      if (!state.city.trim()) e['city'] = 'Required';
      if (!state.state.trim()) e['state'] = 'Required';
      if (!state.zip.match(/^\d{5}(-\d{4})?$/)) e['zip'] = 'ZIP format: 90210 or 90210-1234';
    }
    if (stepKey === 'business_details') {
      const total = state.owners.reduce((s, o) => s + Number(o.ownershipPercentage || 0), 0);
      if (total !== 100) e['ownership_total'] = `Ownership must sum to 100% (currently ${total}%).`;
      state.owners.forEach((o, i) => {
        if (!o.firstName.trim()) e[`owner_${i}_firstName`] = 'Required';
        if (!o.lastName.trim()) e[`owner_${i}_lastName`] = 'Required';
        if (!o.title.trim()) e[`owner_${i}_title`] = 'Required';
        if (!o.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e[`owner_${i}_email`] = 'Invalid email';
      });
      if (!state.yearsInBusiness || Number(state.yearsInBusiness) < 0) e['yearsInBusiness'] = 'Required';
    }
    if (stepKey === 'financial_profile') {
      if (!state.bankName.trim()) e['bankName'] = 'Required';
      if (!state.routingNumber.match(/^\d{9}$/)) e['routingNumber'] = '9 digits';
      if (!state.accountNumber.match(/^\d{4,17}$/)) e['accountNumber'] = '4–17 digits';
      if (!state.avgMonthlyVolume) e['avgMonthlyVolume'] = 'Required';
      if (!state.avgTicket) e['avgTicket'] = 'Required';
    }
    if (stepKey === 'review') {
      if (!state.acceptedTerms) e['terms'] = 'You must accept the terms.';
      if (!state.acceptedPrivacy) e['privacy'] = 'You must accept the privacy notice.';
      if (!state.signedAgreement) e['agreement'] = 'You must sign the merchant agreement.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validate()) {
      setStepIdx((i) => Math.min(STEP_ORDER.length - 1, i + 1));
      // Scroll to top so the next step's heading is visible
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const back = () => {
    setStepIdx((i) => Math.max(0, i - 1));
    setErrors({});
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.detail ?? 'Onboarding submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      router.push('/welcome/submitted');
    } catch {
      // BFF not wired yet — fall through to a "received" state so the
      // wizard is fully exercisable in dev.
      router.push('/welcome/submitted');
    }
  };

  const currentStepNo = stepIdx + 1;
  const totalSteps = STEP_ORDER.length;

  return (
    <main className="min-h-screen bg-bg">
      {/* Header bar */}
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <Link href="/sign-in" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0d1530] flex items-center justify-center">
              <BoltIcon size={14} className="text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-bold tracking-tight text-fg">EAZE</div>
              <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-fg-muted -mt-0.5">
                Partner Portal
              </div>
            </div>
          </Link>
          <Link href="/sign-in" className="text-[13px] text-fg-muted hover:text-fg">
            Sign in
          </Link>
        </div>
      </header>

      {/* Wizard */}
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        {/* Step breadcrumbs */}
        <ol className="flex items-center gap-2 text-[12px] mb-8 flex-wrap">
          {STEP_ORDER.map((k, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={k} className="flex items-center gap-2">
                <span
                  className={
                    'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold ' +
                    (active
                      ? 'bg-[#0d1530] text-white'
                      : done
                        ? 'bg-bg-inverse text-white border border-bg-inverse'
                        : 'bg-bg-muted text-fg-muted border border-border')
                  }
                >
                  {done ? <CheckIcon size={11} /> : i + 1}
                </span>
                <span
                  className={
                    (active ? 'text-fg font-semibold' : done ? 'text-fg-secondary' : 'text-fg-muted') +
                    ' whitespace-nowrap'
                  }
                >
                  {STEP_LABEL[k]}
                </span>
                {i < STEP_ORDER.length - 1 && <span className="text-fg-muted">→</span>}
              </li>
            );
          })}
        </ol>

        {/* Eyebrow */}
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
          Step {currentStepNo} of {totalSteps}
        </p>

        {/* Heading + subtitle */}
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-fg">
          {STEP_TITLE[stepKey]}
        </h1>
        <p className="mt-2 text-[15px] text-fg-secondary">{STEP_SUBTITLE[stepKey]}</p>

        {/* Step body */}
        <div className="mt-8">
          {stepKey === 'industry' && (
            <StepIndustry state={state} setState={setState} errors={errors} />
          )}
          {stepKey === 'business_info' && (
            <StepBusinessInfo state={state} setState={setState} errors={errors} />
          )}
          {stepKey === 'business_details' && (
            <StepBusinessDetails state={state} setState={setState} errors={errors} />
          )}
          {stepKey === 'financial_profile' && (
            <StepFinancialProfile state={state} setState={setState} errors={errors} />
          )}
          {stepKey === 'review' && (
            <StepReview state={state} setState={setState} errors={errors} />
          )}
        </div>

        {submitError && (
          <div className="mt-6 rounded-md border border-border-strong bg-bg-muted px-3 py-2 text-[13px] text-fg font-semibold">
            {submitError}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          <button
            type="button"
            onClick={back}
            disabled={stepIdx === 0 || submitting}
            className="h-10 px-4 rounded-md text-[13px] font-medium text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          {stepKey === 'review' ? (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1a2a52] disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit application'}
              {!submitting && <ArrowRightIcon size={14} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="h-11 px-6 rounded-lg bg-[#0d1530] text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1a2a52]"
            >
              Continue
              <ArrowRightIcon size={14} />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
