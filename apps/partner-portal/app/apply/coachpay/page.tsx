'use client';

/**
 * Dedicated CoachPay consumer apply page.
 *
 * Why a static route instead of the dynamic /apply/[brand] page?
 * Because the brief is "make it visually identical to /landing/coachpay
 * end-to-end." That requires the AUREAN-style design system (dark
 * navy panels, purple/violet accent, perspective rings, glass cards,
 * 3D offer card, floating chips, scanline keyframes) applied to every
 * step of the apply flow. Trying to over-layer those onto the
 * multi-brand dynamic page would bleed styles into the TradePay and
 * MedPay apply flows. A dedicated route is the cleanest isolation.
 *
 * Next.js App Router serves the static segment over the dynamic one,
 * so this file owns /apply/coachpay and the dynamic [brand] route
 * handles the remaining (tradepay / direct) brands.
 *
 * Compliance (FCRA soft-pull consent, ECOA / Reg B footer, session
 * fingerprint binding, idle timeout, replaceState back-prevention,
 * in-flight throttle) is preserved 1:1 from the Wave 2C hardening,
 * using the same shared `consumer-consent.ts` + ConsumerIdleGuard as
 * the MedPay dedicated route and the dynamic [brand] page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  TrophyIcon,
  ChartIcon,
} from '@eazepay/ui/web';
import {
  marketplaceLenders,
  partnerAccessOverrides,
  tierLabel,
  tierFico,
  type CreditTier,
  type MarketplaceLenderRow,
} from '../../../lib/marketplace-data';
import {
  ECOA_FOOTER_NOTICE,
  SOFT_PULL_CONSENT_TEXT,
  captureConsent,
  ensureApplicationId,
  ensureSessionId,
  sessionStillBound,
} from '../../../lib/consumer-consent';
import { ConsumerIdleGuard } from '../../../components/ConsumerIdleGuard';
import { saveSubmittedApp, UNATTRIBUTED_PARTNER_ID } from '../../../lib/submitted-applications';

type Step = 'landing' | 'disclaimer' | 'intake' | 'engine' | 'offers';

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

interface FilterArgs {
  partnerId: string;
  tier: CreditTier;
  amountCents: number;
}
/**
 * Filter lenders for this brand × tier × partner × amount, with a
 * tier-fallback walk so a sparse coachpay sub_prime pool still
 * surfaces offers (the matcher walks toward prime first, then back
 * toward sub_prime).
 */
const TIER_ORDER: CreditTier[] = ['prime_plus', 'prime', 'near_prime', 'sub_prime'];
function filterLenders({ partnerId, tier, amountCents }: FilterArgs): MarketplaceLenderRow[] {
  const passesNonTier = (l: MarketplaceLenderRow): boolean => {
    if (l.brands.length > 0 && !l.brands.includes('coachpay')) return false;
    const override = partnerId
      ? partnerAccessOverrides.find(
          (o) => o.merchantId === partnerId && o.marketplaceLenderId === l.id,
        )
      : undefined;
    const effective = override ? override.enabled : l.globallyEnabled;
    if (!effective) return false;
    if (amountCents > 0 && (amountCents < l.minAmountCents || amountCents > l.maxAmountCents)) {
      return false;
    }
    return true;
  };
  const tryTier = (t: CreditTier) =>
    marketplaceLenders.filter((l) => passesNonTier(l) && l.servesTiers.includes(t));

  const direct = tryTier(tier);
  if (direct.length > 0) return direct;

  const idx = TIER_ORDER.indexOf(tier);
  for (let i = idx - 1; i >= 0; i--) {
    const r = tryTier(TIER_ORDER[i]!);
    if (r.length > 0) return r;
  }
  for (let i = idx + 1; i < TIER_ORDER.length; i++) {
    const r = tryTier(TIER_ORDER[i]!);
    if (r.length > 0) return r;
  }
  return [];
}

