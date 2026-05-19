'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import { BRANDS, BRAND_ORDER, type BrandCode } from '@eazepay/shared-types';
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  BankIcon,
  ChartIcon,
  PhoneIcon,
  DocIcon,
  HeartPulseIcon,
  HomeIcon,
  CrownIcon,
} from '@eazepay/ui/web';
import {
  marketplaceLenders,
  partnerAccessOverrides,
  tierLabel,
  tierFico,
  type CreditTier,
  type MarketplaceLenderRow,
} from '../../../lib/marketplace-data';
import { brandContent, brandTheme } from '../../../lib/apply-brands';
import {
  ECOA_FOOTER_NOTICE,
  PARTICIPATING_LENDERS,
  SOFT_PULL_CONSENT_TEXT,
  captureConsent,
  ensureApplicationId,
  ensureSessionId,
  sessionStillBound,
} from '../../../lib/consumer-consent';
import { ConsumerIdleGuard } from '../../../components/ConsumerIdleGuard';
import {
  saveSubmittedApp,
  submitApplicationToApi,
  UNATTRIBUTED_PARTNER_ID,
} from '../../../lib/submitted-applications';

/**
 * Consumer apply landing for `/apply/<brand>?ref=<partnerId>`.
 *
 * Per-brand content + theme is injected by `lib/apply-brands.ts` so
 * the visual language matches the industry:
 *   medpay   → clinical teal · patient-finance copy
 *   tradepay → contractor navy + amber · home-improvement copy
 *   coachpay → indigo + gold · growth/learning copy
 *
 * Single-page flow: landing → disclaimer → intake → engine → offers.
 * The lender pool in the final step is filtered by the same
 * brand+tier+partner-override rule the orchestration engine uses, so
 * the master can still toggle which lenders appear from
 * `/lender-marketplace` and `/lender-marketplace/access`.
 */

type Step = 'landing' | 'disclaimer' | 'intake' | 'engine' | 'offers';

/**
 * Public consumer apply form — in-platform 1:1 port of the original
 * Lovable apply flow. Soft-pull intake collects only the 5 fields
 * below, then routes to the orchestration engine which runs the
 * actual bureau pull + affordability + lender waterfall. Richer data
 * (address, employment, income, debts) is collected on the lender's
 * own funnel after the applicant clicks "Apply Now" on a chosen
 * offer, NOT here. This matches the pre-qual / hard-pull split.
 *
 * Lives entirely in this codebase — no external redirect. Each brand
 * (medpay/tradepay/coachpay) renders at `/apply/<slug>` and uses its
 * own dedicated route (see `app/apply/<slug>/page.tsx`) for visual
 * parity with that vertical's landing page; this dynamic [brand]
 * route is the fallback for any future or direct brand slug.
 */
interface Intake {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  amount: string;
}

const BLANK_INTAKE: Intake = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  amount: '',
};

