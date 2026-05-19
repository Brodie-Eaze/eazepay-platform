'use client';

/**
 * <OnboardingWizard> — the shared 5-step (or 4-step branded) sign-up form.
 *
 * Three callers:
 *   1. /welcome                — no brand prop, full 5-step generic
 *                                EAZE-branded form (manual / operator
 *                                onboarding for an unknown vertical).
 *   2. /<brand>/signup pages   — brand prop set to medpay/tradepay/
 *                                coachpay. Industry is pre-filled +
 *                                Step 1 is skipped (4 steps total).
 *                                Header chrome + accent palette switch
 *                                to the brand.
 *   3. (future) operator queue — same component, brand prop wired by
 *                                the admin tool.
 *
 * Brand-specific surface
 * ----------------------
 * The wizard body (form fields, validation, step components) is
 * identical across brands — only the chrome changes:
 *   • Header logo + brand name (Med/Pay, Trade/Pay, Coach/Pay)
 *   • Active-step pill background + Continue button background
 *   • Submit button copy ("Submit MedPay application" vs "Submit
 *     application")
 *   • Step 1 (Industry) is hidden entirely when brand is set
 *
 * Why a prop, not a route param
 * -----------------------------
 * Each branded page mounts this component with a static prop. Reading
 * the URL would force this into a use-client + window dance; passing
 * a literal compiles cleanly and avoids hydration mismatches.
 */

import { useState, type ComponentType, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, CheckIcon, BoltIcon } from '@eazepay/ui/web';
import { type Industry, type OnboardingState, type StepKey, EMPTY_STATE } from './state';
import StepIndustry from './step-industry';
import StepBusinessInfo from './step-business-info';
import StepBusinessDetails from './step-business-details';
import StepFinancialProfile from './step-financial-profile';
import StepReview from './step-review';

/* ─── Brand config ─────────────────────────────────────────────────── */

export type BrandSlug = 'medpay' | 'tradepay' | 'coachpay';

interface BrandTheme {
  /** Visible name in the header + headings ("MedPay") */
  name: string;
  /** Two-line wordmark, "Med" / "Pay" — same look as /<brand>/checkout */
  markPrimary: string;
  markSecondary: string;
  /** Industry value that maps to this brand. The api/onboarding/submit
   *  route maps the inverse direction (medical → medpay). */
  industry: Industry;
  /** Tailwind class fragments. We use arbitrary-value hex so the wizard
   *  stays Tailwind-driven without needing a tailwind.config.ts change. */
  accentBg: string;
  accentBgHover: string;
  iconBg: string;
  iconText: string;
  surfaceTint: string;
}

const BRAND_THEME: Record<BrandSlug, BrandTheme> = {
  medpay: {
    name: 'MedPay',
    markPrimary: 'Med',
    markSecondary: 'Pay',
    industry: 'medical',
    accentBg: 'bg-[#0E7C66]',
    accentBgHover: 'hover:bg-[#22B8A0]',
    iconBg: 'bg-[#0E7C66]',
    iconText: 'text-white',
    surfaceTint: 'bg-[#f3faf7]',
  },
  tradepay: {
    name: 'TradePay',
    markPrimary: 'Trade',
    markSecondary: 'Pay',
    industry: 'trades',
    accentBg: 'bg-[#D4581A]',
    accentBgHover: 'hover:bg-[#F47B3F]',
    iconBg: 'bg-[#D4581A]',
    iconText: 'text-white',
    surfaceTint: 'bg-[#fdf5ef]',
  },
  coachpay: {
    name: 'CoachPay',
    markPrimary: 'Coach',
    markSecondary: 'Pay',
    industry: 'coaching',
    accentBg: 'bg-[#7C3AED]',
    accentBgHover: 'hover:bg-[#A78BFA]',
    iconBg: 'bg-[#7C3AED]',
    iconText: 'text-white',
    surfaceTint: 'bg-[#f6f3ff]',
  },
};

/* Generic EAZE chrome — the fallback theme for the unbranded /welcome
 * path. Kept distinct from BRAND_THEME so the typesystem can't conflate
 * "no brand" with "wrong brand." */
const GENERIC_THEME = {
  accentBg: 'bg-[#0d1530]',
  accentBgHover: 'hover:bg-[#1a2a52]',
  surfaceTint: 'bg-bg',
} as const;

/* ─── Step config ──────────────────────────────────────────────────── */

const GENERIC_STEPS: StepKey[] = [
  'industry',
  'business_info',
  'business_details',
  'financial_profile',
  'review',
];

/** Branded flows skip Industry — the funnel already determined it. */
const BRANDED_STEPS: StepKey[] = [
  'business_info',
  'business_details',
  'financial_profile',
  'review',
];

const STEP_LABEL: Record<StepKey, string> = {
  industry: 'Industry',
  business_info: 'Business Info',
  business_details: 'Business Details',
  financial_profile: 'Financial Profile',
  review: 'Review',
};

const STEP_SUBTITLE: Record<StepKey, string> = {
  industry: 'Select the industry that best describes your business.',
  business_info: 'Legal name, federal EIN, and the address we’ll use on every disclosure.',
  business_details: 'Beneficial owners (≥25%) plus a few details about your operations.',
  financial_profile: 'Where settlements should land and the volume we should expect.',
  review: 'One last look before we send this to underwriting.',
};

