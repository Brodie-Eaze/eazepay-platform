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
 * What this file does NOT own
 * ---------------------------
 *   • Brand colors / wordmarks — see `lib/brand-theme.ts`
 *   • Validation rules        — see `lib/onboarding-validation.ts`
 *
 * Pulling those out kept this file focused on what it actually is:
 * the wizard's React glue (state machine, step rendering, layout).
 */

import { useMemo, useState, type ComponentType, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, CheckIcon, BoltIcon } from '@eazepay/ui/web';
import { type OnboardingState, type StepKey, EMPTY_STATE } from './state';
import { BRAND_THEME, type BrandSlug, type BrandTheme } from '../../lib/brand-theme';
import { validateStep, type StepErrors } from '../../lib/onboarding-validation';
import StepIndustry from './step-industry';
import StepBusinessInfo from './step-business-info';
import StepBusinessDetails from './step-business-details';
import StepFinancialProfile from './step-financial-profile';
import StepReview from './step-review';

/* ─── Step config ─────────────────────────────────────────────────── */

const GENERIC_STEPS: readonly StepKey[] = [
  'industry',
  'business_info',
  'business_details',
  'financial_profile',
  'review',
];

/** Branded flows skip Industry — the funnel already determined it. */
const BRANDED_STEPS: readonly StepKey[] = [
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

interface StepProps {
  state: OnboardingState;
  setState: Dispatch<SetStateAction<OnboardingState>>;
  errors: StepErrors;
}

const STEP_COMPONENT: Record<StepKey, ComponentType<StepProps>> = {
  industry: StepIndustry,
  business_info: StepBusinessInfo,
  business_details: StepBusinessDetails,
  financial_profile: StepFinancialProfile,
  review: StepReview,
};

/** Per-brand title for the Business Info step. The first step in a
 *  branded flow is `business_info` (industry is skipped), so the
 *  brand-aware "Welcome to {Brand}" copy lands there. */
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

/* ─── Generic (unbranded) chrome ──────────────────────────────────── */

const GENERIC_CHROME = {
  accentBg: 'bg-[#0d1530]',
  accentBgHover: 'hover:bg-[#1a2a52]',
  surfaceTint: 'bg-bg',
} as const;

/** Resolve the Tailwind class strings for a theme (or the generic
 *  EAZE chrome if no theme is set). Class strings come from the theme
 *  itself — they're static literals in `lib/brand-theme.ts`, so
 *  Tailwind's content scan picks them up at build time. */
function chromeFor(theme: BrandTheme | null): {
  accentBg: string;
  accentBgHover: string;
  surfaceTint: string;
} {
  if (!theme) return GENERIC_CHROME;
  return {
    accentBg: theme.accentBgClass,
    accentBgHover: theme.accentBgHoverClass,
    surfaceTint: theme.surfaceTintClass,
  };
}

/* ─── The wizard ──────────────────────────────────────────────────── */

interface OnboardingWizardProps {
  /** When set: pre-fill industry, hide Step 1, swap chrome to the brand
   *  palette + header. When unset: full 5-step generic EAZE form. */
  brand?: BrandSlug;
}

export default function OnboardingWizard({ brand }: OnboardingWizardProps): JSX.Element {
  const router = useRouter();
  const theme = brand ? BRAND_THEME[brand] : null;
  const stepOrder = useMemo(() => (brand ? BRANDED_STEPS : GENERIC_STEPS), [brand]);
  const brandName = theme?.name ?? null;
  const chrome = chromeFor(theme);

  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<OnboardingState>(() =>
    theme ? { ...EMPTY_STATE, industry: theme.industry } : EMPTY_STATE,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<StepErrors>({});

  const stepKey: StepKey = stepOrder[stepIdx]!;

  const validateCurrent = (): boolean => {
    const next = validateStep(state, stepKey);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (validateCurrent()) {
      setStepIdx((i) => Math.min(stepOrder.length - 1, i + 1));
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const back = () => {
    setStepIdx((i) => Math.max(0, i - 1));
    setErrors({});
  };

  const submit = async () => {
    if (!validateCurrent()) return;
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
      // BFF transient — route to the "received" state so the wizard
      // doesn't dead-end mid-submit. The route handler is the source
      // of truth for whether the partner was actually created.
      router.push('/welcome/submitted');
    }
  };

  const Step = STEP_COMPONENT[stepKey];
  const submitLabel = theme ? `Submit ${theme.name} application` : 'Submit application';

  return (
    <main className={`min-h-screen ${chrome.surfaceTint}`}>
      <WizardHeader theme={theme} brand={brand} />

      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
        <Breadcrumb stepOrder={stepOrder} stepIdx={stepIdx} accentBg={chrome.accentBg} />

        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-fg-muted mb-2">
          Step {stepIdx + 1} of {stepOrder.length}
        </p>

        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-fg">
          {titleFor(stepKey, brandName)}
        </h1>
        <p className="mt-2 text-[15px] text-fg-secondary">{STEP_SUBTITLE[stepKey]}</p>

        <div className="mt-8">
          <Step state={state} setState={setState} errors={errors} />
        </div>

        {submitError && (
          <div
            role="alert"
            className="mt-6 rounded-md border border-border-strong bg-bg-muted px-3 py-2 text-[13px] text-fg font-semibold"
          >
            {submitError}
          </div>
        )}

        <WizardFooter
          isReviewStep={stepKey === 'review'}
          canGoBack={stepIdx > 0}
          submitting={submitting}
          submitLabel={submitLabel}
          accentBg={chrome.accentBg}
          accentBgHover={chrome.accentBgHover}
          onBack={back}
          onNext={next}
          onSubmit={submit}
        />
      </div>
    </main>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

/** Branded header (brand wordmark + Sign-in link) or generic EAZE
 *  header. Kept as its own component so the wizard body reads cleanly. */
function WizardHeader({
  theme,
  brand,
}: {
  theme: BrandTheme | null;
  brand: BrandSlug | undefined;
}): JSX.Element {
  return (
    <header className="border-b border-border bg-bg-elevated">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
        {theme && brand ? (
          <Link href={`/${brand}/start`} className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-lg ${theme.accentBgClass} flex items-center justify-center`}
            >
              <BoltIcon size={14} className="text-white" />
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
  );
}

/** Step-progress pills. Active step uses the brand accent; completed
 *  steps use the dark inverse fill; pending steps are muted. */
function Breadcrumb({
  stepOrder,
  stepIdx,
  accentBg,
}: {
  stepOrder: readonly StepKey[];
  stepIdx: number;
  accentBg: string;
}): JSX.Element {
  return (
    <ol className="flex items-center gap-2 text-[12px] mb-8 flex-wrap" aria-label="Sign-up steps">
      {stepOrder.map((k, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        return (
          <li key={k} className="flex items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
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
                (active ? 'text-fg font-semibold' : done ? 'text-fg-secondary' : 'text-fg-muted') +
                ' whitespace-nowrap'
              }
            >
              {STEP_LABEL[k]}
            </span>
            {i < stepOrder.length - 1 && (
              <span className="text-fg-muted" aria-hidden>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Back + Continue / Submit footer. Submit only on the review step. */
function WizardFooter({
  isReviewStep,
  canGoBack,
  submitting,
  submitLabel,
  accentBg,
  accentBgHover,
  onBack,
  onNext,
  onSubmit,
}: {
  isReviewStep: boolean;
  canGoBack: boolean;
  submitting: boolean;
  submitLabel: string;
  accentBg: string;
  accentBgHover: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack || submitting}
        className="h-10 px-4 rounded-md text-[13px] font-medium text-fg-secondary hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Back
      </button>
      {isReviewStep ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={`h-11 px-6 rounded-lg ${accentBg} ${accentBgHover} text-white font-semibold text-[14px] flex items-center gap-2 disabled:opacity-50`}
        >
          {submitting ? 'Submitting…' : submitLabel}
          {!submitting && <ArrowRightIcon size={14} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className={`h-11 px-6 rounded-lg ${accentBg} ${accentBgHover} text-white font-semibold text-[14px] flex items-center gap-2`}
        >
          Continue
          <ArrowRightIcon size={14} />
        </button>
      )}
    </div>
  );
}