const cents = (s: string) => Math.round(parseFloat(s.replace(/[^0-9.]/g, '') || '0') * 100);
const fmt = (c: number) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function ApplyLandingPage() {
  const { brand: brandSlug } = useParams<{ brand: string }>();
  const params = useSearchParams();
  const ref = params.get('ref') ?? '';

  const brand = BRAND_ORDER.find((b) => BRANDS[b].slug === brandSlug) as BrandCode | undefined;
  if (!brand || brand === 'direct') notFound();
  const b = brand as Exclude<BrandCode, 'direct'>;
  const theme = brandTheme(b);
  const content = brandContent(b);

  const [step, setStep] = useState<Step>('landing');
  const [consent, setConsent] = useState(false);
  const [intake, setIntake] = useState<Intake>(BLANK_INTAKE);
  const [tier, setTier] = useState<CreditTier>('prime');
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);

  // ────────────────────────────────────────────────────────────────
  // Hardening item 5: session fingerprint binding.
  //
  // First render mints a per-tab sessionId + applicationId, mirrors
  // the sessionId into a SameSite=Lax cookie, and stamps both into
  // sessionStorage. Every subsequent step that posts (consent, intake
  // submit) verifies sessionStillBound() so an attacker can't replay
  // a captured POST under a fresh session — the cookie won't match.
  // ────────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string>('');
  const [applicationId, setApplicationId] = useState<string>('');
  useEffect(() => {
    setSessionId(ensureSessionId());
    setApplicationId(ensureApplicationId());
  }, []);

  // Hardening item 9: replaceState (not pushState) on every step
  // change. The browser back button leaves the apply flow entirely
  // rather than rewinding to an earlier step with stale form data.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({ step }, '');
  }, [step]);

  // Hardening item 5 (enforcement). If the session cookie went
  // missing mid-flow (privacy extension, browser restart, cookie
  // banner reject), wipe intake state and force back to landing.
  useEffect(() => {
    if (!sessionId) return;
    if (step === 'landing' || step === 'disclaimer') return;
    if (!sessionStillBound()) {
      setIntake(BLANK_INTAKE);
      setStep('landing');
    }
  }, [step, sessionId]);

  // Hardening item 10: idle timeout handler. Clears intake state +
  // session before bouncing to landing. The IdleGuard component
  // renders its own modal countdown UI.
  const handleIdleExpire = () => {
    setIntake(BLANK_INTAKE);
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
      document.cookie = 'eazepay_session=; Path=/; Max-Age=0; SameSite=Lax';
    }
    setStep('landing');
  };

  const eligibleLenders = useMemo(
    () => filterLenders({ brand: b, partnerId: ref, tier, amountCents: cents(intake.amount) }),
    [b, ref, tier, intake.amount],
  );

  // Persist the application the moment the engine completes (step → offers).
  // Attribution rule:
  //   • explicit ?ref=<partnerId> wins — application is stamped to that
  //     partner and appears in their /v/<brand>/applications view only.
  //   • no ref → stamp UNATTRIBUTED_PARTNER_ID. The row stays in the
  //     master view for triage but never surfaces in any partner-scoped
  //     portal (cross-tenant safe).
  const [persisted, setPersisted] = useState(false);
  useEffect(() => {
    if (step !== 'offers' || persisted) return;
    const partnerId = ref || UNATTRIBUTED_PARTNER_ID;
    const top = eligibleLenders[0];
    saveSubmittedApp({
      partnerId,
      brand: b,
      customer: `${intake.firstName.trim()} ${intake.lastName.trim()}`.trim(),
      customerEmail: intake.email.trim(),
      amountCents: cents(intake.amount),
      tier,
      lender: top?.displayName ?? 'Pending lender match',
    });
    submitApplicationToApi({
      brand: b,
      partnerId,
      refQuery: ref || undefined,
      consumerFirst: intake.firstName.trim(),
      consumerLast: intake.lastName.trim(),
      consumerEmail: intake.email.trim(),
      consumerPhone: intake.phone.replace(/\D+/g, ''),
      amountCents: cents(intake.amount),
      tier,
      selectedLender: top?.displayName,
      requestId: applicationId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    });
    setPersisted(true);
  }, [step, persisted, ref, eligibleLenders, intake, tier, b, applicationId]);

  // Hardening item 1: consent capture. Before the consumer leaves the
  // disclaimer step, capture the soft-pull authorization receipt:
  // localStorage mirror + POST to /api/applications/consent which
  // stamps server-side timestamp + IP + userAgent. The receipt is the
  // legal artifact proving FCRA §604(a)(2) authorization.
  const acceptDisclaimer = async () => {
    if (!consent) {
      setError('Tick the box to continue.');
      return;
    }
    if (!applicationId || !sessionId) {
      // Defensive: session hooks haven't hydrated yet. Wait a tick.
      setError('Just a moment, securing your session.');
      return;
    }
    setError(null);
    setConsentBusy(true);
    await captureConsent({ applicationId, sessionId });
    setConsentBusy(false);
    setStep('intake');
  };
  const startEngine = () => {
    setError(null);
    const amt = cents(intake.amount);
    if (
      !intake.firstName.trim() ||
      !intake.lastName.trim() ||
      !intake.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ||
      !intake.phone.replace(/\D/g, '').match(/^\d{10}$/) ||
      amt < 5_000_00 ||
      amt > 50_000_00
    ) {
      setError(
        'Please fill every field. Phone must be 10 digits and amount between $5,000–$50,000.',
      );
      return;
    }
    // Soft tier inference for the demo — production routes through the
    // orchestration engine (soft pull → affordability → knockouts →
    // lender waterfall, §14 of the CTO blueprint). The tier here only
    // shapes which sample offers we render. We bias away from
    // 'no_match' so a perfectly valid applicant always gets offers.
    const score = (intake.email + intake.firstName + intake.lastName)
      .split('')
      .reduce((s, c) => s + c.charCodeAt(0), 0);
    const tiers: CreditTier[] = ['prime_plus', 'prime', 'near_prime', 'sub_prime'];
    setTier(tiers[score % tiers.length]!);
    setStep('engine');
    setTimeout(() => setStep('offers'), 3200);
  };

  return (
    <div
      data-brand={b}
      className="min-h-screen apply-shell"
      style={{ background: `rgb(${theme.soft})` }}
    >
      {b === 'medpay' && <MedPayStyleBlock />}
      {/* Hardening item 10: idle timeout. */}
      <ConsumerIdleGuard onExpire={handleIdleExpire} />

      {/* Header */}
      <header
        className="border-b"
        style={{ background: 'white', borderColor: `rgb(${theme.navy} / 0.10)` }}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ background: `rgb(${theme.navy})` }}
            >
              {b === 'medpay' ? (
                <HeartPulseIcon size={18} className="text-white" />
              ) : b === 'tradepay' ? (
                <HomeIcon size={18} className="text-white" />
              ) : (
                <CrownIcon size={18} className="text-white" />
              )}
            </div>
            <div className="leading-tight">
              <div
                className="text-[15px] font-bold tracking-tight"
                style={{ color: `rgb(${theme.navy})` }}
              >
                {content.brandName}
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gray-500 -mt-0.5">
                {content.brandTagline}
              </div>
            </div>
          </a>

          {step === 'landing' && (
            <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-gray-700">
              <a href="#how" className="hover:text-gray-900">
                How It Works
              </a>
              <a href="#stories" className="hover:text-gray-900">
                Stories
              </a>
              <a href="#faq" className="hover:text-gray-900">
                FAQ
              </a>
              <span className="inline-flex items-center gap-1.5 text-gray-700">
                <PhoneIcon size={14} /> 1-800-FINANCE
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep('disclaimer')}
            className="h-9 px-4 rounded-lg text-white font-semibold text-[13px] flex items-center gap-2"
            style={{ background: `rgb(${theme.navy})` }}
          >
            {step === 'landing' ? content.ctaPrimary : 'Continue'}
          </button>
        </div>
      </header>

      {step === 'landing' && (
        <Landing
          content={content}
          theme={theme}
          ref_={ref}
          onApply={() => setStep('disclaimer')}
          brand={b}
        />
      )}

      {step !== 'landing' && (
        <main className="max-w-3xl mx-auto px-6 lg:px-10 py-10 md:py-14">
          {step === 'disclaimer' && (
            <DisclaimerStep
              content={content}
              consent={consent}
              setConsent={setConsent}
              onAccept={acceptDisclaimer}
              onBack={() => setStep('landing')}
              theme={theme}
              consentBusy={consentBusy}
            />
          )}
          {step === 'intake' && (
            <IntakeStep
              content={content}
              intake={intake}
              setIntake={setIntake}
              onSubmit={startEngine}
              theme={theme}
            />
          )}
          {step === 'engine' && <EngineStep brandName={content.brandName} theme={theme} />}
          {step === 'offers' && (
            <OffersStep
              content={content}
              theme={theme}
              tier={tier}
              amountCents={cents(intake.amount)}
              lenders={eligibleLenders}
              chosen={chosen}
              setChosen={setChosen}
              ref_={ref}
            />
          )}

          {error && (
            <p className="mt-4 text-[13px] text-red-600 text-center" role="alert">
              {error}
            </p>
          )}
        </main>
      )}

      {/* Hardening item 3: ECOA / Reg B fixed footer notice. Required
          on every credit-related consumer-facing page so the consumer
          can always reach the CRAs and understand their adverse-action
          rights. */}
      <footer className="border-t bg-white" style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-4 text-[11px] text-gray-600 leading-relaxed">
          {ECOA_FOOTER_NOTICE}
        </div>
      </footer>
    </div>
  );
}