/** Per-brand title for the Business Info step. */
function titleFor(stepKey: StepKey, brandName: string | null): string {
  if (stepKey === 'industry') return 'Welcome to EAZE';
  if (stepKey === 'business_info') {
    return brandName ? `Welcome to ${brandName}` : 'Tell us about your business';
  }
  if (stepKey === 'business_details') return 'Business details';
  if (stepKey === 'financial_profile') return 'Financial profile';
  if (stepKey === 'review') return 'Review and submit';
  return '';
}

interface StepProps {
  state: OnboardingState;
  setState: Dispatch<SetStateAction<OnboardingState>>;
  errors: Record<string, string>;
}

const STEP_COMPONENT: Record<StepKey, ComponentType<StepProps>> = {
  industry: StepIndustry,
  business_info: StepBusinessInfo,
  business_details: StepBusinessDetails,
  financial_profile: StepFinancialProfile,
  review: StepReview,
};

/* ─── The wizard ───────────────────────────────────────────────────── */

interface OnboardingWizardProps {
  /** When set: pre-fill industry, hide Step 1, swap chrome to the brand
   *  palette + header. When unset: full 5-step generic EAZE form. */
  brand?: BrandSlug;
}

export default function OnboardingWizard({ brand }: OnboardingWizardProps): JSX.Element {
  const router = useRouter();
  const theme = brand ? BRAND_THEME[brand] : null;
  const stepOrder = brand ? BRANDED_STEPS : GENERIC_STEPS;
  const brandName = theme?.name ?? null;

  const initialState: OnboardingState = theme
    ? { ...EMPTY_STATE, industry: theme.industry }
    : EMPTY_STATE;

  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<OnboardingState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepKey: StepKey = stepOrder[stepIdx]!;

  /**
   * Per-step validation. Same logic across branded and generic flows —
   * the branded paths just don't have an `industry` step to validate
   * (industry is locked from the prop and can't be empty).
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
      if (!state.yearsInBusiness || Number(state.yearsInBusiness) < 0)
        e['yearsInBusiness'] = 'Required';
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
      setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1));
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
      router.push('/welcome/submitted');
    }
  };

  const currentStepNo = stepIdx + 1;
  const totalSteps = stepOrder.length;
  const accentBg = theme?.accentBg ?? GENERIC_THEME.accentBg;
  const accentBgHover = theme?.accentBgHover ?? GENERIC_THEME.accentBgHover;
  const surfaceTint = theme?.surfaceTint ?? GENERIC_THEME.surfaceTint;
  const submitLabel = theme ? `Submit ${theme.name} application` : 'Submit application';

  const Step = STEP_COMPONENT[stepKey];

  return (
    <main className={`min-h-screen ${surfaceTint}`}>
      {/* Header bar — brand-aware. Same shape as the EAZE generic
          header so the wizard layout doesn't reflow. */}
      <header className="border-b border-border bg-bg-elevated">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          {theme ? (
            <Link href={`/${brand}/start`} className="flex items-center gap-2.5">
              <div
                className={`h-8 w-8 rounded-lg ${theme.iconBg} flex items-center justify-center`}
              >
                <BoltIcon size={14} className={theme.iconText} />
              </div>
              <div className="leading-tight">
                <div className="text-[14px] font-bold tracking-tight text-fg">
                  {theme.markPrimary}
                  <span className="text-fg-muted font-medium">/{theme.markSecondary}</span>
                </div>
                <div className="text-[9px] uppercase tracking-[0.22em] font-semibold text-fg-muted -mt-0.5">
                  Partner sign-up
                </div>
              </div>
            </Link>
          ) : (
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
          )}
          <Link href="/sign-in" className="text-[13px] text-fg-muted hover:text-fg">
            Sign in
          </Link>
        </div>
      </header>

      {/* Wizard body */}
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        {/* Step breadcrumbs */}
        <ol className="flex items-center gap-2 text-[12px] mb-8 flex-wrap">
          {stepOrder.map((k, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={k} className="flex items-center gap-2">
                <span
                  className={
                    'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold ' +
                    (active
                      ? `${accentBg} text-white`
                      : done
                        ? 'bg-bg-inverse text-white border border-bg-inverse'
                        : 'bg-bg-muted text-fg-muted border border-border')
                  }
                >
                  {done ? <CheckIcon size={11} /> : i + 1}
                </span>
                <span
                  className={
                    (active
                      ? 'text-fg font-semibold'
                      : done
                        ? 'text-fg-secondary'
                        : 'text-fg-muted') + ' whitespace-nowrap'
                  }
                >
                  {STEP_LABEL[k]}
                </span>
                {i < stepOrder.length - 1 && <span className="text-fg-muted">→</span>}
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
          {titleFor(stepKey, brandName)}
        </h1>
        <p className="mt-2 text-[15px] text-fg-secondary">{STEP_SUBTITLE[stepKey]}</p>

        {/* Step body */}
        <div className="mt-8">
          <Step state={state} setState={setState} errors={errors} />
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
              className={`h-11 px-6 rounded-lg ${accentBg} ${accentBgHover} text-white font-semibold text-[14px] flex items-center gap-2 disabled:opacity-50`}
            >
              {submitting ? 'Submitting…' : submitLabel}
              {!submitting && <ArrowRightIcon size={14} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className={`h-11 px-6 rounded-lg ${accentBg} ${accentBgHover} text-white font-semibold text-[14px] flex items-center gap-2`}
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