export default function CoachPayApplyPage() {
  const params = useSearchParams();
  const ref = params.get('ref') ?? '';

  const [step, setStep] = useState<Step>('landing');
  const [consent, setConsent] = useState(false);
  const [intake, setIntake] = useState<Intake>(BLANK_INTAKE);
  const [tier, setTier] = useState<CreditTier>('prime');
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);

  // Session fingerprint binding (Wave 2C item 5)
  const [sessionId, setSessionId] = useState<string>('');
  const [applicationId, setApplicationId] = useState<string>('');
  useEffect(() => {
    setSessionId(ensureSessionId());
    setApplicationId(ensureApplicationId());
  }, []);

  // replaceState back-prevention (Wave 2C item 9)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.history.replaceState({ step }, '');
  }, [step]);

  // Reset scroll to top whenever the step changes so consumers land at
  // the top of the new step on mobile (no mid-page jumps).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, [step]);

  // Persist the application on engine → offers. Attribution: explicit
  // ?ref=<partnerId> wins; otherwise fall back to the CoachPay demo
  // partner (p_atlas) so an unattributed test still shows up only in
  // CoachPay's portal.
  const [persisted, setPersisted] = useState(false);

  // Session-bind enforcement
  useEffect(() => {
    if (!sessionId) return;
    if (step === 'landing' || step === 'disclaimer') return;
    if (!sessionStillBound()) {
      setIntake(BLANK_INTAKE);
      setStep('landing');
    }
  }, [step, sessionId]);

  const handleIdleExpire = () => {
    setIntake(BLANK_INTAKE);
    if (typeof window !== 'undefined') {
      window.sessionStorage.clear();
      document.cookie = 'eazepay_session=; Path=/; Max-Age=0; SameSite=Lax';
    }
    setStep('landing');
  };

  const eligibleLenders = useMemo(
    () =>
      filterLenders({
        partnerId: ref,
        tier,
        amountCents: cents(intake.amount),
      }),
    [ref, tier, intake.amount],
  );

  // Save app to the per-partner store once we land on the offers step.
  // Attribution: explicit ?ref=<partnerId> wins. With no ref we stamp
  // UNATTRIBUTED_PARTNER_ID so the row stays out of every partner-scoped
  // portal. Master ops can re-attribute via admin tools.
  useEffect(() => {
    if (step !== 'offers' || persisted) return;
    const partnerId = ref || UNATTRIBUTED_PARTNER_ID;
    const top = eligibleLenders[0];
    saveSubmittedApp({
      partnerId,
      brand: 'coachpay',
      customer: `${intake.firstName.trim()} ${intake.lastName.trim()}`.trim(),
      customerEmail: intake.email.trim(),
      amountCents: cents(intake.amount),
      tier,
      lender: top?.displayName ?? 'Pending lender match',
    });
    setPersisted(true);
  }, [step, persisted, ref, eligibleLenders, intake, tier]);

  const acceptDisclaimer = async () => {
    if (!consent) {
      setError('Tick the box to continue.');
      return;
    }
    if (!applicationId || !sessionId) {
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
        'Please fill every field. Phone must be 10 digits and amount between $5,000 and $50,000.',
      );
      return;
    }
    const score = (intake.email + intake.firstName + intake.lastName)
      .split('')
      .reduce((s, c) => s + c.charCodeAt(0), 0);
    const tiers: CreditTier[] = ['prime_plus', 'prime', 'near_prime', 'sub_prime'];
    setTier(tiers[score % tiers.length]!);
    setStep('engine');
    setTimeout(() => setStep('offers'), 3200);
  };

  return (
    <div className="coachpay-root cp-root">
      <style dangerouslySetInnerHTML={{ __html: COACHPAY_APPLY_CSS }} />
      <ConsumerIdleGuard onExpire={handleIdleExpire} />

      {/* ============== NAV ============== */}
      <nav className="cp-apply-nav">
        <div className="cp-apply-nav-inner">
          <a href="#" className="cp-brand">
            <span className="cp-brand-mark">
              <TrophyIcon size={14} className="text-white" />
            </span>
            <span className="cp-apply-brand-word">
              CoachPay <span className="cp-brand-sub">· Tuition financing</span>
            </span>
          </a>
          <div className="cp-nav-cta">
            {step !== 'landing' && (
              <button
                type="button"
                className="cp-btn cp-btn--ghost"
                onClick={() => setStep('landing')}
              >
                Restart
              </button>
            )}
            {step === 'landing' && (
              <button
                type="button"
                className="cp-btn cp-btn--violet"
                onClick={() => setStep('disclaimer')}
              >
                Check my rate
                <ArrowRightIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ============== HERO / LANDING STEP ============== */}
      {step === 'landing' && <LandingStep onApply={() => setStep('disclaimer')} />}

      {/* ============== APPLY FLOW ============== */}
      {step !== 'landing' && (
        <main className="cp-apply-main">
          <div className="cp-ambient-glow" />
          <div className="cp-ambient-grid" />
          <div className="cp-apply-container">
            {step === 'disclaimer' && (
              <DisclaimerStep
                consent={consent}
                setConsent={setConsent}
                onAccept={acceptDisclaimer}
                onBack={() => setStep('landing')}
                consentBusy={consentBusy}
              />
            )}
            {step === 'intake' && (
              <IntakeStep
                intake={intake}
                setIntake={setIntake}
                onSubmit={startEngine}
                onBack={() => setStep('disclaimer')}
              />
            )}
            {step === 'engine' && <EngineStep />}
            {step === 'offers' && (
              <OffersStep
                tier={tier}
                amountCents={cents(intake.amount)}
                lenders={eligibleLenders}
                chosen={chosen}
                setChosen={setChosen}
                onBack={() => setStep('intake')}
              />
            )}

            {error && (
              <p className="cp-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </main>
      )}

      {/* ============== FOOTER (ECOA / Reg B) ============== */}
      <footer className="cp-apply-footer">
        <div className="cp-apply-container">
          <p className="cp-ecoa">{ECOA_FOOTER_NOTICE}</p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LANDING STEP — mirrors /landing/coachpay hero shape: eyebrow pill,
// gradient white-to-grey headline, CTAs, hero stats strip on the left;
// perspective 3D offer card with the violet "approved" stamp + floating
// chips on the right.
// ─────────────────────────────────────────────────────────────────────
function LandingStep({ onApply }: { onApply: () => void }) {
  return (
    <section className="cp-apply-hero">
      <div className="cp-ambient-glow" />
      <div className="cp-ambient-grid" />
      <div className="cp-container">
        <div className="cp-apply-hero-grid">
          <div className="cp-apply-hero-copy">
            <span className="cp-eyebrow">
              <span className="cp-eyebrow-dot" />
              SOFT PULL · ZERO IMPACT TO YOUR SCORE
            </span>
            <h1 className="cp-apply-h1">
              <span className="cp-grad-text">Finance your next chapter.</span>
              <br />
              <span className="cp-grad-text-violet">On your terms.</span>
            </h1>
            <p className="cp-apply-hero-sub">
              Pay for coaching, bootcamps, certifications, and mastermind tuition over 12 to 60
              months. <span className="cp-emph">Pre-qualify in 10 seconds.</span> Soft credit check
              only. APR from 5.9% for qualifying learners. Funds disburse to your program directly.
            </p>
            <div className="cp-hero-ctas">
              <button type="button" className="cp-btn cp-btn--violet cp-btn--lg" onClick={onApply}>
                Check my rate
                <ArrowRightIcon size={14} />
              </button>
              <a href="#how" className="cp-btn cp-btn--ghost cp-btn--lg">
                How it works
              </a>
            </div>
            <div className="cp-apply-hero-strip">
              <div>
                <div className="cp-apply-strip-v">
                  10<span className="cp-apply-strip-unit">sec</span>
                </div>
                <div className="cp-apply-strip-l">
                  <span className="cp-apply-strip-live">
                    <span className="cp-apply-strip-live-dot" />
                    LIVE
                  </span>
                  Pre-qualification
                </div>
              </div>
              <div>
                <div className="cp-apply-strip-v">Real-time</div>
                <div className="cp-apply-strip-l">Lenders parallel</div>
              </div>
              <div>
                <div className="cp-apply-strip-v">
                  5.9<span className="cp-apply-strip-unit">%</span>
                </div>
                <div className="cp-apply-strip-l">APR from</div>
              </div>
              <div>
                <div className="cp-apply-strip-v">
                  0<span className="cp-apply-strip-unit">%</span>
                </div>
                <div className="cp-apply-strip-l">Credit impact</div>
              </div>
            </div>
          </div>

          <div className="cp-apply-hero-right">
            <div className="cp-apply-hero-stage">
              <div className="cp-hero-ring" aria-hidden />

              {/* Hero offer card — same gradient panel + violet stamp + livebar
                  layout as the landing's `.cp-hero-card`. Chips live INSIDE the
                  card so they anchor to its actual corners (the stage is wider
                  than the card thanks to the perspective ring). */}
              <div className="cp-apply-hero-card cp-glow-edge">
                {/* Floating chips — corner-anchored to the card with a small
                    pixel overhang. */}
                <div
                  className="cp-chip cp-chip--violet cp-chip--anchor cp-chip--tl"
                  style={{ animationDelay: '0s' }}
                >
                  <span className="cp-chip-k">
                    <span className="cp-chip-dot" />
                    INSTANT
                  </span>
                  <span className="cp-chip-v">10s soft-pull pre-qual</span>
                </div>
                <div
                  className="cp-chip cp-chip--anchor cp-chip--tr"
                  style={{ animationDelay: '0.5s' }}
                >
                  <span className="cp-chip-k">MARKETPLACE</span>
                  <span className="cp-chip-v">Lender marketplace · 5s SLA</span>
                </div>
                <div
                  className="cp-chip cp-chip--anchor cp-chip--bl"
                  style={{ animationDelay: '1.0s' }}
                >
                  <span className="cp-chip-k">APR FROM 5.9%</span>
                  <span className="cp-chip-v">12 to 60 month terms</span>
                </div>
                <div
                  className="cp-chip cp-chip--anchor cp-chip--br"
                  style={{ animationDelay: '1.5s' }}
                >
                  <span className="cp-chip-k">PAYOUT</span>
                  <span className="cp-chip-v">program-direct · 48 to 72h</span>
                </div>

                <div className="cp-card-head">
                  <div>
                    <div className="cp-card-eyebrow">
                      <span className="cp-card-blip" />
                      COACHPAY · APPROVED
                    </div>
                    <div className="cp-card-title">Mastermind enrolment · approved</div>
                  </div>
                  <div className="cp-card-stamp">approved</div>
                </div>

                <div className="cp-card-amount">
                  <span className="cp-card-amount-curr">$</span>
                  <span className="cp-card-amount-n">14,000</span>
                </div>
                <div className="cp-card-amount-sub">Sample offer · 36-month program</div>

                <div className="cp-card-offer-grid">
                  <div>
                    <div className="cp-card-k">lender</div>
                    <div className="cp-card-v">Cross River Bank</div>
                  </div>
                  <div>
                    <div className="cp-card-k">term</div>
                    <div className="cp-card-v">36 months</div>
                  </div>
                  <div>
                    <div className="cp-card-k">est. monthly</div>
                    <div className="cp-card-v">$432 / mo</div>
                  </div>
                  <div>
                    <div className="cp-card-k">APR</div>
                    <div className="cp-card-v">from 5.9%</div>
                  </div>
                </div>

                <div className="cp-card-livebar">
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">lenders queried</span>
                    <span className="cp-card-livebar-v">parallel quotes</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">decision time</span>
                    <span className="cp-card-livebar-v">10 s</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">payout</span>
                    <span className="cp-card-livebar-v">program-direct · 48 to 72h</span>
                  </div>
                  <div className="cp-card-livebar-row">
                    <span className="cp-card-livebar-k">credit impact</span>
                    <span className="cp-card-livebar-v cp-card-livebar-v--violet">
                      none · soft pull only
                    </span>
                  </div>
                </div>

                <button type="button" className="cp-card-cta" onClick={onApply}>
                  Start my application
                  <ArrowRightIcon size={14} />
                </button>

                <div className="cp-card-foot">
                  <span className="cp-card-foot-k">
                    <span className="cp-card-foot-dot" />
                    soft pull · zero credit impact
                  </span>
                  <span className="cp-card-foot-k cp-card-foot-k--right">FCRA · disclosed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============== HOW IT WORKS ============== */}
        <section id="how" className="cp-how">
          <div className="cp-how-eyebrow">
            <span className="cp-eyebrow-dot" />
            HOW IT WORKS · 4 STEPS
          </div>
          <h2 className="cp-apply-h2 cp-how-title">
            <span className="cp-grad-text">From enrolment call</span>
            <br />
            <span className="cp-grad-text-violet">to funded in 72 hours.</span>
          </h2>
          <div className="cp-how-grid">
            {[
              {
                n: '01',
                title: 'Apply during your enrolment call',
                body: 'Soft credit pull only — zero impact to your score. Takes about 60 seconds on your phone, before you commit.',
              },
              {
                n: '02',
                title: 'We match you',
                body: 'coaching-friendly lenders across the marketplace quote in parallel. Pre-qualified offers ranked by lowest total cost.',
              },
              {
                n: '03',
                title: 'You pick the plan',
                body: 'Compare APR, term, and monthly payment side-by-side. Plans from 24 to 60 months. APR from 5.9%.',
              },
              {
                n: '04',
                title: 'Program paid direct',
                body: 'Once you accept, the lender pays your coach or program directly — typically within 48 to 72 hours.',
              },
            ].map((s) => (
              <div key={s.n} className="cp-how-step cp-step-glass">
                <div className="cp-how-step-n">{s.n}</div>
                <div className="cp-how-step-title">{s.title}</div>
                <p className="cp-how-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============== CALCULATOR ============== */}
        <section className="cp-calc">
          <div className="cp-calc-eyebrow">
            <span className="cp-eyebrow-dot" />
            PAYMENT ESTIMATOR · ILLUSTRATIVE ONLY
          </div>
          <h2 className="cp-apply-h2 cp-calc-title">
            <span className="cp-grad-text">What might my</span>
            <br />
            <span className="cp-grad-text-violet">monthly payment look like?</span>
          </h2>
          <CoachPayCalculator onApply={onApply} />
        </section>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CoachPay payment estimator. Amortization across a real-world APR
// ramp tied to credit tier — Excellent → Building. Disclosed as
// illustrative so a coach demoing the calc on a strategy call doesn't
// set false expectations against a prospect whose real pre-qual lands
// in a higher tier.
// ─────────────────────────────────────────────────────────────────────
const CP_TIERS = [
  { key: 'excellent', label: 'Excellent', sub: '720+ FICO', apr: 0.059 },
  { key: 'good', label: 'Good', sub: '660–719', apr: 0.099 },
  { key: 'fair', label: 'Fair', sub: '600–659', apr: 0.149 },
  { key: 'building', label: 'Building', sub: 'under 600', apr: 0.249 },
] as const;
type CpTier = (typeof CP_TIERS)[number]['key'];

function CoachPayCalculator({ onApply }: { onApply: () => void }) {
  const [amount, setAmount] = useState(14000);
  const [term, setTerm] = useState<12 | 24 | 36 | 48 | 60>(36);
  const [tier, setTier] = useState<CpTier>('good');
  const activeTier = CP_TIERS.find((t) => t.key === tier)!;
  const APR = activeTier.apr;
  const r = APR / 12;
  const monthly = Math.round((amount * r) / (1 - Math.pow(1 + r, -term)));
  const totalPaid = monthly * term;
  const totalInterest = Math.max(0, totalPaid - amount);

  return (
    <div className="cp-calc-card cp-step-glass">
      <div className="cp-calc-grid">
        <div className="cp-calc-field">
          <div className="cp-calc-label">
            <span>Tuition / program cost</span>
            <strong>${amount.toLocaleString('en-US')}</strong>
          </div>
          <input
            type="range"
            min={1500}
            max={50000}
            step={500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="cp-calc-range"
            aria-label="Tuition or program cost in USD"
          />
          <div className="cp-calc-range-foot">
            <span>$1.5k</span>
            <span>$50k</span>
          </div>
        </div>

        <div className="cp-calc-field">
          <div className="cp-calc-label">
            <span>Term</span>
            <strong>{term} months</strong>
          </div>
          <div className="cp-calc-terms">
            {([12, 24, 36, 48, 60] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`cp-calc-term ${t === term ? 'is-active' : ''}`}
                onClick={() => setTerm(t)}
                aria-pressed={t === term}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credit-tier selector — drives APR so the estimator reflects the
          prospect's actual tier instead of always quoting the "from
          5.9%" floor. Native select for fast picking + iOS native UI. */}
      <div className="cp-calc-field cp-calc-field--full cp-calc-tier-field">
        <div className="cp-calc-label">
          <span>Credit profile</span>
          <strong>
            {activeTier.label} · {activeTier.sub}
          </strong>
        </div>
        <div className="cp-calc-select-wrap">
          <select
            className="cp-calc-select"
            value={tier}
            onChange={(e) => setTier(e.target.value as CpTier)}
            aria-label="Credit profile"
          >
            {CP_TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} · {t.sub}
              </option>
            ))}
          </select>
          <span className="cp-calc-select-caret" aria-hidden>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      <div className="cp-calc-result">
        <div className="cp-calc-result-main">
          <div className="cp-calc-result-k">Est. monthly</div>
          <div className="cp-calc-result-v">
            ${monthly.toLocaleString('en-US')}
            <span className="cp-calc-result-unit"> / mo</span>
          </div>
        </div>
        <div className="cp-calc-result-side">
          <div>
            <div className="cp-calc-result-k">Total interest</div>
            <div className="cp-calc-result-vs">${totalInterest.toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="cp-btn cp-btn--primary cp-btn--lg cp-btn--full cp-calc-cta"
        onClick={onApply}
      >
        Check my real rate
        <ArrowRightIcon size={14} />
      </button>
      <p className="cp-calc-disc">
        Illustrative — based on a representative {activeTier.label.toLowerCase()} credit profile (
        {activeTier.sub}). Soft pull only; your actual APR, term, and monthly payment are set by
        your pre-qualified offers.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DISCLAIMER STEP — FCRA soft-pull consent. Verbatim language, dark
// glass card with hairline border, violet gradient CTA.
// ─────────────────────────────────────────────────────────────────────
function DisclaimerStep({
  consent,
  setConsent,
  onAccept,
  onBack,
  consentBusy,
}: {
  consent: boolean;
  setConsent: (v: boolean) => void;
  onAccept: () => void;
  onBack: () => void;
  consentBusy: boolean;
}) {
  return (
    <div className="cp-step cp-step-glass">
      <div className="cp-step-tag">01 · CONSENT</div>
      <h2 className="cp-apply-h2">
        <span className="cp-grad-text">Quick consent.</span>
        <br />
        <span className="cp-grad-text-violet">No impact to your credit score.</span>
      </h2>
      <p className="cp-step-body">
        Before we match you with lenders, federal law requires you to authorize a soft credit
        inquiry. Your score is not affected.
      </p>

      <div className="cp-consent-box">
        <p className="cp-consent-text">{SOFT_PULL_CONSENT_TEXT}</p>
      </div>

      <label className="cp-consent-toggle">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I authorize a soft credit pull and have read the Privacy Policy and E-Sign Disclosure.
        </span>
      </label>

      <div className="cp-step-actions">
        <button type="button" className="cp-btn cp-btn--ghost cp-btn--lg" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="cp-btn cp-btn--violet cp-btn--lg"
          onClick={onAccept}
          disabled={consentBusy}
        >
          {consentBusy ? 'Confirming…' : 'I agree, continue'}
          {!consentBusy && <ArrowRightIcon size={14} />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// INTAKE STEP — 5-field minimal pre-qual form. Same field structure as
// MedPay, restyled to the dark navy + violet palette. autoComplete=off
// so browser restore doesn't auto-populate PII on a shared device.
// ─────────────────────────────────────────────────────────────────────
function IntakeStep({
  intake,
  setIntake,
  onSubmit,
  onBack,
}: {
  intake: Intake;
  setIntake: (next: Intake) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div className="cp-step cp-step-glass">
      <button type="button" className="cp-step-back" onClick={onBack} aria-label="Back to consent">
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="cp-step-tag">02 · YOUR DETAILS</div>
      <h2 className="cp-apply-h2">
        <span className="cp-grad-text">Let&apos;s match you with</span>
        <br />
        <span className="cp-grad-text-violet">the right plan.</span>
      </h2>
      <p className="cp-step-body">
        Soft credit inquiry only. Your details stay private and encrypted.
      </p>

      <form
        className="cp-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="cp-form-row">
          <label>
            <span className="cp-form-label">First name</span>
            <input
              type="text"
              value={intake.firstName}
              onChange={(e) => setIntake({ ...intake, firstName: e.target.value })}
              required
              autoComplete="off"
            />
          </label>
          <label>
            <span className="cp-form-label">Last name</span>
            <input
              type="text"
              value={intake.lastName}
              onChange={(e) => setIntake({ ...intake, lastName: e.target.value })}
              required
              autoComplete="off"
            />
          </label>
        </div>
        <label>
          <span className="cp-form-label">Email</span>
          <input
            type="email"
            value={intake.email}
            onChange={(e) => setIntake({ ...intake, email: e.target.value })}
            required
            autoComplete="off"
          />
        </label>
        <label>
          <span className="cp-form-label">Mobile phone</span>
          <input
            type="tel"
            value={intake.phone}
            onChange={(e) => setIntake({ ...intake, phone: e.target.value })}
            required
            autoComplete="off"
            placeholder="(555) 555 5555"
          />
        </label>
        <label>
          <span className="cp-form-label">Tuition amount (USD)</span>
          <input
            type="text"
            inputMode="numeric"
            value={intake.amount}
            onChange={(e) => setIntake({ ...intake, amount: e.target.value })}
            required
            autoComplete="off"
            placeholder="14000"
          />
          <span className="cp-form-helper">Most learners borrow between $5,000 and $50,000.</span>
        </label>

        <button type="submit" className="cp-btn cp-btn--violet cp-btn--lg cp-form-submit">
          See my offers
          <ArrowRightIcon size={14} />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ENGINE STEP — animated "querying the lender marketplace" loading screen. Violet
// pulse dot, gradient progress bar fill, staggered tick list. Lifted
// from the landing's marketplace bar + livebar motion.
// ─────────────────────────────────────────────────────────────────────
function EngineStep() {
  const stages = [
    'Soft credit pull · FCRA permissible purpose',
    'Affordability check · debt-to-income ratio',
    'Routing decision · brand + tier match',
    'Quoting the lender marketplace in parallel',
    'Ranking by lowest total cost',
  ];
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => Math.min(i + 1, stages.length - 1)), 600);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <div className="cp-step cp-step-glass cp-engine">
      <div className="cp-step-tag">
        <span className="cp-eyebrow-dot" />
        LIVE
      </div>
      <h2 className="cp-apply-h2">
        <span className="cp-grad-text">Matching you with</span>
        <br />
        <span className="cp-grad-text-violet">the lender marketplace in parallel.</span>
      </h2>

      <div className="cp-engine-bar">
        <div className="cp-engine-bar-track">
          <div className="cp-engine-bar-fill" />
        </div>
      </div>

      <ul className="cp-engine-stages">
        {stages.map((s, i) => (
          <li key={s} className={i <= activeIdx ? 'on' : ''}>
            <span className={i <= activeIdx ? 'cp-engine-tick on' : 'cp-engine-tick'}>
              {i <= activeIdx ? <CheckIcon size={11} /> : i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// OFFERS STEP — top "AI Recommended" 3D offer card + ranked secondary
// cards. Same translateZ depth, violet gradient fill, and floating-pill
// treatment as the landing financing mockup's `.cp-fin-offer--best`.
// ─────────────────────────────────────────────────────────────────────
function OffersStep({
  tier,
  amountCents,
  lenders,
  chosen,
  setChosen,
  onBack,
}: {
  tier: CreditTier;
  amountCents: number;
  lenders: MarketplaceLenderRow[];
  chosen: string | null;
  setChosen: (id: string) => void;
  onBack: () => void;
}) {
  const effectiveAmount = amountCents > 0 ? amountCents : 14_000_00;
  const [term, setTerm] = useState<36 | 48 | 60>(36);
  const [showMore, setShowMore] = useState(false);

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
      <div className="cp-step cp-step-glass">
        <div className="cp-step-tag">NO MATCHES</div>
        <h2 className="cp-apply-h2">
          <span className="cp-grad-text">No matches right now.</span>
        </h2>
        <p className="cp-step-body">
          Your referring program has no lenders enabled for this credit tier. Reach out to them or
          try a different tuition amount.
        </p>
      </div>
    );
  }

  const top = lenders[0]!;
  const rest = lenders.slice(1);
  const likelihoodFor = (idx: number) => Math.max(40, 80 - idx * 10);

  return (
    <div className="cp-offers">
      <button
        type="button"
        className="cp-step-back"
        onClick={onBack}
        aria-label="Back to your details"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="cp-offers-head">
        <div className="cp-step-tag">
          <span className="cp-eyebrow-dot" />
          OFFERS READY
        </div>
        <h2 className="cp-apply-h2">
          <span className="cp-grad-text">You&apos;ve been matched!</span>
        </h2>
        <p className="cp-step-body">
          the lender marketplace quotes in parallel. Ranked by lowest total cost. Soft pull only —
          your credit score is unchanged.
        </p>
        <p className="cp-offers-meta">
          Expires in {mm}:{ss} · {tierLabel[tier]} · FICO {tierFico[tier]}
        </p>
      </div>

      {/* Recommended hero offer — translateZ + violet gradient like the
          landing financing mockup's best offer. */}
      <div className="cp-apply-offer-card cp-apply-offer-card-hero cp-glow-edge">
        <div className="cp-card-head">
          <div>
            <div className="cp-offer-tag cp-offer-tag-recommended">
              <BoltIcon size={11} /> AI RECOMMENDED
            </div>
            <div className="cp-card-title">{top.displayName} · approved</div>
          </div>
          <div className="cp-card-stamp">approval · 92%</div>
        </div>

        <div className="cp-card-amount">
          <span className="cp-card-amount-curr">$</span>
          <span className="cp-card-amount-n">
            {(effectiveAmount / 100).toLocaleString('en-US')}
          </span>
        </div>
        <div className="cp-card-amount-sub">approved</div>

        <div className="cp-card-offer-grid">
          <div>
            <div className="cp-card-k">est. monthly</div>
            <div className="cp-card-v">
              ${monthly.toLocaleString('en-US')}
              <span className="cp-card-v-dim"> · {term} mo</span>
            </div>
          </div>
          <div>
            <div className="cp-card-k">APR</div>
            <div className="cp-card-v">5.9% – 7.9%</div>
          </div>
          <div>
            <div className="cp-card-k">lender</div>
            <div className="cp-card-v cp-card-v-sm">{top.displayName}</div>
          </div>
          <div>
            <div className="cp-card-k">payout</div>
            <div className="cp-card-v cp-card-v-sm">48 to 72h · program-direct</div>
          </div>
        </div>

        <div className="cp-term-row">
          <span className="cp-term-label">Term</span>
          <div className="cp-term-toggle">
            {([36, 48, 60] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerm(t)}
                className={term === t ? 'on' : ''}
              >
                {t} mo
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={() => setChosen(top.id)} className="cp-card-cta">
          Apply with {top.displayName}
          <ArrowRightIcon size={14} />
        </button>

        <div className="cp-card-foot">
          <span className="cp-card-foot-k">
            <ChartIcon size={11} /> Lowest total cost
          </span>
          <span className="cp-card-foot-k cp-card-foot-k--right">
            <ShieldIcon size={11} /> Best approval likelihood
          </span>
        </div>
      </div>

      {/* Secondary cards — dark glass, hover lift. */}
      {rest.length > 0 && (
        <div className="cp-offers-more">
          <button type="button" onClick={() => setShowMore((v) => !v)} className="cp-offers-toggle">
            <span>Other available options ({rest.length})</span>
            <span className={'cp-offers-chevron ' + (showMore ? 'open' : '')}>▾</span>
          </button>
          {showMore && (
            <ul className="cp-offers-list">
              {rest.map((l, idx) => {
                const lk = likelihoodFor(idx);
                const fits =
                  amountCents === 0 ||
                  (amountCents >= l.minAmountCents && amountCents <= l.maxAmountCents);
                return (
                  <li
                    key={l.id}
                    className={
                      'cp-apply-offer-card cp-apply-offer-card-secondary' +
                      (chosen === l.id ? ' is-chosen' : '')
                    }
                  >
                    <div className="cp-card-head">
                      <div className="cp-offer-tag">{l.displayName}</div>
                      <div className="cp-offer-id">
                        {fits ? 'eligible' : 'amount outside envelope'}
                      </div>
                    </div>
                    <div className="cp-card-offer-grid">
                      <div>
                        <div className="cp-card-k">approval</div>
                        <div className="cp-card-v">{lk}%</div>
                      </div>
                      <div>
                        <div className="cp-card-k">range</div>
                        <div className="cp-card-v cp-card-v-sm">
                          {fmt(l.minAmountCents)} – {fmt(l.maxAmountCents)}
                        </div>
                      </div>
                      <div>
                        <div className="cp-card-k">term</div>
                        <div className="cp-card-v cp-card-v-sm">12 – 60 mo</div>
                      </div>
                      <div>
                        <div className="cp-card-k">APR</div>
                        <div className="cp-card-v cp-card-v-sm">from 5.9%</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChosen(l.id)}
                      className="cp-card-cta cp-card-cta-ghost"
                    >
                      View terms
                      <ArrowRightIcon size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CSS — lifted directly from /landing/coachpay/page.tsx (the STYLES
// block). Same AUREAN tokens (--cp-bg, --cp-violet, hairlines), same
// dark glass cards, same gradient buttons, same 3D offer card with
// perspective+rotateY hover, same cp-chip-float / cp-throb-violet /
// cp-card-rise / cp-card-float / cp-scanline-x keyframes. New rules at
// the bottom adapt the design system to apply-flow surfaces (cp-step,
// cp-form, cp-engine, cp-offers, ECOA footer).
// ─────────────────────────────────────────────────────────────────────
const COACHPAY_APPLY_CSS = `
:root {
  /* AUREAN palette — lifted verbatim from /landing/coachpay */
  --cp-bg:        #0a0a14;
  --cp-panel:     #101023;
  --cp-panel-2:   #15152e;
  --cp-panel-3:   #1a1a2e;
  --cp-panel-4:   #23233f;
  --cp-panel-5:   #2e2e54;

  --cp-text:      #eeeef2;
  --cp-text-2:    #b9b9c7;
  --cp-muted:     #8a8aa0;
  --cp-faded:     #5c5c76;

  --cp-hairline:  rgba(255, 255, 255, 0.08);
  --cp-hairline-2:rgba(255, 255, 255, 0.12);

  --cp-violet:    #A78BFA;
  --cp-violet-d:  #8B5CF6;
  --cp-violet-dd: #7C3AED;
}

.coachpay-root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: var(--cp-bg);
  color: var(--cp-text);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
  line-height: 1.5;
  letter-spacing: -0.003em;
}
.coachpay-root * { box-sizing: border-box; }
.coachpay-root a { color: inherit; text-decoration: none; }
.coachpay-root button { font-family: inherit; cursor: pointer; }

.cp-container {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
  width: 100%;
  position: relative;
}

/* ============== AMBIENT BACKGROUNDS ============== */
.cp-ambient-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
}
.cp-ambient-glow {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(58,58,106,0.45), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(46,46,84,0.35), transparent 60%),
    radial-gradient(ellipse 40% 30% at 20% 40%, rgba(139,92,246,0.10), transparent 70%),
    radial-gradient(ellipse 30% 25% at 90% 20%, rgba(167,139,250,0.08), transparent 70%);
}

/* ============== GLASS / GLOW EDGE ============== */
.cp-glow-edge { position: relative; }
.cp-glow-edge::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(167,139,250,0.16), transparent 40%, transparent 60%, rgba(139,92,246,0.08));
  pointer-events: none;
  opacity: 0.55;
  mix-blend-mode: overlay;
}

/* ============== BUTTONS ============== */
.cp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 13.5px;
  padding: 10px 16px;
  border-radius: 10px;
  transition: transform 0.15s ease, box-shadow 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  font-family: inherit;
}
.cp-btn--lg { padding: 13px 20px; font-size: 14.5px; border-radius: 12px; }
.cp-btn--xl { padding: 16px 26px; font-size: 15.5px; border-radius: 14px; }
.cp-btn--violet {
  background: linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%);
  color: #fff;
  box-shadow: 0 10px 28px -10px rgba(139, 92, 246, 0.55), inset 0 -1.5px 0 rgba(0,0,0,0.16);
}
.cp-btn--violet:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 40px -12px rgba(139, 92, 246, 0.7), inset 0 -1.5px 0 rgba(0,0,0,0.16);
}
.cp-btn--violet:disabled { opacity: 0.6; cursor: not-allowed; }
.cp-btn--ghost {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--cp-hairline-2);
  color: var(--cp-text);
}
.cp-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.22);
}

/* ============== NAV ============== */
.cp-apply-nav {
  position: sticky; top: 0; z-index: 50;
  padding: 14px 0;
}
.cp-apply-nav-inner {
  max-width: 1240px; margin: 0 auto;
  padding: 10px 18px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
  border: 1px solid var(--cp-hairline);
  border-radius: 16px;
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  box-shadow: 0 10px 40px -22px rgba(0, 0, 0, 0.7);
  margin-left: 24px; margin-right: 24px;
}
.cp-brand { display: inline-flex; align-items: center; gap: 10px; }
.cp-brand-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #2e2e54 0%, #1a1a2e 100%);
  border: 1px solid var(--cp-hairline-2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  color: var(--cp-violet);
}
.cp-apply-brand-word {
  font-weight: 700; font-size: 15px; letter-spacing: -0.01em;
  color: var(--cp-text);
}
.cp-brand-sub { color: var(--cp-muted); font-weight: 400; }
.cp-nav-cta { display: inline-flex; gap: 8px; align-items: center; }
@media (max-width: 640px) {
  .cp-apply-nav-inner { margin-left: 12px; margin-right: 12px; padding: 8px 12px; }
  .cp-brand-sub { display: none; }
}

/* ============== TYPE ============== */
.cp-grad-text {
  background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.cp-grad-text-violet {
  background: linear-gradient(135deg, #C4B5FD 0%, #A78BFA 60%, #8B5CF6 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.cp-emph { color: var(--cp-text); font-weight: 600; }
.cp-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.16em;
  color: var(--cp-text-2);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--cp-hairline);
  padding: 6px 12px;
  border-radius: 999px;
  text-transform: uppercase;
}
.cp-eyebrow-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--cp-violet);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18);
  animation: cp-throb-violet 2.4s ease-in-out infinite;
  display: inline-block;
}
@keyframes cp-throb-violet {
  0%, 100% { box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18); }
  50% { box-shadow: 0 0 0 6px rgba(167, 139, 250, 0.04); }
}

/* ============== HERO ============== */
.cp-apply-hero {
  position: relative;
  padding: 96px 0 64px 0;
  overflow: hidden;
  background: var(--cp-bg);
}
.cp-apply-hero-grid {
  position: relative; z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 56px;
  align-items: center;
}
@media (min-width: 1024px) {
  .cp-apply-hero-grid {
    grid-template-columns: 1.05fr 0.95fr;
    gap: 72px;
  }
}
.cp-apply-hero-copy { position: relative; z-index: 2; }
.cp-apply-h1 {
  font-size: 60px;
  line-height: 1.02;
  letter-spacing: -0.028em;
  font-weight: 800;
  margin: 24px 0 0 0;
}
@media (max-width: 1024px) { .cp-apply-h1 { font-size: 52px; } }
@media (max-width: 768px)  { .cp-apply-h1 { font-size: 40px; } }
@media (max-width: 480px)  { .cp-apply-h1 { font-size: 34px; } }

.cp-apply-h2 {
  font-size: 36px;
  line-height: 1.08;
  letter-spacing: -0.022em;
  font-weight: 700;
  margin-top: 14px;
  color: var(--cp-text);
}
@media (max-width: 540px) { .cp-apply-h2 { font-size: 28px; } }

.cp-apply-hero-sub {
  margin-top: 22px;
  font-size: 17.5px;
  line-height: 1.6;
  color: var(--cp-text-2);
  max-width: 560px;
}
.cp-hero-ctas { margin-top: 32px; display: flex; gap: 10px; flex-wrap: wrap; }
.cp-apply-hero-strip {
  margin-top: 40px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--cp-hairline);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--cp-hairline);
}
.cp-apply-hero-strip > div {
  background: linear-gradient(180deg, rgba(35,35,63,0.5) 0%, rgba(16,16,35,0.5) 100%);
  padding: 16px 18px;
  backdrop-filter: blur(8px);
}
.cp-apply-strip-v {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--cp-text);
  font-variant-numeric: tabular-nums;
}
.cp-apply-strip-unit { color: var(--cp-muted); font-size: 0.7em; margin-left: 2px; }
.cp-apply-strip-l {
  margin-top: 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--cp-muted);
  display: flex; align-items: center; gap: 8px;
}
.cp-apply-strip-live { display: inline-flex; align-items: center; gap: 4px; color: var(--cp-violet); }
.cp-apply-strip-live-dot {
  width: 5px; height: 5px; border-radius: 999px; background: var(--cp-violet);
  animation: cp-throb-violet 1.4s ease-in-out infinite;
}

/* ============== HERO RIGHT (offer card + perspective ring + chips) ============== */
.cp-apply-hero-right { position: relative; min-height: 580px; }
.cp-apply-hero-stage {
  position: relative;
  height: 100%;
  min-height: 580px;
  perspective: 1400px;
  perspective-origin: 50% 30%;
  transform-style: preserve-3d;
}
@media (max-width: 1024px) {
  .cp-apply-hero-right { min-height: 540px; }
  .cp-apply-hero-stage { min-height: 540px; }
}

/* Ring lifted from landing — single rotating violet ring */
.cp-hero-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 520px;
  height: 520px;
  margin-left: -260px;
  margin-top: -260px;
  border-radius: 999px;
  transform-style: preserve-3d;
  border: 1px solid rgba(167, 139, 250, 0.14);
  background:
    radial-gradient(ellipse at center, rgba(139, 92, 246, 0.14), rgba(16, 16, 35, 0.04) 70%),
    linear-gradient(180deg, rgba(167, 139, 250, 0.04), rgba(255,255,255,0));
  box-shadow:
    0 0 0 1px rgba(167, 139, 250, 0.04) inset,
    0 30px 80px -20px rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 1;
  animation: cp-ring-spin 72s linear infinite;
  opacity: 0.7;
}
.cp-hero-ring::after {
  content: ""; position: absolute; inset: 8%;
  border-radius: 999px;
  border: 1px dashed rgba(167, 139, 250, 0.16);
}
.cp-hero-ring::before {
  content: ""; position: absolute; inset: 22%;
  border-radius: 999px;
  border: 1px solid rgba(139, 92, 246, 0.08);
  background: radial-gradient(circle at 50% 40%, rgba(167, 139, 250, 0.10), transparent 70%);
}
@keyframes cp-ring-spin {
  0%   { transform: rotateX(60deg) rotateZ(0deg); }
  100% { transform: rotateX(60deg) rotateZ(360deg); }
}
@media (max-width: 540px) { .cp-hero-ring { display: none; } }

/* ============== HERO OFFER CARD ============== */
.cp-apply-hero-card {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
  border: 1px solid var(--cp-hairline-2);
  border-radius: 22px;
  padding: 24px;
  box-shadow:
    0 30px 80px -30px rgba(0, 0, 0, 0.7),
    0 12px 32px -10px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255,255,255,0.05);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  transform-style: preserve-3d;
  will-change: transform;
  animation:
    cp-card-rise 0.95s cubic-bezier(0.16,1,0.3,1) both,
    cp-card-float 11s ease-in-out 1.1s infinite;
  transition: transform 0.55s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.4s ease;
}
.cp-apply-hero-stage:hover .cp-apply-hero-card {
  animation-play-state: running, paused;
  transform: rotateY(-3deg) rotateX(2deg) translateY(-4px);
  box-shadow:
    0 50px 110px -28px rgba(0, 0, 0, 0.85),
    0 24px 60px -12px rgba(139, 92, 246, 0.32),
    inset 0 1px 0 rgba(255,255,255,0.07);
}
@keyframes cp-card-rise {
  from { opacity: 0; transform: translateY(28px) scale(0.985); }
  to { opacity: 1; transform: none; }
}
@keyframes cp-card-float {
  0%, 100% { transform: translateY(0) rotateY(0deg) rotateX(0deg); }
  50%      { transform: translateY(-10px) rotateY(-0.8deg) rotateX(0.6deg); }
}

.cp-card-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
}
.cp-card-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--cp-text-2);
  text-transform: uppercase;
}
.cp-card-blip {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--cp-violet);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.22);
  animation: cp-throb-violet 2.2s ease-in-out infinite;
}
.cp-card-title {
  margin-top: 4px;
  font-size: 14.5px; font-weight: 600; color: var(--cp-text);
}
.cp-card-stamp {
  background: linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  padding: 5px 10px;
  border-radius: 999px;
  box-shadow: 0 6px 20px -6px rgba(139, 92, 246, 0.55);
  white-space: nowrap;
}
.cp-card-amount {
  margin-top: 18px;
  display: flex; align-items: flex-start; gap: 4px;
  font-variant-numeric: tabular-nums;
}
.cp-card-amount-curr {
  font-size: 24px; font-weight: 700; color: var(--cp-text-2);
  line-height: 1.4;
}
.cp-card-amount-n {
  font-size: 52px; font-weight: 800; letter-spacing: -0.028em;
  line-height: 1.02;
  background: linear-gradient(180deg, #ffffff 0%, #b9b9c7 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.cp-card-amount-sub {
  font-size: 13px; color: var(--cp-muted); margin-top: 4px;
}
.cp-card-offer-grid {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid var(--cp-hairline);
}
.cp-card-k {
  font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--cp-muted); font-weight: 500;
}
.cp-card-v {
  margin-top: 3px;
  font-size: 15px; font-weight: 700; color: var(--cp-text);
  font-variant-numeric: tabular-nums;
}
.cp-card-v-sm { font-size: 12.5px; font-weight: 600; }
.cp-card-v-dim { color: var(--cp-muted); font-weight: 500; font-size: 0.7em; margin-left: 4px; }
.cp-card-livebar {
  margin-top: 16px;
  border-top: 1px solid var(--cp-hairline);
  padding-top: 14px;
  display: grid; gap: 8px;
}
.cp-card-livebar-row { display: flex; justify-content: space-between; align-items: center; }
.cp-card-livebar-k { font-size: 12.5px; color: var(--cp-muted); }
.cp-card-livebar-v {
  font-size: 13.5px; font-weight: 700; color: var(--cp-text);
  font-variant-numeric: tabular-nums;
}
.cp-card-livebar-v--violet { color: var(--cp-violet); }
.cp-card-foot {
  margin-top: 16px; padding-top: 12px;
  border-top: 1px dashed var(--cp-hairline-2);
  display: flex; justify-content: space-between; gap: 10px;
  font-size: 11px;
  flex-wrap: wrap;
}
.cp-card-foot-k {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--cp-muted);
}
.cp-card-foot-k--right { color: var(--cp-text-2); font-weight: 500; }
.cp-card-foot-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--cp-violet);
}

.cp-card-cta {
  margin-top: 16px;
  width: 100%;
  /* Cap the CTA at a readable button width so wide-desktop viewports
     don't get a button the width of the whole card. */
  max-width: 360px;
  margin-left: auto;
  margin-right: auto;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  color: #fff;
  font-weight: 600; font-size: 13.5px;
  border: none;
  box-shadow: 0 10px 28px -10px rgba(139, 92, 246, 0.55), inset 0 -1.5px 0 rgba(0,0,0,0.16);
  transition: transform .15s ease, box-shadow .15s ease;
  cursor: pointer;
  font-family: inherit;
}
.cp-card-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 40px -12px rgba(139, 92, 246, 0.7), inset 0 -1.5px 0 rgba(0,0,0,0.16);
}
.cp-card-cta-ghost {
  background: rgba(255, 255, 255, 0.02);
  color: var(--cp-text);
  border: 1px solid var(--cp-hairline-2);
  box-shadow: none;
}
.cp-card-cta-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.22);
}

/* ============== FLOATING CHIPS ============== */
.cp-chip {
  position: absolute;
  z-index: 8;
  background: linear-gradient(180deg, rgba(35,35,63,0.85) 0%, rgba(16,16,35,0.85) 100%);
  border: 1px solid var(--cp-hairline-2);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 11px;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap;
  color: var(--cp-text);
  box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: cp-chip-float 7s ease-in-out infinite;
  transform-style: preserve-3d;
}
/* Corner-anchored chips — overhang the offer card by 14px so they
   read as floating but stay hugged to the card edges. */
.cp-chip--anchor { z-index: 9; }
.cp-chip--tl { top: -14px; left: -14px; }
.cp-chip--tr { top: -14px; right: -14px; }
.cp-chip--bl { bottom: -14px; left: -14px; }
.cp-chip--br { bottom: -14px; right: -14px; }
@media (max-width: 540px) {
  .cp-chip--anchor { display: none; }
}
@keyframes cp-chip-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.cp-chip-k {
  color: var(--cp-muted);
  text-transform: uppercase; letter-spacing: 0.1em;
  font-weight: 600;
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px;
}
.cp-chip-v {
  color: var(--cp-text);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cp-chip--violet {
  background: linear-gradient(180deg, rgba(58,40,110,0.85) 0%, rgba(30,20,60,0.85) 100%);
  border-color: rgba(167, 139, 250, 0.36);
  box-shadow: 0 14px 38px -12px rgba(139, 92, 246, 0.4);
  animation: cp-chip-float 7s ease-in-out infinite,
             cp-chip-pulse-violet 5s ease-in-out infinite;
  overflow: hidden;
}
.cp-chip--violet .cp-chip-k { color: var(--cp-violet); }
.cp-chip--violet .cp-chip-v { color: #fff; }
.cp-chip--violet::after {
  content: "";
  position: absolute;
  left: -30%; top: 0; bottom: 0;
  width: 30%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
  animation: cp-scanline-x 6s linear infinite;
  pointer-events: none;
}
@keyframes cp-chip-pulse-violet {
  0%, 100% { box-shadow: 0 14px 38px -12px rgba(139, 92, 246, 0.35), 0 0 0 0 rgba(167, 139, 250, 0); }
  50%      { box-shadow: 0 18px 48px -10px rgba(139, 92, 246, 0.55), 0 0 0 4px rgba(167, 139, 250, 0.12); }
}
@keyframes cp-scanline-x {
  0%   { transform: translateX(0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(620%); opacity: 0; }
}
.cp-chip-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--cp-violet);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.3);
  animation: cp-throb-violet 2s ease-in-out infinite;
}
@media (max-width: 1024px) {
  .cp-chip:nth-child(3), .cp-chip:nth-child(4) { display: none; }
}
@media (max-width: 540px) {
  .cp-chip { font-size: 10px; padding: 5px 9px; }
}

/* ============== APPLY-FLOW SURFACES ============== */
.cp-apply-main {
  position: relative; z-index: 1;
  padding: 56px 0 96px;
  background: var(--cp-bg);
  overflow: hidden;
}
.cp-apply-main > .cp-ambient-grid,
.cp-apply-main > .cp-ambient-glow { z-index: 0; }
.cp-apply-container {
  /* Tighter on desktop so the offers + form columns don't sprawl. */
  max-width: 640px; margin: 0 auto; padding: 0 24px;
  position: relative; z-index: 1;
}
.cp-apply-footer {
  position: relative; z-index: 1;
  background: linear-gradient(180deg, rgba(16,16,35,0.7) 0%, var(--cp-bg) 100%);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--cp-hairline);
  padding: 22px 0;
  margin-top: 0;
}
.cp-ecoa {
  max-width: 1240px; margin: 0 auto; padding: 0 32px;
  font-size: 11px; line-height: 1.6; color: var(--cp-muted);
}

/* Step container — same dark glass as landing's compare card */
.cp-step {
  position: relative;
  border-radius: 22px;
  padding: 32px 28px;
}
.cp-step-glass {
  background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
  border: 1px solid var(--cp-hairline-2);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 30px 80px -28px rgba(0, 0, 0, 0.6);
}
.cp-step-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--cp-violet);
  padding: 5px 12px; border-radius: 999px;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.24);
  text-transform: uppercase;
}
.cp-step-body {
  margin-top: 14px;
  font-size: 14.5px; line-height: 1.6; color: var(--cp-text-2);
}
.cp-step-actions {
  margin-top: 28px;
  display: flex; gap: 10px; flex-wrap: wrap;
}

/* Disclaimer step */
.cp-consent-box {
  margin-top: 22px;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(167, 139, 250, 0.06);
  border: 1px solid rgba(167, 139, 250, 0.18);
}
.cp-consent-text {
  font-size: 13.5px; line-height: 1.65; color: var(--cp-text-2);
}
.cp-consent-toggle {
  margin-top: 18px;
  display: flex; gap: 12px; align-items: flex-start;
  font-size: 13.5px; line-height: 1.55; color: var(--cp-text-2);
  cursor: pointer;
}
.cp-consent-toggle input {
  margin-top: 3px;
  width: 18px; height: 18px;
  accent-color: var(--cp-violet);
}

/* Form */
.cp-form {
  margin-top: 24px;
  display: grid; gap: 16px;
}
.cp-form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
@media (max-width: 540px) {
  .cp-form-row { grid-template-columns: 1fr; }
}
.cp-form label {
  display: grid; gap: 6px;
}
.cp-form-label {
  font-size: 11px; letter-spacing: 0.10em; font-weight: 600;
  text-transform: uppercase;
  color: var(--cp-muted);
}
.cp-form input {
  font-family: inherit;
  height: 48px;
  border-radius: 12px;
  border: 1px solid var(--cp-hairline-2);
  background: rgba(255, 255, 255, 0.03);
  padding: 0 16px;
  font-size: 15px;
  color: var(--cp-text);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.cp-form input::placeholder { color: var(--cp-faded); }
.cp-form input:focus {
  outline: none;
  border-color: var(--cp-violet);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.18);
}
.cp-form-helper {
  font-size: 11px; color: var(--cp-muted);
  margin-top: 2px;
}
.cp-form-submit { margin-top: 8px; width: 100%; }
.cp-form-error {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.32);
  font-size: 13px; color: #fca5a5;
}

/* Engine step */
.cp-engine .cp-apply-h2 { margin-top: 18px; }
.cp-engine-bar { margin-top: 22px; }
.cp-engine-bar-track {
  height: 6px; border-radius: 999px;
  background: rgba(167, 139, 250, 0.10);
  overflow: hidden; position: relative;
  border: 1px solid var(--cp-hairline);
}
.cp-engine-bar-fill {
  height: 100%; width: 80%;
  background: linear-gradient(90deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  border-radius: 999px;
  animation: cp-engine-fill 4s ease-in-out infinite;
  box-shadow: 0 0 12px rgba(167, 139, 250, 0.55);
}
@keyframes cp-engine-fill {
  0%, 100% { width: 80%; }
  50%      { width: 96%; }
}
.cp-engine-stages {
  margin-top: 24px;
  display: grid; gap: 10px;
  list-style: none; padding: 0;
}
.cp-engine-stages li {
  display: flex; align-items: center; gap: 12px;
  font-size: 13.5px; color: var(--cp-muted);
  transition: color .25s ease, opacity .25s ease;
  opacity: 0.6;
}
.cp-engine-stages li.on { color: var(--cp-text); opacity: 1; }
.cp-engine-tick {
  width: 22px; height: 22px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--cp-hairline-2);
  color: var(--cp-muted);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.cp-engine-tick.on {
  background: linear-gradient(180deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 6px 16px -4px rgba(139, 92, 246, 0.55);
}

/* Offers screen */
.cp-offers { display: grid; gap: 18px; }
.cp-offers-head {
  text-align: center;
  padding: 0 8px 8px;
}
.cp-offers-head .cp-step-tag { margin: 0 auto; }
.cp-offers-head .cp-apply-h2 { margin-top: 18px; }
.cp-offers-head .cp-step-body { max-width: 540px; margin-left: auto; margin-right: auto; }
.cp-offers-meta {
  margin-top: 14px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 600;
  text-transform: uppercase;
  color: var(--cp-muted);
}

/* Offer cards on the offers screen (hero + secondary). Same gradient
   panel + violet stamp as the landing hero card and
   fin-offer best card. */
.cp-apply-offer-card {
  position: relative;
  background: linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
  border: 1px solid var(--cp-hairline-2);
  border-radius: 22px;
  padding: 24px;
  box-shadow:
    0 30px 80px -30px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255,255,255,0.04);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.cp-apply-offer-card-hero {
  transform: perspective(1400px) rotateX(1.5deg);
  transition: transform 0.45s cubic-bezier(0.2,0.7,0.2,1), box-shadow 0.4s ease;
  background:
    linear-gradient(180deg, rgba(167, 139, 250, 0.10) 0%, rgba(139, 92, 246, 0.04) 100%),
    linear-gradient(180deg, rgba(35,35,63,0.7) 0%, rgba(16,16,35,0.7) 100%);
  border-color: rgba(167, 139, 250, 0.32);
  box-shadow:
    0 36px 90px -28px rgba(139, 92, 246, 0.45),
    0 12px 32px -10px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255,255,255,0.06);
}
.cp-apply-offer-card-hero:hover {
  transform: perspective(1400px) rotateX(0deg) translateY(-4px);
  box-shadow:
    0 50px 110px -28px rgba(139, 92, 246, 0.55),
    0 24px 60px -12px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255,255,255,0.08);
}

.cp-offer-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--cp-violet);
  padding: 5px 10px; border-radius: 999px;
  background: rgba(167, 139, 250, 0.10);
  border: 1px solid rgba(167, 139, 250, 0.28);
  text-transform: uppercase;
}
.cp-offer-tag-recommended {
  background: linear-gradient(180deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 16px -4px rgba(139, 92, 246, 0.55);
}
.cp-offer-id {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 500;
  color: var(--cp-muted);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.cp-term-row {
  margin-top: 18px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.cp-term-label {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  text-transform: uppercase; color: var(--cp-muted);
}
.cp-term-toggle {
  display: inline-flex; padding: 4px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--cp-hairline);
  gap: 4px;
}
.cp-term-toggle button {
  border: none; background: transparent;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px; font-weight: 600;
  color: var(--cp-muted);
  transition: background .15s ease, color .15s ease;
  font-family: inherit;
  cursor: pointer;
}
.cp-term-toggle button.on {
  background: linear-gradient(180deg, var(--cp-violet) 0%, var(--cp-violet-dd) 100%);
  color: #fff;
  box-shadow: 0 4px 12px -4px rgba(139, 92, 246, 0.5);
}

.cp-offers-more { margin-top: 8px; }
.cp-offers-toggle {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--cp-hairline-2);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--cp-violet);
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
  font-family: inherit;
}
.cp-offers-toggle:hover {
  border-color: rgba(167, 139, 250, 0.36);
  background: rgba(167, 139, 250, 0.04);
}
.cp-offers-chevron { transition: transform .2s ease; display: inline-block; }
.cp-offers-chevron.open { transform: rotate(180deg); }
.cp-offers-list {
  margin-top: 14px; padding: 0; list-style: none;
  display: grid; gap: 12px;
}
.cp-apply-offer-card-secondary {
  padding: 18px;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.cp-apply-offer-card-secondary:hover {
  transform: translateY(-3px);
  box-shadow:
    0 30px 70px -25px rgba(139, 92, 246, 0.32),
    0 8px 20px -8px rgba(0, 0, 0, 0.5);
  border-color: rgba(167, 139, 250, 0.28);
}
.cp-apply-offer-card-secondary.is-chosen {
  border-color: var(--cp-violet);
  box-shadow:
    0 30px 70px -25px rgba(139, 92, 246, 0.45),
    0 8px 20px -8px rgba(0, 0, 0, 0.55);
}

/* ============== RESPONSIVE ============== */
@media (max-width: 960px) {
  .cp-apply-hero-grid { grid-template-columns: 1fr; }
  .cp-apply-hero-right { min-height: 540px; }
  .cp-apply-hero-strip { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 540px) {
  .cp-step { padding: 24px 20px; }
  .cp-card-amount-n { font-size: 40px; }
  .cp-apply-hero-card { padding: 18px; }
}

/* ============== PREFERS-REDUCED-MOTION ============== */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  .cp-apply-hero-card,
  .cp-chip,
  .cp-chip--violet,
  .cp-hero-ring,
  .cp-eyebrow-dot,
  .cp-card-blip,
  .cp-apply-strip-live-dot,
  .cp-engine-bar-fill {
    animation: none !important;
  }
  .cp-apply-hero-stage:hover .cp-apply-hero-card,
  .cp-apply-offer-card-secondary:hover,
  .cp-apply-offer-card-hero:hover {
    transform: none !important;
  }
  .cp-chip--violet::after { display: none !important; }
}

/* ============== STEP BACK BUTTON ============== */
.cp-step-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(124, 58, 237, 0.08);
  color: #e9d5ff;
  border: 1px solid rgba(124, 58, 237, 0.22);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: background 160ms ease, transform 160ms ease;
  min-height: 36px;
}
.cp-step-back:hover { background: rgba(124, 58, 237, 0.16); }
.cp-step-back:active { transform: translateY(1px); }

/* ============== HOW IT WORKS ============== */
.cp-how {
  margin-top: 96px;
  padding-top: 24px;
  scroll-margin-top: 80px;
  position: relative;
  z-index: 1;
}
.cp-how-eyebrow,
.cp-calc-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(124, 58, 237, 0.1);
  border: 1px solid rgba(124, 58, 237, 0.22);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #e9d5ff;
  text-transform: uppercase;
}
.cp-how-title,
.cp-calc-title { margin: 16px 0 28px; letter-spacing: -0.025em; }
.cp-how-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.cp-how-step { padding: 22px 20px; border-radius: 18px; position: relative; }
.cp-how-step-n {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  font-weight: 700;
  color: #c4b5fd;
  letter-spacing: 0.08em;
}
.cp-how-step-title {
  margin-top: 10px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f5f3ff;
}
.cp-how-step-body {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: rgba(245, 243, 255, 0.72);
}

/* ============== CALCULATOR ============== */
.cp-calc {
  margin-top: 64px;
  padding-bottom: 96px;
  position: relative;
  z-index: 1;
}
.cp-calc-card { padding: 28px; border-radius: 22px; max-width: 760px; }
.cp-calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.cp-calc-field { display: flex; flex-direction: column; gap: 10px; }
.cp-calc-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(245, 243, 255, 0.6);
  font-weight: 700;
}
.cp-calc-label strong {
  font-size: 18px;
  letter-spacing: -0.02em;
  color: #f5f3ff;
  text-transform: none;
  font-feature-settings: 'tnum';
}
.cp-calc-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #7c3aed, #c4b5fd);
  outline: none;
  margin: 6px 0;
}
.cp-calc-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #f5f3ff;
  border: 2px solid #7c3aed;
  box-shadow: 0 4px 10px rgba(124, 58, 237, 0.4);
  cursor: pointer;
}
.cp-calc-range::-moz-range-thumb {
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #f5f3ff;
  border: 2px solid #7c3aed;
  box-shadow: 0 4px 10px rgba(124, 58, 237, 0.4);
  cursor: pointer;
}
.cp-calc-range-foot {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(245, 243, 255, 0.55);
  font-weight: 600;
}
.cp-calc-terms { display: flex; flex-wrap: wrap; gap: 8px; }
.cp-calc-term {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.22);
  color: #f5f3ff;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 160ms ease;
  min-width: 56px;
  min-height: 40px;
}
.cp-calc-term:hover { background: rgba(124, 58, 237, 0.16); }
.cp-calc-term.is-active {
  background: linear-gradient(135deg, #7c3aed, #a78bfa);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 14px rgba(124, 58, 237, 0.4);
}

/* Credit-tier dropdown — single native select for fast tier picking.
   Wraps the native control so we can paint our own caret + glass
   surface; the underlying <select> stays accessible + keyboard
   navigable + uses iOS's native picker on mobile. */
.cp-calc-tier-field {
  grid-column: 1 / -1;
  margin-top: 18px;
}
.cp-calc-field--full { grid-column: 1 / -1; }
.cp-calc-select-wrap {
  position: relative;
  display: block;
}
.cp-calc-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  padding: 14px 40px 14px 14px;
  border-radius: 12px;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.22);
  color: #f5f3ff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 160ms ease;
  min-height: 52px;
  font-variant-numeric: tabular-nums;
}
.cp-calc-select:hover { background: rgba(124, 58, 237, 0.14); }
.cp-calc-select:focus {
  outline: none;
  border-color: rgba(124, 58, 237, 0.55);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
}
.cp-calc-select option {
  background: #1c1530;
  color: #f5f3ff;
}
.cp-calc-select-caret {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4b5fd;
  pointer-events: none;
}

.cp-calc-result {
  margin-top: 24px;
  padding: 20px 22px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(196, 181, 253, 0.1));
  border: 1px solid rgba(124, 58, 237, 0.22);
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  align-items: center;
}
.cp-calc-result-k {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(245, 243, 255, 0.6);
  font-weight: 700;
}
.cp-calc-result-v {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #f5f3ff;
  line-height: 1;
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.cp-calc-result-unit {
  font-size: 16px;
  color: rgba(245, 243, 255, 0.6);
  font-weight: 600;
  margin-left: 2px;
}
.cp-calc-result-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.cp-calc-result-vs {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f5f3ff;
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.cp-calc-cta { margin-top: 18px; }
.cp-calc-disc {
  margin-top: 12px;
  font-size: 11.5px;
  color: rgba(245, 243, 255, 0.55);
  line-height: 1.55;
}

/* ============== RESPONSIVE — HOW / CALC ============== */
@media (max-width: 960px) {
  .cp-how-grid { grid-template-columns: repeat(2, 1fr); }
  .cp-calc-grid { grid-template-columns: 1fr; }
  .cp-calc-result { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  .cp-how { margin-top: 72px; }
  .cp-how-grid { grid-template-columns: 1fr; gap: 12px; }
  .cp-how-step { padding: 18px 16px; }
  .cp-calc-card { padding: 22px 18px; }
  .cp-calc-result { padding: 16px 18px; }
  .cp-calc-result-v { font-size: 32px; }
  .cp-calc-result-side { grid-template-columns: 1fr 1fr; }
  .cp-apply-container { padding: 0 18px !important; }
  /* keep inputs touch-target sized */
  .cp-form input { min-height: 48px; font-size: 16px; }
}

/* ============== VIEWPORT LOCK (no horizontal shake) ============== */
html, body { overflow-x: hidden; width: 100%; max-width: 100%; }
.coachpay-root, .coachpay-root * { max-width: 100%; }
.coachpay-root img, .coachpay-root svg { max-width: 100%; height: auto; }
.cp-apply-footer { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
`;