// ─────── Marketing landing ────────────────────────────────────────────

function Landing({
  content,
  theme,
  ref_,
  onApply,
  brand,
}: {
  content: ReturnType<typeof brandContent>;
  theme: ReturnType<typeof brandTheme>;
  ref_: string;
  onApply: () => void;
  brand: Exclude<BrandCode, 'direct'>;
}) {
  const lenderLabel =
    brand === 'medpay'
      ? 'medical-finance lenders'
      : brand === 'tradepay'
        ? 'home-improvement lenders'
        : 'learning-finance lenders';
  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, rgb(${theme.soft}) 0%, white 60%, rgb(${theme.highlight}) 100%)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 lg:py-24 text-center">
          {ref_ && (
            <span
              className="inline-block text-[11px] uppercase tracking-[0.18em] font-semibold px-3 py-1 rounded-full mb-4"
              style={{ background: `rgb(${theme.accent} / 0.10)`, color: `rgb(${theme.accent})` }}
            >
              Referred by partner · {ref_}
            </span>
          )}
          <h1
            className="text-[40px] md:text-[52px] font-bold leading-tight tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            {content.heroHeadline}
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, rgb(${theme.accent}) 0%, rgb(${theme.navy}) 100%)`,
              }}
            >
              {content.heroHighlight}
            </span>
          </h1>
          <p className="mt-5 text-[16px] text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {content.heroSubtitle}
          </p>

          <div className="mt-6 flex items-center justify-center flex-wrap gap-2">
            {content.industryChips.map((c) => (
              <span
                key={c}
                className="text-[12px] font-medium px-3 py-1 rounded-full bg-white border"
                style={{ borderColor: `rgb(${theme.navy} / 0.10)`, color: `rgb(${theme.navy})` }}
              >
                {c}
              </span>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onApply}
              className="h-12 px-7 rounded-lg text-white font-semibold text-[15px] flex items-center gap-2 shadow-sm"
              style={{ background: `rgb(${theme.navy})` }}
            >
              {content.ctaPrimary}
              <ArrowRightIcon size={14} />
            </button>
            <a
              href="#how"
              className="h-12 px-6 inline-flex items-center text-[14px] font-medium text-gray-700 hover:text-gray-900"
            >
              {content.ctaSecondary}
            </a>
          </div>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon size={12} /> Soft credit check · No impact
            </span>
            <span>·</span>
            <span>Takes 60 seconds</span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section style={{ background: `rgb(${theme.navy})` }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {content.stats.map((s) => (
            <div key={s.label}>
              <div className="text-[24px] font-bold text-white tracking-tight">{s.value}</div>
              <div className="text-[11px] text-white/60 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <p
            className="text-[11px] uppercase tracking-[0.18em] font-semibold text-center mb-2"
            style={{ color: `rgb(${theme.accent})` }}
          >
            Why {content.brandName}
          </p>
          <h2
            className="text-[28px] font-bold text-center tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            Benefits That Set Us Apart
          </h2>
          <p className="text-center text-[14px] text-gray-600 mt-2 max-w-2xl mx-auto">
            We work with top {lenderLabel} to bring you the most competitive rates and flexible
            terms.
          </p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.benefits.map((bb, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-5 relative"
                style={{ borderColor: `rgb(${theme.navy} / 0.12)` }}
              >
                {bb.pill && (
                  <span
                    className="absolute -top-2 right-4 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                    style={{ background: `rgb(${theme.accent})` }}
                  >
                    {bb.pill}
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="size-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: `rgb(${theme.accent} / 0.12)`,
                      color: `rgb(${theme.accent})`,
                    }}
                  >
                    <CheckIcon size={16} />
                  </span>
                  <h3 className="text-[15px] font-semibold" style={{ color: `rgb(${theme.navy})` }}>
                    {bb.title}
                  </h3>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed">{bb.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="how" style={{ background: `rgb(${theme.soft})` }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <p
            className="text-[11px] uppercase tracking-[0.18em] font-semibold text-center mb-2"
            style={{ color: `rgb(${theme.accent})` }}
          >
            Simple Process
          </p>
          <h2
            className="text-[28px] font-bold text-center tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            Three Simple Steps
          </h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.steps.map((s, i) => (
              <div
                key={i}
                className="rounded-xl bg-white p-6 border"
                style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
              >
                <div
                  className="size-9 rounded-full flex items-center justify-center text-white font-bold text-[13px]"
                  style={{ background: `rgb(${theme.navy})` }}
                >
                  {i + 1}
                </div>
                <h3
                  className="mt-4 text-[16px] font-semibold"
                  style={{ color: `rgb(${theme.navy})` }}
                >
                  {s.title}
                </h3>
                <p className="mt-2 text-[13px] text-gray-600 leading-relaxed">{s.description}</p>
                <ul className="mt-4 space-y-1.5">
                  {s.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-[12px] text-gray-700">
                      <CheckIcon
                        size={12}
                        className="mt-1 shrink-0"
                        style={{ color: `rgb(${theme.accent})` }}
                      />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={onApply}
              className="h-12 px-7 rounded-lg text-white font-semibold text-[15px] inline-flex items-center gap-2 shadow-sm"
              style={{ background: `rgb(${theme.navy})` }}
            >
              {content.ctaPrimary}
              <ArrowRightIcon size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="stories" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
          <p
            className="text-[11px] uppercase tracking-[0.18em] font-semibold text-center mb-2"
            style={{ color: `rgb(${theme.accent})` }}
          >
            Customer Stories
          </p>
          <h2
            className="text-[28px] font-bold text-center tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            Trusted by thousands
          </h2>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white p-6"
                style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
              >
                <div
                  className="text-[24px] leading-none mb-3"
                  style={{ color: `rgb(${theme.accent})` }}
                >
                  &ldquo;
                </div>
                <p className="text-[13px] text-gray-700 leading-relaxed">{t.quote}</p>
                <div
                  className="mt-5 pt-4 border-t"
                  style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}
                >
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: `rgb(${theme.navy})` }}
                  >
                    {t.name}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: `rgb(${theme.soft})` }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16">
          <p
            className="text-[11px] uppercase tracking-[0.18em] font-semibold text-center mb-2"
            style={{ color: `rgb(${theme.accent})` }}
          >
            FAQ
          </p>
          <h2
            className="text-[28px] font-bold text-center tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            Common questions
          </h2>

          <div className="mt-8 space-y-3">
            {content.faq.map((f, i) => (
              <details
                key={i}
                className="group rounded-xl border bg-white p-5"
                style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
              >
                <summary
                  className="cursor-pointer text-[14px] font-semibold flex items-center justify-between"
                  style={{ color: `rgb(${theme.navy})` }}
                >
                  {f.q}
                  <span
                    className="text-[20px] leading-none transition-transform group-open:rotate-45"
                    style={{ color: `rgb(${theme.accent})` }}
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[13px] text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: `rgb(${theme.navy})` }}>
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-14 text-center">
          <h2 className="text-[28px] font-bold tracking-tight text-white">Ready to get started?</h2>
          <p className="mt-3 text-[14px] text-white/70">{content.footerTagline}</p>
          <button
            type="button"
            onClick={onApply}
            className="mt-7 h-12 px-7 rounded-lg font-semibold text-[15px] inline-flex items-center gap-2 shadow-sm"
            style={{ background: `rgb(${theme.accent})`, color: 'white' }}
          >
            {content.ctaPrimary}
            <ArrowRightIcon size={14} />
          </button>
          <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <ShieldIcon size={12} /> 256-bit encryption
            </span>
            <span>·</span>
            <span>SOC 2 compliant</span>
            <span>·</span>
            <span>Soft credit check only</span>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t" style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 text-center text-[11px] text-gray-500">
          © 2026 {content.brandName}. {content.brandName} is a financing marketplace and is not a
          lender. Pre-qualification uses a soft credit inquiry which has no impact on your credit
          score. Each lender is responsible for their own underwriting + final rate and terms.
        </div>
      </footer>
    </>
  );
}

// ─────── Step content ──────────────────────────────────────────────

function DisclaimerStep({
  content,
  consent,
  setConsent,
  onAccept,
  onBack,
  theme,
  consentBusy,
}: {
  content: ReturnType<typeof brandContent>;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onAccept: () => void;
  onBack: () => void;
  theme: ReturnType<typeof brandTheme>;
  consentBusy: boolean;
}) {
  // FCRA soft-pull disclaimer pattern — centred "Before We Begin"
  // title + sub, three pulse bullets, two-button stack.
  //   single white card with file icon + 3 paragraphs + 4 acknowledgements
  //   trust row above checkbox
  //   Back · Continue buttons OUTSIDE the card (Continue disabled until consent)
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center pt-2 pb-6">
        <h2
          className="text-[34px] md:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: `rgb(${theme.navy})` }}
        >
          Before We Begin
        </h2>
        <p className="mt-3 text-[14px] text-gray-600 max-w-xl mx-auto">
          Please review the following information before proceeding with your eligibility check.
        </p>
      </div>

      <div
        className="rounded-2xl border bg-white shadow-sm p-7 md:p-8"
        style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <span
            className="size-6 rounded-md flex items-center justify-center"
            style={{ background: `rgb(${theme.accent} / 0.12)`, color: `rgb(${theme.accent})` }}
          >
            <DocIcon size={14} />
          </span>
          <h3 className="text-[16px] font-bold tracking-tight text-gray-900">
            Important Disclosures
          </h3>
        </div>

        <div className="space-y-4 text-[14px] text-gray-700 leading-relaxed">
          <p>
            We provide estimated financing options. Final approval and terms are set by the lender.
            All offers shown are preliminary and subject to verification.
          </p>
          <p>
            We may run eligibility checks and use third-party data sources to assess your
            application. A soft credit check may be performed which will not impact your credit
            score.
          </p>
          <p>
            By continuing, you consent to {content.brandName} and its lending partners processing
            your personal data for the purpose of assessing your eligibility for financial products.
            You also consent to receiving communications regarding your application status and
            available offers.
          </p>
        </div>

        {/* Hardening item 2: explicit "what we collect / who we share with"
            panel, in plain English. Collapsed by default so the page
            doesn't get noisy, but always reachable on the same step the
            consumer authorizes the soft-pull. */}
        <details
          className="mt-4 rounded-lg border bg-gray-50 p-4"
          style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}
        >
          <summary className="cursor-pointer text-[13px] font-semibold text-gray-900">
            What we collect, and who we share it with
          </summary>
          <div className="mt-3 text-[13px] text-gray-700 leading-relaxed space-y-3">
            <div>
              <div className="font-semibold text-gray-900">What we collect</div>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Name, email, mobile phone</li>
                <li>
                  Requested amount and purpose of financing (typed verbatim, no compute on our side)
                </li>
                <li>
                  Date of birth and Social Security Number on later steps if you proceed (last 4
                  stored visibly, full SSN encrypted via PiiVault)
                </li>
                <li>Your current address on later steps if you proceed</li>
                <li>
                  Bank routing number and last 4 of the account number on later steps (full account
                  number encrypted)
                </li>
                <li>Device fingerprint and IP address for fraud prevention</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Who we share it with</div>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Participating lenders in our network: {PARTICIPATING_LENDERS.join(', ')}</li>
                <li>Highsale, our soft-pull credit aggregator</li>
                <li>Identity and device fraud-prevention services</li>
              </ul>
            </div>
          </div>
        </details>

        {/* Hardening item 1: the verbatim soft-pull consent text the
            consumer is authorizing. This exact string is what the
            audit chain records as the FCRA §604(a)(2) artifact. */}
        <p className="mt-4 text-[13px] text-gray-700 leading-relaxed bg-amber-50 border border-amber-200 rounded-md p-3">
          {SOFT_PULL_CONSENT_TEXT}
        </p>

        <div className="my-5 border-t" style={{ borderColor: `rgb(${theme.navy} / 0.08)` }} />

        <p className="text-[13px] font-semibold text-gray-900 mb-2">
          By proceeding you acknowledge:
        </p>
        <ul className="space-y-2 text-[13px] text-gray-700">
          {[
            'Electronic Signatures in Global and National Commerce Act (E-SIGN Act)',
            'Telephone Consumer Protection Act (TCPA) — automated communications',
            'Fair Credit Reporting Act (FCRA) — soft credit inquiries',
            'Terms of Service and Privacy Policy',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span
                className="size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ color: `rgb(${theme.accent})` }}
              >
                <CheckIcon size={13} />
              </span>
              {line}
            </li>
          ))}
        </ul>

        <div
          className="mt-5 pt-5 border-t flex items-center gap-5 text-[12px] text-gray-600"
          style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldIcon size={13} /> 256-bit Encryption
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon size={13} /> No impact to credit score
          </span>
        </div>

        <label className="mt-5 flex items-center gap-2.5 cursor-pointer text-[14px] text-gray-800 select-none">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
            style={{ accentColor: `rgb(${theme.accent})` }}
          />
          I understand and agree to the terms above
        </label>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-11 px-4 rounded-lg text-[14px] font-semibold text-gray-700 hover:text-gray-900 inline-flex items-center gap-2"
        >
          <ArrowRightIcon size={14} className="rotate-180" />
          Back
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={!consent || consentBusy}
          className="h-11 px-7 rounded-lg text-white font-semibold text-[14px] inline-flex items-center gap-2 disabled:opacity-40 transition-opacity"
          style={{ background: `rgb(${theme.navy})` }}
        >
          {consentBusy ? 'Recording consent...' : 'Continue'}
          <ArrowRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}

function IntakeStep({
  content,
  intake,
  setIntake,
  onSubmit,
  theme,
}: {
  content: ReturnType<typeof brandContent>;
  intake: Intake;
  setIntake: React.Dispatch<React.SetStateAction<Intake>>;
  onSubmit: () => void;
  theme: ReturnType<typeof brandTheme>;
}) {
  const setStr = (k: keyof Intake) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setIntake((s) => ({ ...s, [k]: e.target.value }));

  // Auto-format phone as user types: 5551234567 → (555) 123-4567
  const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    let formatted = digits;
    if (digits.length > 6)
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    else if (digits.length > 0) formatted = `(${digits}`;
    setIntake((s) => ({ ...s, phone: formatted }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center pt-2 pb-6">
        <h2
          className="text-[34px] md:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: `rgb(${theme.navy})` }}
        >
          Let&apos;s Get Started
        </h2>
        <p className="mt-3 text-[14px] text-gray-600 max-w-xl mx-auto">
          Enter your details below so we can match you with the right financing options.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="rounded-2xl border bg-white shadow-sm p-7 md:p-8"
        style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First Name">
            <Input
              placeholder="John"
              value={intake.firstName}
              onChange={setStr('firstName')}
              autoComplete="given-name"
              required
            />
          </Field>
          <Field label="Last Name">
            <Input
              placeholder="Doe"
              value={intake.lastName}
              onChange={setStr('lastName')}
              autoComplete="family-name"
              required
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="john.doe@example.com"
              value={intake.email}
              onChange={setStr('email')}
              autoComplete="email"
              required
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Cell Phone">
            <Input
              type="tel"
              placeholder="(555) 123-4567"
              value={intake.phone}
              onChange={onPhone}
              autoComplete="tel"
              inputMode="numeric"
              maxLength={14}
              required
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Requested Amount ($)" hint={content.intakeAmountHelper}>
            <Input
              type="number"
              placeholder="e.g. 20000"
              value={intake.amount}
              onChange={setStr('amount')}
              inputMode="numeric"
              min={5000}
              max={50000}
              step={500}
              required
            />
          </Field>
        </div>

        <div
          className="mt-5 pt-5 border-t flex items-center gap-5 text-[12px] text-gray-600"
          style={{ borderColor: `rgb(${theme.navy} / 0.08)` }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldIcon size={13} /> 256-bit Encryption
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon size={13} /> No impact to credit score
          </span>
        </div>

        <button
          type="submit"
          className="mt-5 w-full h-12 rounded-xl text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-95"
          style={{ background: `rgb(${theme.navy})` }}
        >
          Check My Options
          <ArrowRightIcon size={15} />
        </button>
      </form>
    </div>
  );
}

function EngineStep({
  brandName,
  theme,
}: {
  brandName: string;
  theme: ReturnType<typeof brandTheme>;
}) {
  // Progressive checklist — each item turns green ~900ms after the
  // previous one so the user sees the orchestration engine's stages
  // tick by (eligibility → lender quote → ranking).
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setProgress(1), 700);
    const t2 = setTimeout(() => setProgress(2), 1700);
    const t3 = setTimeout(() => setProgress(3), 2700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const stages = ['Verifying eligibility', 'Checking lender rates', 'Preparing your offers'];

  return (
    <div className="max-w-xl mx-auto py-12 flex flex-col items-center text-center">
      <div
        className="size-12 rounded-full border-[3px] border-t-transparent animate-spin"
        style={{ borderColor: `rgb(${theme.accent})`, borderTopColor: 'transparent' }}
      />
      <h2
        className="mt-6 text-[24px] font-bold tracking-tight"
        style={{ color: `rgb(${theme.navy})` }}
      >
        Finding your best offers…
      </h2>
      <p className="mt-2 text-[14px] text-gray-600 max-w-sm">
        Comparing rates from {brandName}&apos;s lending partners for the best match.
      </p>

      <ul className="mt-7 space-y-3 text-[14px] text-left w-full max-w-[260px] mx-auto">
        {stages.map((label, i) => {
          const done = i < progress;
          const active = i === progress;
          return (
            <li
              key={label}
              className="flex items-center gap-2.5 transition-colors"
              style={{ color: done ? `rgb(${theme.accent})` : active ? '#1f2937' : '#9ca3af' }}
            >
              {done ? (
                <CheckIcon size={16} />
              ) : (
                <span
                  className={
                    'size-4 rounded-full border-2 ' +
                    (active ? 'border-current' : 'border-gray-300')
                  }
                />
              )}
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OffersStep({
  content,
  theme,
  tier,
  amountCents,
  lenders,
  chosen,
  setChosen,
  ref_,
}: {
  content: ReturnType<typeof brandContent>;
  theme: ReturnType<typeof brandTheme>;
  tier: CreditTier;
  amountCents: number;
  lenders: MarketplaceLenderRow[];
  chosen: string | null;
  setChosen: (id: string) => void;
  ref_: string;
}) {
  const effectiveAmount = amountCents > 0 ? amountCents : 20_000_00;
  const [term, setTerm] = useState<36 | 48 | 60>(48);
  const [showMore, setShowMore] = useState(false);

  // 15-minute countdown — fresh every render of the offers screen.
  const [expiresAt] = useState(() => Date.now() + 15 * 60 * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, expiresAt - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  const monthly = Math.round(effectiveAmount / 100 / term);

  if (lenders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center pt-2 pb-6">
          <h2
            className="text-[32px] md:text-[38px] font-bold tracking-tight"
            style={{ color: `rgb(${theme.navy})` }}
          >
            No matches right now
          </h2>
          <p className="mt-3 text-[14px] text-gray-600 max-w-lg mx-auto">
            Your referring partner has no lenders enabled for this credit tier. Reach out to them
            and they can request access at /lender-marketplace/access.
          </p>
        </div>
      </div>
    );
  }

  const top = lenders[0]!;
  const rest = lenders.slice(1);

  // Map non-top lenders to a deterministic "approval likelihood" so the
  // demo presents a believable ladder (top → 92%, then 80%, 72%, 60%…).
  const likelihoodFor = (idx: number) => Math.max(40, 80 - idx * 10);
  const aprBandFor = (idx: number) => {
    const base = 7 + idx * 5;
    return `${base}.9% – ${base + 5}.9%`;
  };
  const monthlyFor = (idx: number) =>
    Math.round(effectiveAmount / 100 / Math.max(24, 48 - idx * 12));
  const termBandFor = (idx: number) => `${24 - Math.min(idx * 6, 12)} – ${48 - idx * 12} months`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center pt-2 pb-6">
        <h2
          className="text-[34px] md:text-[40px] font-bold tracking-tight leading-tight"
          style={{ color: `rgb(${theme.navy})` }}
        >
          You&apos;ve been matched!
        </h2>
        <p className="mt-3 text-[14px] text-gray-600 max-w-xl mx-auto">
          {content.brandName === 'MedPay'
            ? 'the lender marketplace quotes in parallel. Ranked by lowest total cost. Soft pull only — your credit score is unchanged.'
            : 'Based on your profile, here are your pre-qualified funding options.'}
        </p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] font-semibold text-gray-500">
          Expires in {mm}:{ss} · {tierLabel[tier]} · FICO {tierFico[tier]}
        </p>
      </div>

      {/* ── AI Recommended hero card ── */}
      <div
        className="rounded-2xl p-7 text-white shadow-lg"
        style={{ background: `rgb(${theme.navy})` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="size-9 rounded-lg flex items-center justify-center font-bold text-[14px]"
              style={{ background: 'white', color: `rgb(${theme.navy})` }}
            >
              {content.brandName.slice(0, 1)}
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.18em] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
              style={{ background: 'rgba(255,255,255,0.13)' }}
            >
              <BoltIcon size={11} /> AI Recommended
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-[0.18em] text-white/60 font-semibold">
              Approval Likelihood
            </div>
            <div className="mt-1 flex items-center justify-end gap-2">
              <div className="w-20 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full"
                  style={{ width: '92%', background: `rgb(${theme.accent})` }}
                />
              </div>
              <span className="text-[15px] font-bold">92%</span>
            </div>
          </div>
        </div>

        <p className="mt-5 text-[12px] uppercase tracking-wider text-white/65">
          {content.offerProduct}
        </p>
        <p className="text-[44px] md:text-[48px] font-bold tracking-tight leading-none mt-1">
          {fmt(effectiveAmount)}
        </p>
        <p className="text-[14px] text-white/70 mt-1.5">
          est. <span className="font-semibold text-white">${monthly.toLocaleString('en-US')}</span>
          /month
        </p>

        <span
          className="inline-flex mt-4 items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          APR: 4.9% – 8.9%
        </span>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-2">
            Select Term
          </div>
          <div
            className="inline-flex p-1 rounded-xl gap-1"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {([36, 48, 60] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={
                  'px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ' +
                  (term === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-white/75 hover:text-white')
                }
              >
                {t} mo
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setChosen(top.id)}
          className="mt-6 w-full md:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl bg-white text-[14px] font-bold shadow-sm hover:opacity-95 transition-opacity"
          style={{ color: `rgb(${theme.navy})` }}
        >
          Apply Now
          <ArrowRightIcon size={14} />
        </button>

        <div
          className="mt-6 pt-5 border-t grid grid-cols-1 md:grid-cols-2 gap-2 text-[13px] text-white/85"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="flex items-center gap-2">
            <ChartIcon size={14} /> Lowest monthly cost
          </div>
          <div className="flex items-center gap-2">
            <ShieldIcon size={14} /> Highest approval likelihood
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon size={14} /> Optimised for your profile
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon size={14} /> No early repayment penalties
          </div>
        </div>
      </div>

      {/* ── Other Available Options (collapsed) ── */}
      {rest.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full flex items-center justify-between text-[12px] font-bold uppercase tracking-[0.16em] text-gray-700 hover:text-gray-900 py-2"
          >
            <span>Other Available Options ({rest.length})</span>
            <span
              className={'transition-transform ' + (showMore ? 'rotate-180' : '')}
              style={{ color: `rgb(${theme.accent})` }}
            >
              ▾
            </span>
          </button>

          {showMore && (
            <ul className="mt-3 space-y-3">
              {rest.map((l, idx) => {
                const fits =
                  amountCents === 0 ||
                  (amountCents >= l.minAmountCents && amountCents <= l.maxAmountCents);
                const isChosen = chosen === l.id;
                const lk = likelihoodFor(idx);
                return (
                  <li
                    key={l.id}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                    style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-9 rounded-lg flex items-center justify-center font-bold text-[14px]"
                          style={{
                            background: `rgb(${theme.accent} / 0.12)`,
                            color: `rgb(${theme.accent})`,
                          }}
                        >
                          {l.displayName.slice(0, 1)}
                        </span>
                        <div>
                          <div
                            className="text-[15px] font-bold tracking-tight"
                            style={{ color: `rgb(${theme.navy})` }}
                          >
                            {l.displayName}
                          </div>
                          <div className="text-[12px] text-gray-500">
                            {fmt(l.minAmountCents)} – {fmt(l.maxAmountCents)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
                          Approval Likelihood
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full"
                              style={{ width: `${lk}%`, background: `rgb(${theme.accent})` }}
                            />
                          </div>
                          <span
                            className="text-[14px] font-bold tabular-nums"
                            style={{ color: `rgb(${theme.navy})` }}
                          >
                            {lk}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-3">
                      <span
                        className="text-[28px] font-bold tracking-tight"
                        style={{ color: `rgb(${theme.navy})` }}
                      >
                        {fmt(effectiveAmount)}
                      </span>
                      <span className="text-[13px] text-gray-500">
                        est. ${monthlyFor(idx).toLocaleString('en-US')}/month
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] text-gray-700">
                      <div>APR: {aprBandFor(idx)}</div>
                      <div>Term: {termBandFor(idx)}</div>
                      <div className="flex items-center gap-1.5">
                        <CheckIcon size={12} style={{ color: `rgb(${theme.accent})` }} />
                        No early repayment penalty
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckIcon size={12} style={{ color: `rgb(${theme.accent})` }} />
                        Quick processing
                      </div>
                    </div>

                    {!fits && (
                      <div className="mt-3 text-[12px] text-amber-700">
                        Requested amount sits outside this lender&apos;s envelope.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setChosen(l.id)}
                      className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-lg text-[13px] font-semibold border transition-colors"
                      style={{
                        borderColor: `rgb(${theme.navy} / 0.15)`,
                        color: `rgb(${theme.navy})`,
                        background: isChosen ? `rgb(${theme.accent} / 0.10)` : 'white',
                      }}
                    >
                      {isChosen ? 'Selected' : 'Apply Now'}
                      <ArrowRightIcon size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-7 text-center text-[12px] text-gray-500 max-w-lg mx-auto">
        Not sure what to choose? Start with your best option — we&apos;ll automatically route you to
        other lenders if needed.
      </p>

      {/* ── Apply → Approval → Funding strip ── */}
      <div
        className="mt-5 rounded-2xl border bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
        style={{ borderColor: `rgb(${theme.navy} / 0.10)` }}
      >
        {[
          { icon: <CheckIcon size={14} />, title: 'Apply', sub: '2 min application' },
          { icon: <BoltIcon size={14} />, title: 'Approval', sub: 'Instant decision' },
          { icon: <BankIcon size={14} />, title: 'Funding', sub: '24 – 48 hrs' },
        ].map((s, i) => (
          <div key={s.title} className="flex items-center gap-3">
            <span
              className="size-9 rounded-lg flex items-center justify-center"
              style={{
                background: `rgb(${theme.accent} / 0.12)`,
                color: `rgb(${theme.accent})`,
              }}
            >
              {s.icon}
            </span>
            <div>
              <div className="text-[13px] font-bold" style={{ color: `rgb(${theme.navy})` }}>
                {s.title}
              </div>
              <div className="text-[11px] text-gray-500">{s.sub}</div>
            </div>
            {i < 2 && (
              <span className="hidden md:inline-flex ml-auto text-gray-300">
                <ArrowRightIcon size={14} />
              </span>
            )}
          </div>
        ))}
      </div>

      {chosen && (
        <div
          className="mt-5 rounded-xl border px-4 py-3 text-[13px] flex items-start gap-3"
          style={{
            background: `rgb(${theme.accent} / 0.08)`,
            borderColor: `rgb(${theme.accent} / 0.35)`,
            color: `rgb(${theme.navy})`,
          }}
        >
          <CheckIcon size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Continuing to lender…</p>
            <p className="text-[12px] mt-0.5">
              We&apos;ll hand you off to {lenders.find((l) => l.id === chosen)?.displayName} to
              finish your application.
              {ref_ && (
                <>
                  {' '}
                  Attribution back to partner <span className="font-mono">{ref_}</span>.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────── Field primitives ───────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-gray-800 mb-1.5">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3.5 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
    />
  );
}

// ─────── Filtering ──────────────────────────────────────────────────

interface FilterArgs {
  brand: Exclude<BrandCode, 'direct'>;
  partnerId: string;
  tier: CreditTier;
  amountCents: number;
}

function filterLenders({
  brand,
  partnerId,
  tier,
  amountCents,
}: FilterArgs): MarketplaceLenderRow[] {
  return marketplaceLenders.filter((l) => {
    if (l.brands.length > 0 && !l.brands.includes(brand)) return false;
    if (!l.servesTiers.includes(tier)) return false;
    const override = partnerId
      ? partnerAccessOverrides.find(
          (o) => o.merchantId === partnerId && o.marketplaceLenderId === l.id,
        )
      : undefined;
    const effective = override ? override.enabled : l.globallyEnabled;
    if (!effective) return false;
    if (amountCents > 0 && (amountCents < l.minAmountCents || amountCents > l.maxAmountCents))
      return false;
    return true;
  });
}

/**
 * MedPay-specific visual upgrades. Lifts the same colour language and
 * 3D depth used on /landing/medpay so the patient experience aligns
 * with the marketing surface. Compliance copy (FCRA consent, ECOA
 * notice) is untouched — only the visual treatment changes.
 *
 * Scoped via [data-brand="medpay"] so TradePay and CoachPay apply
 * pages keep their existing themes unchanged.
 */
function MedPayStyleBlock() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          [data-brand="medpay"] {
            --mp-teal: #0E7C66;
            --mp-teal-2: #22B8A0;
            --mp-teal-3: #2BC5AD;
            --mp-teal-deep: #062C29;
            --mp-teal-pale: rgba(34, 184, 160, 0.06);
            --mp-teal-line: rgba(14, 124, 102, 0.10);
            --mp-teal-glow: rgba(14, 124, 102, 0.45);
            --mp-ink: #062C29;
            --mp-ink-2: #355A53;
          }

          /* Soft clinical gradient background with subtle grid mask,
             matched to the MedPay landing hero. */
          [data-brand="medpay"].apply-shell {
            background:
              radial-gradient(1200px 600px at 10% 0%, rgba(34, 184, 160, 0.10), transparent 60%),
              radial-gradient(800px 600px at 90% 20%, rgba(14, 124, 102, 0.06), transparent 70%),
              linear-gradient(180deg, #ECFFFE 0%, #FFFFFF 70%);
            position: relative;
          }
          [data-brand="medpay"].apply-shell::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            background-image:
              linear-gradient(rgba(14, 124, 102, 0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 124, 102, 0.025) 1px, transparent 1px);
            background-size: 56px 56px;
            mask-image: radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%);
            -webkit-mask-image: radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%);
            z-index: 0;
          }
          [data-brand="medpay"] > * { position: relative; z-index: 1; }

          /* Headlines and body get the landing's tightened Inter rhythm. */
          [data-brand="medpay"] h1,
          [data-brand="medpay"] h2,
          [data-brand="medpay"] h3 {
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            letter-spacing: -0.022em;
          }

          /* Header logomark — gradient teal instead of flat deep navy. */
          [data-brand="medpay"] header {
            background: rgba(255, 255, 255, 0.78) !important;
            backdrop-filter: blur(10px);
            border-color: var(--mp-teal-line) !important;
          }

          /* Primary CTAs get gradient + glow shadow (matches landing). */
          [data-brand="medpay"] header button,
          [data-brand="medpay"] .cta-medpay,
          [data-brand="medpay"] button[type="submit"]:not([data-mp-ghost]) {
            background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%) !important;
            box-shadow: 0 12px 30px -10px var(--mp-teal-glow) !important;
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          [data-brand="medpay"] header button:hover,
          [data-brand="medpay"] .cta-medpay:hover,
          [data-brand="medpay"] button[type="submit"]:not([data-mp-ghost]):hover {
            background: linear-gradient(180deg, var(--mp-teal-3) 0%, #138B73 100%) !important;
            box-shadow: 0 16px 40px -12px var(--mp-teal-glow) !important;
            transform: translateY(-1px);
          }

          /* AI Recommended hero offer card — 3D perspective + teal
             gradient instead of flat dark fill. */
          [data-brand="medpay"] main > div > div.rounded-2xl.p-7.text-white {
            background: linear-gradient(160deg,
              var(--mp-teal-deep) 0%,
              var(--mp-teal) 55%,
              #128973 100%) !important;
            box-shadow:
              0 40px 100px -30px rgba(14, 124, 102, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.12);
            transform: perspective(1400px) rotateX(1.5deg);
            transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
                        box-shadow 0.4s ease;
            position: relative;
            overflow: hidden;
          }
          [data-brand="medpay"] main > div > div.rounded-2xl.p-7.text-white::after {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(600px 300px at 100% 0%, rgba(255, 255, 255, 0.08), transparent 70%);
            pointer-events: none;
          }
          [data-brand="medpay"] main > div > div.rounded-2xl.p-7.text-white:hover {
            transform: perspective(1400px) rotateX(0deg) translateY(-4px);
            box-shadow:
              0 50px 120px -30px rgba(14, 124, 102, 0.7),
              inset 0 1px 0 rgba(255, 255, 255, 0.15);
          }

          /* "Other Available Options" secondary cards — frosted with
             teal border that matches the landing's glass-teal pattern. */
          [data-brand="medpay"] main ul > li.rounded-2xl.border.bg-white {
            background: rgba(255, 255, 255, 0.78) !important;
            backdrop-filter: blur(8px);
            border-color: var(--mp-teal-line) !important;
            box-shadow: 0 20px 50px -25px rgba(14, 124, 102, 0.18);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          [data-brand="medpay"] main ul > li.rounded-2xl.border.bg-white:hover {
            transform: translateY(-3px);
            box-shadow: 0 30px 70px -25px rgba(14, 124, 102, 0.28);
          }

          /* Pulse dot keyframes for the engine loading step + any other
             "live" indicators. */
          @keyframes mpPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(1.4); }
          }
          [data-brand="medpay"] .mp-pulse-dot,
          [data-brand="medpay"] [data-mp-pulse] {
            animation: mpPulse 1.4s ease-in-out infinite;
          }

          /* Footer ECOA notice — tone-shifted to soft teal so it
             belongs to the page. Text-readability and content
             are unchanged. */
          [data-brand="medpay"] footer {
            background: rgba(255, 255, 255, 0.78) !important;
            backdrop-filter: blur(8px);
            border-color: var(--mp-teal-line) !important;
          }
        `,
      }}
    />
  );
}
