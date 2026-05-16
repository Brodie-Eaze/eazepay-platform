'use client';

/**
 * Dedicated MedPay consumer apply page.
 *
 * Why a static route instead of the dynamic /apply/[brand] page?
 * Because the brief is "make it visually identical to /landing/medpay
 * end-to-end." That requires the same design system (CSS variables,
 * keyframes, glass-teal cards, gradient buttons, 3D offer card,
 * floating chips) applied to every step of the apply flow. Trying to
 * over-layer those onto the multi-brand dynamic page risks bleeding
 * styles into the TradePay and CoachPay apply flows. A dedicated
 * route is the cleanest isolation.
 *
 * Next.js App Router serves the static segment over the dynamic
 * one, so this file owns /apply/medpay and the dynamic [brand]
 * route handles tradepay / coachpay.
 *
 * Compliance (FCRA soft-pull consent, ECOA / Reg B footer, session
 * fingerprint binding, idle timeout, replaceState back-prevention,
 * masked SSN inputs, in-flight throttle) is preserved 1:1 from the
 * Wave 2C hardening — same imports as the dynamic page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  HeartPulseIcon,
  ChartIcon,
  PhoneIcon,
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
function filterLenders({ partnerId, tier, amountCents }: FilterArgs): MarketplaceLenderRow[] {
  return marketplaceLenders.filter((l) => {
    if (l.brands.length > 0 && !l.brands.includes('medpay')) return false;
    if (!l.servesTiers.includes(tier)) return false;
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
  });
}

export default function MedPayApplyPage() {
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

  // Reset scroll + focus to top whenever the step changes so consumers
  // always land at the top of the new step on mobile (no mid-page jumps).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    // Disable Safari's auto-restoration so iOS back-gestures don't reapply
    // a stale scroll position on the step swap.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, [step]);

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
      amt < 1_500_00 ||
      amt > 50_000_00
    ) {
      setError(
        'Please fill every field. Phone must be 10 digits and amount between $1,500 and $50,000.',
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
    <div className="medpay-root">
      <style dangerouslySetInnerHTML={{ __html: MEDPAY_APPLY_CSS }} />
      <ConsumerIdleGuard onExpire={handleIdleExpire} />

      {/* ============== NAV ============== */}
      <nav className="mp-nav">
        <div className="mp-nav-inner">
          <a href="#" className="mp-brand">
            <span className="mp-brand-mark">
              <HeartPulseIcon size={16} className="text-white" />
            </span>
            <span className="mp-brand-word">
              MedPay <span className="mp-brand-sub">· Patient Financing</span>
            </span>
          </a>
          <div className="mp-nav-cta">
            {step !== 'landing' && (
              <button
                type="button"
                className="btn-ghost-teal"
                onClick={() => setStep('landing')}
                data-mp-ghost
              >
                Restart
              </button>
            )}
            {step === 'landing' && (
              <button
                type="button"
                className="btn-primary-teal"
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
        <main className="mp-apply-main">
          <div className="mp-apply-container">
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
              <p className="mp-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </main>
      )}

      {/* ============== FOOTER (ECOA / Reg B) ============== */}
      <footer className="mp-apply-footer">
        <div className="mp-apply-container">
          <p className="mp-ecoa">{ECOA_FOOTER_NOTICE}</p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LANDING STEP — mirrors /landing/medpay hero shape (eyebrow pill, big
// gradient headline, CTAs, hero stats strip, and an offer-card mockup
// on the right with floating contextual chips).
// ─────────────────────────────────────────────────────────────────────
function LandingStep({ onApply }: { onApply: () => void }) {
  return (
    <section className="mp-hero">
      <div className="ambient-mesh" />
      <div className="ambient-grid-teal" />
      <div className="mp-container">
        <div className="mp-hero-grid">
          <div>
            <span className="mp-eyebrow-pill">
              <span className="mp-pulse-dot" />
              SOFT PULL · ZERO IMPACT TO YOUR SCORE
            </span>
            <h1 className="mp-h1">
              <span className="grad-teal">Patient financing for</span>
              <br />
              <span className="grad-teal-deep">the care you deserve.</span>
            </h1>
            <p className="mp-hero-sub">
              From dental implants to fertility treatments to med-spa care.{' '}
              <strong>Pre-qualify in 60 seconds.</strong> Soft credit check only. Terms from 24 to
              84 months. APR from 6.9%. Plans generally settle within 48 to 72 hours.
            </p>
            <div className="mp-hero-ctas">
              <button type="button" className="btn-primary-teal lg" onClick={onApply}>
                Check my rate
                <ArrowRightIcon size={14} />
              </button>
              <a href="#how" className="btn-ghost-teal lg">
                How it works
              </a>
            </div>
            <div className="mp-hero-strip">
              <div>
                <div className="strip-val">
                  60<span className="strip-unit">sec</span>
                </div>
                <div className="strip-label">
                  <span className="strip-live">
                    <span className="strip-live-dot" />
                    LIVE
                  </span>
                  Pre-qualification
                </div>
              </div>
              <div>
                <div className="strip-val">52</div>
                <div className="strip-label">Lenders parallel</div>
              </div>
              <div>
                <div className="strip-val">
                  6.9<span className="strip-unit">%</span>
                </div>
                <div className="strip-label">APR from</div>
              </div>
              <div>
                <div className="strip-val">
                  0<span className="strip-unit">%</span>
                </div>
                <div className="strip-label">Credit impact</div>
              </div>
            </div>
          </div>

          <div className="mp-hero-right">
            <div className="mp-hero-stage">
              <div className="mp-halo" />
              <div className="mp-pixel-grid">
                {Array.from({ length: 192 }).map((_, i) => (
                  <div
                    key={i}
                    className={`px ${i % 7 === 0 ? 'fired' : ''}`}
                    style={{ animationDelay: `${(i % 11) * 0.2}s` }}
                  />
                ))}
              </div>

              <div className="mp-offer-card glass-teal-hi">
                <div className="mp-offer-head">
                  <div className="mp-offer-tag">
                    <span className="mp-pulse-dot" />
                    PRE-QUALIFIED
                  </div>
                  <div className="mp-offer-id">SAMPLE OFFER</div>
                </div>
                <div className="mp-offer-title">Dental implants · approved</div>
                <div className="mp-offer-amount">
                  $12,000
                  <span className="mp-offer-amount-sub">approved</span>
                </div>
                <div className="mp-offer-row">
                  <div>
                    <div className="mp-offer-row-k">Est. monthly</div>
                    <div className="mp-offer-row-v">
                      $250<span className="dim"> · 48 mo</span>
                    </div>
                  </div>
                  <div>
                    <div className="mp-offer-row-k">APR</div>
                    <div className="mp-offer-row-v">6.9%</div>
                  </div>
                  <div>
                    <div className="mp-offer-row-k">Lender</div>
                    <div className="mp-offer-row-v sm">Cross River Bank</div>
                  </div>
                </div>
                <div className="mp-offer-bar">
                  <div className="mp-offer-bar-track">
                    <div className="mp-offer-bar-fill" />
                  </div>
                  <div className="mp-offer-bar-stages">
                    <span className="on">Prequal</span>
                    <span className="on">Quote</span>
                    <span className="on">Offer</span>
                    <span className="on">Accept</span>
                    <span className="cur">Payout</span>
                  </div>
                </div>
                <button className="mp-offer-cta" type="button" onClick={onApply}>
                  Start my application
                  <ArrowRightIcon size={14} />
                </button>
                <div className="mp-offer-foot">
                  <span>
                    <ShieldIcon size={11} /> Soft pull · 0 credit impact
                  </span>
                  <span>
                    <BoltIcon size={11} /> Lender pays your provider direct
                  </span>
                </div>
              </div>

              {/* Floating chips around the offer card (matches landing). */}
              <div className="mp-chip" style={{ top: '-4%', left: '-2%', animationDelay: '0s' }}>
                <span className="mp-chip-k">FCRA</span>
                <span className="mp-chip-v">soft pull · 0 impact</span>
              </div>
              <div className="mp-chip" style={{ top: '-4%', right: '-2%', animationDelay: '0.6s' }}>
                <span className="mp-chip-k">DECISION</span>
                <span className="mp-chip-v">instant · multi-offer</span>
              </div>
              <div
                className="mp-chip"
                style={{ bottom: '-4%', left: '-2%', animationDelay: '1.2s' }}
              >
                <span className="mp-chip-k">PAYOUT</span>
                <span className="mp-chip-v">provider-direct · 48-72hr</span>
              </div>
              <div
                className="mp-chip"
                style={{ bottom: '-4%', right: '-2%', animationDelay: '1.8s' }}
              >
                <span className="mp-chip-k">PROMO</span>
                <span className="mp-chip-v">0% interest plans · T&Cs</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============== HOW IT WORKS ============== */}
        <section id="how" className="mp-how">
          <div className="mp-how-eyebrow">
            <span className="mp-pulse-dot" />
            HOW IT WORKS · 4 STEPS
          </div>
          <h2 className="mp-h2 mp-how-title">
            <span className="grad-teal">From in-chair to funded</span>
            <br />
            <span className="grad-teal-deep">in under 72 hours.</span>
          </h2>
          <div className="mp-how-grid">
            {[
              {
                n: '01',
                title: 'Apply in seconds',
                body: 'Soft credit pull only — zero impact to your score. Takes about 60 seconds in the chair, on your phone, or from home.',
              },
              {
                n: '02',
                title: 'We match you',
                body: '52 medical lenders quoted in parallel. Pre-qualified offers ranked by lowest total cost.',
              },
              {
                n: '03',
                title: 'You pick the plan',
                body: 'Compare APR, term, and monthly payment side-by-side. Plans from 24 to 84 months. APR from 6.9%.',
              },
              {
                n: '04',
                title: 'Provider paid direct',
                body: 'Once you accept, the lender pays your dental or medical provider directly — typically within 48 to 72 hours.',
              },
            ].map((s) => (
              <div key={s.n} className="mp-how-step glass-teal-hi">
                <div className="mp-how-step-n">{s.n}</div>
                <div className="mp-how-step-title">{s.title}</div>
                <p className="mp-how-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============== CALCULATOR ============== */}
        <section className="mp-calc">
          <div className="mp-calc-eyebrow">
            <span className="mp-pulse-dot" />
            PAYMENT ESTIMATOR · ILLUSTRATIVE ONLY
          </div>
          <h2 className="mp-h2 mp-calc-title">
            <span className="grad-teal">What might my</span>
            <br />
            <span className="grad-teal-deep">monthly payment look like?</span>
          </h2>
          <MedPayCalculator onApply={onApply} />
        </section>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MedPay payment estimator. Amortization across a real-world APR ramp
// tied to credit tier — Excellent → Building. Disclosed as illustrative
// so a practice demoing the calc in-chair doesn't set false
// expectations against a patient whose real pre-qual lands in a
// higher tier.
// ─────────────────────────────────────────────────────────────────────
const MP_TIERS = [
  { key: 'excellent', label: 'Excellent', sub: '720+ FICO', apr: 0.059 },
  { key: 'good', label: 'Good', sub: '660–719', apr: 0.099 },
  { key: 'fair', label: 'Fair', sub: '600–659', apr: 0.149 },
  { key: 'building', label: 'Building', sub: 'under 600', apr: 0.199 },
] as const;
type MpTier = (typeof MP_TIERS)[number]['key'];

function MedPayCalculator({ onApply }: { onApply: () => void }) {
  const [amount, setAmount] = useState(12000);
  const [term, setTerm] = useState<12 | 24 | 36 | 48 | 60>(48);
  const [tier, setTier] = useState<MpTier>('good');
  const activeTier = MP_TIERS.find((t) => t.key === tier)!;
  const APR = activeTier.apr;
  const r = APR / 12;
  const monthly = Math.round((amount * r) / (1 - Math.pow(1 + r, -term)));
  const totalPaid = monthly * term;
  const totalInterest = Math.max(0, totalPaid - amount);

  return (
    <div className="mp-calc-card glass-teal-hi">
      <div className="mp-calc-grid">
        <div className="mp-calc-field">
          <div className="mp-calc-label">
            <span>Amount</span>
            <strong>${amount.toLocaleString('en-US')}</strong>
          </div>
          <input
            type="range"
            min={1500}
            max={50000}
            step={500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mp-calc-range"
            aria-label="Amount needed in USD"
          />
          <div className="mp-calc-range-foot">
            <span>$1.5k</span>
            <span>$50k</span>
          </div>
        </div>

        <div className="mp-calc-field">
          <div className="mp-calc-label">
            <span>Term</span>
            <strong>{term} months</strong>
          </div>
          <div className="mp-calc-terms">
            {([12, 24, 36, 48, 60] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`mp-calc-term ${t === term ? 'is-active' : ''}`}
                onClick={() => setTerm(t)}
                aria-pressed={t === term}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mp-calc-field mp-calc-field--full mp-calc-tier-field">
        <div className="mp-calc-label">
          <span>Credit profile</span>
          <strong>
            {activeTier.label} · from {(APR * 100).toFixed(1)}%
          </strong>
        </div>
        <div className="mp-calc-tier-row" role="radiogroup" aria-label="Credit profile">
          {MP_TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={t.key === tier}
              className={`mp-calc-tier ${t.key === tier ? 'is-active' : ''}`}
              onClick={() => setTier(t.key)}
            >
              <span className="mp-calc-tier-label">{t.label}</span>
              <span className="mp-calc-tier-sub">
                {t.sub} · {(t.apr * 100).toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mp-calc-result">
        <div className="mp-calc-result-main">
          <div className="mp-calc-result-k">Est. monthly</div>
          <div className="mp-calc-result-v">
            ${monthly.toLocaleString('en-US')}
            <span className="mp-calc-result-unit"> / mo</span>
          </div>
        </div>
        <div className="mp-calc-result-side">
          <div>
            <div className="mp-calc-result-k">APR · {activeTier.label.toLowerCase()}</div>
            <div className="mp-calc-result-vs">{(APR * 100).toFixed(1)}%</div>
          </div>
          <div>
            <div className="mp-calc-result-k">Total interest</div>
            <div className="mp-calc-result-vs">${totalInterest.toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>

      <button type="button" className="btn-primary-teal lg full mp-calc-cta" onClick={onApply}>
        Check my real rate
        <ArrowRightIcon size={14} />
      </button>
      <p className="mp-calc-disc">
        Illustrative — based on a representative {activeTier.label.toLowerCase()} credit profile (
        {activeTier.sub}). Soft pull only; your actual APR, term, and monthly payment are set by
        your pre-qualified offers.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DISCLAIMER STEP — FCRA soft-pull consent. Verbatim language, glass
// card, gradient CTA.
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
    <div className="mp-step glass-teal-hi">
      <div className="mp-step-tag">01 · CONSENT</div>
      <h2 className="mp-h2">
        <span className="grad-teal">Quick consent.</span>
        <br />
        <span className="grad-teal-deep">No impact to your credit score.</span>
      </h2>
      <p className="mp-step-body">
        Before we match you with lenders, federal law requires you to authorize a soft credit
        inquiry. Your score is not affected.
      </p>

      <div className="mp-consent-box">
        <p className="mp-consent-text">{SOFT_PULL_CONSENT_TEXT}</p>
      </div>

      <label className="mp-consent-toggle">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I authorize a soft credit pull and have read the Privacy Policy and E-Sign Disclosure.
        </span>
      </label>

      <div className="mp-step-actions">
        <button type="button" className="btn-ghost-teal lg" onClick={onBack} data-mp-ghost>
          Back
        </button>
        <button
          type="button"
          className="btn-primary-teal lg"
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
// INTAKE STEP — 5-field minimal pre-qual form. Glass card, gradient CTA.
// PII fields use autoComplete=new-password / off so browser-restore
// doesn't auto-populate them on a public/shared device.
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
    <div className="mp-step glass-teal-hi">
      <button type="button" className="mp-step-back" onClick={onBack} aria-label="Back to consent">
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="mp-step-tag">02 · YOUR DETAILS</div>
      <h2 className="mp-h2">
        <span className="grad-teal">Let&apos;s match you with</span>
        <br />
        <span className="grad-teal-deep">the right plan.</span>
      </h2>
      <p className="mp-step-body">
        Soft credit inquiry only. Your details stay private and encrypted.
      </p>

      <form
        className="mp-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="mp-form-row">
          <label>
            <span className="mp-form-label">First name</span>
            <input
              type="text"
              value={intake.firstName}
              onChange={(e) => setIntake({ ...intake, firstName: e.target.value })}
              required
              autoComplete="off"
            />
          </label>
          <label>
            <span className="mp-form-label">Last name</span>
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
          <span className="mp-form-label">Email</span>
          <input
            type="email"
            value={intake.email}
            onChange={(e) => setIntake({ ...intake, email: e.target.value })}
            required
            autoComplete="off"
          />
        </label>
        <label>
          <span className="mp-form-label">Mobile phone</span>
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
          <span className="mp-form-label">Amount needed (USD)</span>
          <input
            type="text"
            inputMode="numeric"
            value={intake.amount}
            onChange={(e) => setIntake({ ...intake, amount: e.target.value })}
            required
            autoComplete="off"
            placeholder="12000"
          />
          <span className="mp-form-helper">Most patients borrow between $1,500 and $25,000.</span>
        </label>

        <button type="submit" className="btn-primary-teal lg full mp-form-submit">
          See my offers
          <ArrowRightIcon size={14} />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ENGINE STEP — animated "checking with 52 lenders" loading screen.
// Pulse dot + progress bar fill animation lifted from landing.
// ─────────────────────────────────────────────────────────────────────
function EngineStep() {
  const stages = [
    'Soft credit pull · FCRA permissible purpose',
    'Affordability check · debt-to-income ratio',
    'Routing decision · brand + tier match',
    'Quoting 52 lenders in parallel',
    'Ranking by lowest total cost',
  ];
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => Math.min(i + 1, stages.length - 1)), 600);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <div className="mp-step glass-teal-hi mp-engine">
      <div className="mp-step-tag">
        <span className="mp-pulse-dot" />
        LIVE
      </div>
      <h2 className="mp-h2">
        <span className="grad-teal">Matching you with</span>
        <br />
        <span className="grad-teal-deep">52 lenders in parallel.</span>
      </h2>

      <div className="mp-offer-bar mp-engine-bar">
        <div className="mp-offer-bar-track">
          <div className="mp-offer-bar-fill" />
        </div>
      </div>

      <ul className="mp-engine-stages">
        {stages.map((s, i) => (
          <li key={s} className={i <= activeIdx ? 'on' : ''}>
            <span className={i <= activeIdx ? 'mp-engine-tick on' : 'mp-engine-tick'}>
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
// cards. Same 3D depth, gradient fill, and floating-pill treatment as
// the landing hero offer card.
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
  const effectiveAmount = amountCents > 0 ? amountCents : 12_000_00;
  const [term, setTerm] = useState<36 | 48 | 60>(48);
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
      <div className="mp-step glass-teal-hi">
        <div className="mp-step-tag">NO MATCHES</div>
        <h2 className="mp-h2">
          <span className="grad-teal">No matches right now.</span>
        </h2>
        <p className="mp-step-body">
          Your referring partner has no lenders enabled for this credit tier. Reach out to them or
          try a different procedure amount.
        </p>
      </div>
    );
  }

  const top = lenders[0]!;
  const rest = lenders.slice(1);
  const likelihoodFor = (idx: number) => Math.max(40, 80 - idx * 10);

  return (
    <div className="mp-offers">
      <button
        type="button"
        className="mp-step-back"
        onClick={onBack}
        aria-label="Back to your details"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="mp-offers-head">
        <div className="mp-step-tag">
          <span className="mp-pulse-dot" />
          OFFERS READY
        </div>
        <h2 className="mp-h2">
          <span className="grad-teal">You&apos;ve been matched!</span>
        </h2>
        <p className="mp-step-body">
          52 lenders quoted in parallel. Ranked by lowest total cost. Soft pull only — your credit
          score is unchanged.
        </p>
        <p className="mp-offers-meta">
          Expires in {mm}:{ss} · {tierLabel[tier]} · FICO {tierFico[tier]}
        </p>
      </div>

      {/* Recommended hero offer — same 3D + gradient as landing's hero card. */}
      <div className="mp-offer-card mp-offer-card-3d mp-offer-card-hero">
        <div className="mp-offer-head">
          <div className="mp-offer-tag mp-offer-tag-recommended">
            <BoltIcon size={11} /> AI RECOMMENDED
          </div>
          <div className="mp-offer-id">APPROVAL · 92%</div>
        </div>
        <div className="mp-offer-title">{top.displayName} · approved</div>
        <div className="mp-offer-amount">
          {fmt(effectiveAmount)}
          <span className="mp-offer-amount-sub">approved</span>
        </div>
        <div className="mp-offer-row">
          <div>
            <div className="mp-offer-row-k">Est. monthly</div>
            <div className="mp-offer-row-v">
              ${monthly.toLocaleString('en-US')}
              <span className="dim"> · {term} mo</span>
            </div>
          </div>
          <div>
            <div className="mp-offer-row-k">APR</div>
            <div className="mp-offer-row-v">6.9% – 8.9%</div>
          </div>
          <div>
            <div className="mp-offer-row-k">Lender</div>
            <div className="mp-offer-row-v sm">{top.displayName}</div>
          </div>
        </div>

        <div className="mp-term-row">
          <span className="mp-term-label">Term</span>
          <div className="mp-term-toggle">
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

        <button type="button" onClick={() => setChosen(top.id)} className="mp-offer-cta">
          Apply with {top.displayName}
          <ArrowRightIcon size={14} />
        </button>

        <div className="mp-offer-foot">
          <span>
            <ChartIcon size={11} /> Lowest total cost
          </span>
          <span>
            <ShieldIcon size={11} /> Best approval likelihood
          </span>
        </div>
      </div>

      {/* Secondary cards — glass-teal frosted, hover lift. */}
      {rest.length > 0 && (
        <div className="mp-offers-more">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mp-offers-toggle"
            data-mp-ghost
          >
            <span>Other available options ({rest.length})</span>
            <span className={'mp-offers-chevron ' + (showMore ? 'open' : '')}>▾</span>
          </button>
          {showMore && (
            <ul className="mp-offers-list">
              {rest.map((l, idx) => {
                const lk = likelihoodFor(idx);
                const fits =
                  amountCents === 0 ||
                  (amountCents >= l.minAmountCents && amountCents <= l.maxAmountCents);
                return (
                  <li
                    key={l.id}
                    className={
                      'mp-offer-card glass-teal mp-offer-card-secondary' +
                      (chosen === l.id ? ' is-chosen' : '')
                    }
                  >
                    <div className="mp-offer-head">
                      <div className="mp-offer-tag">{l.displayName}</div>
                      <div className="mp-offer-id">
                        {fits ? 'eligible' : 'amount outside envelope'}
                      </div>
                    </div>
                    <div className="mp-offer-row">
                      <div>
                        <div className="mp-offer-row-k">Approval</div>
                        <div className="mp-offer-row-v">{lk}%</div>
                      </div>
                      <div>
                        <div className="mp-offer-row-k">Range</div>
                        <div className="mp-offer-row-v sm">
                          {fmt(l.minAmountCents)} – {fmt(l.maxAmountCents)}
                        </div>
                      </div>
                      <div>
                        <div className="mp-offer-row-k">Term</div>
                        <div className="mp-offer-row-v sm">24 – 84 mo</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChosen(l.id)}
                      className="mp-offer-cta mp-offer-cta-ghost"
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
// CSS — lifted directly from /landing/medpay/page.tsx. Same tokens,
// same glass-teal cards, same gradient buttons, same 3D offer card,
// same pulse + chip-float keyframes. New rules at the bottom adapt
// the design system to apply-flow surfaces (forms, step containers,
// engine progress, ECOA footer).
// ─────────────────────────────────────────────────────────────────────
const MEDPAY_APPLY_CSS = `
:root {
  --mp-teal: #0E7C66;
  --mp-teal-2: #22B8A0;
  --mp-teal-light: #ECFFFE;
  --mp-deep: #062C29;
  --mp-ink: #0A1F1D;
  --mp-ink-2: #163936;
  --mp-mute: #4B6864;
  --mp-line: rgba(14, 124, 102, 0.12);
  --mp-line-strong: rgba(14, 124, 102, 0.22);
}

.medpay-root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: linear-gradient(180deg, #ECFFFE 0%, #FFFFFF 30%, #F3FBFA 65%, #FFFFFF 100%);
  color: var(--mp-ink);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
}
.medpay-root * { box-sizing: border-box; }
.medpay-root a { color: inherit; text-decoration: none; }
.medpay-root button { font-family: inherit; cursor: pointer; }

.mp-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  width: 100%;
  position: relative;
}

/* ============== AMBIENT BACKGROUNDS ============== */
.ambient-mesh {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 184, 160, 0.35), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 70%, rgba(14, 124, 102, 0.25), transparent 60%),
    radial-gradient(ellipse 50% 40% at 15% 60%, rgba(236, 255, 254, 0.6), transparent 60%);
  pointer-events: none;
}
.ambient-grid-teal {
  position: absolute; inset: 0; z-index: 0;
  background-image:
    linear-gradient(rgba(14, 124, 102, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 124, 102, 0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  pointer-events: none;
}

/* ============== GLASS ============== */
.glass-teal {
  background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(236,255,254,0.75) 100%);
  border: 1px solid var(--mp-line);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 20px 60px -20px rgba(14, 124, 102, 0.18);
}
.glass-teal-hi {
  background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,253,252,0.92) 100%);
  border: 1px solid var(--mp-line-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 30px 80px -30px rgba(14, 124, 102, 0.32);
}

/* ============== BUTTONS ============== */
.btn-primary-teal {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  color: #fff;
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  box-shadow:
    0 10px 30px -10px rgba(14, 124, 102, 0.55),
    inset 0 -2px 0 rgba(0,0,0,0.08),
    inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform .15s ease, box-shadow .15s ease;
  border: none;
}
.btn-primary-teal:hover { transform: translateY(-1px); box-shadow: 0 16px 40px -12px rgba(14,124,102,0.65); }
.btn-primary-teal:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary-teal.lg { padding: 14px 22px; font-size: 15px; border-radius: 14px; }
.btn-primary-teal.full { width: 100%; justify-content: center; }

.btn-ghost-teal {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--mp-teal);
  background: rgba(255,255,255,0.6);
  border: 1px solid var(--mp-line-strong);
  transition: border-color .15s ease, background .15s ease, transform .15s ease;
}
.btn-ghost-teal:hover { border-color: var(--mp-teal); background: rgba(255,255,255,0.9); transform: translateY(-1px); }
.btn-ghost-teal.lg { padding: 14px 22px; font-size: 15px; border-radius: 14px; }

/* ============== NAV ============== */
.mp-nav {
  position: sticky; top: 0; z-index: 50;
  padding: 16px 0;
}
.mp-nav-inner {
  max-width: 1280px; margin: 0 auto;
  padding: 12px 20px;
  background: linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(236,255,254,0.75) 100%);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--mp-line);
  border-radius: 18px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 20px 40px -20px rgba(14, 124, 102, 0.20);
  margin-left: 24px; margin-right: 24px;
}
.mp-brand { display: flex; align-items: center; gap: 10px; }
.mp-brand-mark {
  width: 32px; height: 32px; border-radius: 10px;
  background: linear-gradient(135deg, var(--mp-teal-2), var(--mp-teal));
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 20px -6px rgba(14,124,102,0.45);
}
.mp-brand-word { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; color: var(--mp-ink); }
.mp-brand-sub { color: var(--mp-mute); font-weight: 400; }
.mp-nav-cta { display: flex; align-items: center; gap: 8px; }
@media (max-width: 640px) {
  .mp-nav-inner { margin-left: 12px; margin-right: 12px; padding: 10px 12px; }
  .mp-brand-sub { display: none; }
}

/* ============== HERO ============== */
.mp-hero { position: relative; padding: 64px 0 64px; }
.mp-hero-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 48px;
  align-items: center;
  position: relative;
  z-index: 1;
}
.mp-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  color: var(--mp-teal);
  background: rgba(255,255,255,0.7);
  border: 1px solid var(--mp-line-strong);
  backdrop-filter: blur(8px);
}
.mp-pulse-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.18);
  animation: mpPulse 2s ease-in-out infinite;
  display: inline-block;
}
@keyframes mpPulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.18); }
  50% { box-shadow: 0 0 0 8px rgba(34, 184, 160, 0.06); }
}
.mp-h1 {
  margin-top: 20px;
  font-size: 64px;
  line-height: 1.04;
  letter-spacing: -0.025em;
  font-weight: 700;
}
.mp-h2 {
  font-size: 36px;
  line-height: 1.08;
  letter-spacing: -0.022em;
  font-weight: 700;
  margin-top: 14px;
}
.grad-teal {
  background: linear-gradient(180deg, var(--mp-ink) 0%, var(--mp-ink-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.grad-teal-deep {
  background: linear-gradient(180deg, var(--mp-teal) 0%, var(--mp-deep) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mp-hero-sub {
  margin-top: 18px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--mp-ink-2);
  max-width: 560px;
}
.mp-hero-sub strong { color: var(--mp-teal); font-weight: 700; }
.mp-hero-ctas {
  margin-top: 24px;
  display: flex; flex-wrap: wrap; gap: 10px;
}
.mp-hero-strip {
  margin-top: 28px;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--mp-line);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--mp-line);
}
.mp-hero-strip > div { background: rgba(255,255,255,0.85); padding: 12px 12px; }
.strip-val {
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--mp-ink);
}
.strip-unit { color: var(--mp-mute); font-size: 0.7em; margin-left: 2px; }
.strip-label {
  margin-top: 3px;
  font-size: 10px; letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--mp-mute);
  display: flex; align-items: center; gap: 8px;
}
.strip-live { display: inline-flex; align-items: center; gap: 4px; color: var(--mp-teal); }
.strip-live-dot {
  width: 5px; height: 5px; border-radius: 999px; background: var(--mp-teal-2);
  animation: mpPulse 1.4s ease-in-out infinite;
}

/* ============== HERO RIGHT (offer card + pixel grid + chips) ============== */
.mp-hero-right { position: relative; min-height: 580px; }
.mp-hero-stage { position: relative; height: 100%; min-height: 580px; }
.mp-halo {
  position: absolute;
  inset: 10% 5% 10% 5%;
  background:
    radial-gradient(ellipse at center, rgba(34, 184, 160, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 30% 70%, rgba(14, 124, 102, 0.18) 0%, transparent 60%);
  filter: blur(28px);
}
.mp-pixel-grid {
  position: absolute; inset: 8% 8% 14% 8%;
  display: grid; grid-template-columns: repeat(16, 1fr); gap: 6px;
  opacity: 0.7;
  pointer-events: none;
}
.mp-pixel-grid .px {
  aspect-ratio: 1; border-radius: 3px;
  background: rgba(14, 124, 102, 0.06);
  border: 1px solid rgba(14, 124, 102, 0.08);
}
.mp-pixel-grid .px.fired {
  background: rgba(34, 184, 160, 0.55);
  border-color: rgba(34, 184, 160, 0.55);
  box-shadow: 0 0 10px rgba(34, 184, 160, 0.45);
  animation: mpBlink 2.6s ease-in-out infinite;
}
@keyframes mpBlink { 0%,100% { opacity:1;} 50% {opacity:0.45;} }

/* ============== OFFER CARD ============== */
.mp-offer-card {
  position: relative;
  border-radius: 20px;
  padding: 18px;
}
.mp-offer-card.mp-offer-card-3d {
  transform: perspective(1400px) rotateX(1.5deg);
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease;
}
.mp-offer-card.mp-offer-card-3d:hover {
  transform: perspective(1400px) rotateX(0deg) translateY(-4px);
}
.mp-offer-card.mp-offer-card-hero {
  background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(247,253,252,0.92) 100%);
  border: 1px solid var(--mp-line-strong);
  backdrop-filter: blur(20px);
  box-shadow: 0 40px 100px -30px rgba(14, 124, 102, 0.45);
}

/* Hero offer card variant (landing): absolutely positioned inside the
   pixel-grid stage on the right side. */
.mp-hero-stage .mp-offer-card {
  position: absolute;
  top: 4%; left: 2%; right: 42%;
  z-index: 5;
}

.mp-offer-head { display: flex; align-items: center; justify-content: space-between; }
.mp-offer-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  padding: 5px 10px; border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.25);
}
.mp-offer-tag-recommended {
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 16px -4px rgba(14, 124, 102, 0.55);
}
.mp-offer-id {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 500;
  color: var(--mp-mute);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}
.mp-offer-title {
  margin-top: 12px;
  font-size: 13px; font-weight: 600; color: var(--mp-mute);
  letter-spacing: -0.01em;
}
.mp-offer-amount {
  margin-top: 4px;
  font-size: 44px; font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
}
.mp-offer-amount-sub {
  font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
  color: var(--mp-teal);
  text-transform: uppercase;
}
.mp-offer-row {
  margin-top: 18px;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--mp-line);
}
.mp-offer-row-k {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  text-transform: uppercase; color: var(--mp-mute);
}
.mp-offer-row-v {
  margin-top: 3px;
  font-size: 16px; font-weight: 700; color: var(--mp-ink);
  font-variant-numeric: tabular-nums;
}
.mp-offer-row-v.sm { font-size: 12px; font-weight: 600; }
.mp-offer-row-v .dim { color: var(--mp-mute); font-weight: 500; font-size: 0.7em; margin-left: 4px; }

.mp-offer-bar { margin-top: 18px; }
.mp-offer-bar-track {
  height: 6px; border-radius: 999px;
  background: rgba(14, 124, 102, 0.08);
  overflow: hidden;
  position: relative;
}
.mp-offer-bar-fill {
  height: 100%; width: 80%;
  background: linear-gradient(90deg, var(--mp-teal-2), var(--mp-teal));
  border-radius: 999px;
  animation: mpFill 4s ease-in-out infinite;
}
@keyframes mpFill {
  0%, 100% { width: 80%; }
  50% { width: 95%; }
}
.mp-offer-bar-stages {
  margin-top: 10px;
  display: flex; justify-content: space-between;
  gap: 8px;
  font-size: 9px; letter-spacing: 0.08em; font-weight: 600;
  text-transform: uppercase;
}
.mp-offer-bar-stages span {
  color: var(--mp-mute);
  white-space: nowrap; flex: 0 1 auto; min-width: 0;
}
.mp-offer-bar-stages span.on { color: var(--mp-teal); }
.mp-offer-bar-stages span.cur { color: var(--mp-teal); position: relative; }
.mp-offer-bar-stages span.cur::before {
  content: ""; position: absolute; left: -8px; top: 50%;
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--mp-teal-2);
  animation: mpPulse 1.4s ease-in-out infinite;
  transform: translateY(-50%);
}

.mp-offer-cta {
  margin-top: 18px;
  width: 100%;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  color: #fff;
  font-weight: 600; font-size: 13px;
  border: none;
  box-shadow: 0 10px 30px -10px rgba(14,124,102,0.55);
  transition: transform .15s ease, box-shadow .15s ease;
}
.mp-offer-cta:hover { transform: translateY(-1px); box-shadow: 0 16px 40px -12px rgba(14,124,102,0.65); }
.mp-offer-cta-ghost {
  background: rgba(255,255,255,0.6);
  color: var(--mp-teal);
  border: 1px solid var(--mp-line-strong);
  box-shadow: none;
}
.mp-offer-cta-ghost:hover { background: rgba(255,255,255,0.9); border-color: var(--mp-teal); }

.mp-offer-foot {
  margin-top: 12px;
  display: flex; justify-content: space-between; gap: 12px;
  font-size: 10px; color: var(--mp-mute);
  flex-wrap: wrap;
}
.mp-offer-foot span { display: inline-flex; align-items: center; gap: 6px; }

/* ============== FLOATING CHIPS ============== */
.mp-chip {
  position: absolute;
  z-index: 8;
  padding: 7px 12px;
  border-radius: 10px;
  background: rgba(255,255,255,0.95);
  border: 1px solid var(--mp-line-strong);
  box-shadow: 0 12px 30px -10px rgba(14, 124, 102, 0.25);
  font-size: 11px;
  white-space: nowrap;
  display: inline-flex; align-items: center; gap: 8px;
  animation: mpChipFloat 8s ease-in-out infinite;
  backdrop-filter: blur(8px);
}
.mp-chip-k { color: var(--mp-mute); font-weight: 600; letter-spacing: 0.06em; font-size: 9px; text-transform: uppercase; }
.mp-chip-v { color: var(--mp-ink); font-weight: 700; }
@keyframes mpChipFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-7px); }
}

/* ============== APPLY-FLOW SURFACES ============== */
.mp-apply-main {
  position: relative; z-index: 1;
  padding: 40px 0 80px;
}
.mp-apply-container {
  max-width: 720px; margin: 0 auto; padding: 0 24px;
  position: relative; z-index: 1;
}
.mp-apply-footer {
  position: relative; z-index: 1;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--mp-line);
  padding: 22px 0;
  margin-top: 60px;
}
.mp-ecoa {
  max-width: 1280px; margin: 0 auto; padding: 0 32px;
  font-size: 11px; line-height: 1.6; color: var(--mp-mute);
}

/* Step container — glass-teal-hi card with internal padding. */
.mp-step {
  border-radius: 24px;
  padding: 32px 28px;
  position: relative;
}
.mp-step-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px; letter-spacing: 0.16em; font-weight: 700;
  color: var(--mp-teal);
  padding: 5px 12px; border-radius: 999px;
  background: rgba(34, 184, 160, 0.10);
  border: 1px solid rgba(34, 184, 160, 0.25);
  text-transform: uppercase;
}
.mp-step-body {
  margin-top: 14px;
  font-size: 14px; line-height: 1.55; color: var(--mp-ink-2);
}
.mp-step-actions {
  margin-top: 28px;
  display: flex; gap: 10px; flex-wrap: wrap;
}

/* Disclaimer */
.mp-consent-box {
  margin-top: 22px;
  padding: 16px 18px;
  border-radius: 14px;
  background: rgba(34, 184, 160, 0.06);
  border: 1px solid var(--mp-line);
}
.mp-consent-text {
  font-size: 13px; line-height: 1.6; color: var(--mp-ink-2);
}
.mp-consent-toggle {
  margin-top: 18px;
  display: flex; gap: 12px; align-items: flex-start;
  font-size: 13px; line-height: 1.55; color: var(--mp-ink-2);
  cursor: pointer;
}
.mp-consent-toggle input {
  margin-top: 3px;
  width: 18px; height: 18px;
  accent-color: var(--mp-teal);
}

/* Form */
.mp-form {
  margin-top: 24px;
  display: grid; gap: 16px;
}
.mp-form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
@media (max-width: 540px) {
  .mp-form-row { grid-template-columns: 1fr; }
}
.mp-form label {
  display: grid; gap: 6px;
}
.mp-form-label {
  font-size: 11px; letter-spacing: 0.10em; font-weight: 600;
  text-transform: uppercase;
  color: var(--mp-mute);
}
.mp-form input {
  font-family: inherit;
  height: 48px;
  border-radius: 12px;
  border: 1px solid var(--mp-line-strong);
  background: rgba(255,255,255,0.7);
  padding: 0 16px;
  font-size: 15px;
  color: var(--mp-ink);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.mp-form input:focus {
  outline: none;
  border-color: var(--mp-teal);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(34, 184, 160, 0.16);
}
.mp-form-helper {
  font-size: 11px; color: var(--mp-mute);
  margin-top: 2px;
}
.mp-form-submit {
  margin-top: 8px;
}
.mp-form-error {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(220, 38, 38, 0.06);
  border: 1px solid rgba(220, 38, 38, 0.25);
  font-size: 13px; color: #b91c1c;
}

/* Engine step */
.mp-engine .mp-h2 { margin-top: 18px; }
.mp-engine-bar { margin-top: 22px; }
.mp-engine-stages {
  margin-top: 22px;
  display: grid; gap: 10px;
  list-style: none; padding: 0;
}
.mp-engine-stages li {
  display: flex; align-items: center; gap: 12px;
  font-size: 13px; color: var(--mp-mute);
  transition: color .25s ease, opacity .25s ease;
  opacity: 0.6;
}
.mp-engine-stages li.on { color: var(--mp-ink); opacity: 1; }
.mp-engine-tick {
  width: 22px; height: 22px; border-radius: 999px;
  background: rgba(14, 124, 102, 0.06);
  border: 1px solid var(--mp-line);
  color: var(--mp-mute);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.mp-engine-tick.on {
  background: linear-gradient(180deg, var(--mp-teal-2) 0%, var(--mp-teal) 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 6px 16px -4px rgba(14, 124, 102, 0.55);
}

/* Offers screen */
.mp-offers { display: grid; gap: 18px; }
.mp-offers-head {
  text-align: center;
  padding: 0 8px 8px;
}
.mp-offers-head .mp-step-tag { margin: 0 auto; }
.mp-offers-head .mp-h2 { margin-top: 18px; }
.mp-offers-head .mp-step-body { max-width: 540px; margin-left: auto; margin-right: auto; }
.mp-offers-meta {
  margin-top: 14px;
  font-size: 11px; letter-spacing: 0.16em; font-weight: 600;
  text-transform: uppercase;
  color: var(--mp-mute);
}
.mp-term-row {
  margin-top: 18px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.mp-term-label {
  font-size: 10px; letter-spacing: 0.14em; font-weight: 600;
  text-transform: uppercase; color: var(--mp-mute);
}
.mp-term-toggle {
  display: inline-flex; padding: 4px; border-radius: 12px;
  background: rgba(14, 124, 102, 0.08);
  gap: 4px;
}
.mp-term-toggle button {
  border: none; background: transparent;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px; font-weight: 600;
  color: var(--mp-mute);
  transition: background .15s ease, color .15s ease;
}
.mp-term-toggle button.on {
  background: #fff;
  color: var(--mp-ink);
  box-shadow: 0 4px 12px -4px rgba(14, 124, 102, 0.25);
}

.mp-offers-more { margin-top: 8px; }
.mp-offers-toggle {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(255,255,255,0.6);
  border: 1px solid var(--mp-line-strong);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--mp-teal);
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.mp-offers-toggle:hover { border-color: var(--mp-teal); background: rgba(255,255,255,0.9); }
.mp-offers-chevron { transition: transform .2s ease; display: inline-block; }
.mp-offers-chevron.open { transform: rotate(180deg); }
.mp-offers-list {
  margin-top: 14px; padding: 0; list-style: none;
  display: grid; gap: 12px;
}
.mp-offer-card-secondary {
  padding: 18px;
  transition: transform .2s ease, box-shadow .2s ease;
}
.mp-offer-card-secondary:hover {
  transform: translateY(-3px);
  box-shadow: 0 30px 70px -25px rgba(14, 124, 102, 0.28);
}
.mp-offer-card-secondary.is-chosen {
  border-color: var(--mp-teal);
  box-shadow: 0 30px 70px -25px rgba(14, 124, 102, 0.35);
}

/* ============== STEP BACK BUTTON ============== */
.mp-step-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(14, 124, 102, 0.06);
  color: var(--mp-ink-2);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: background 160ms ease, transform 160ms ease;
  min-height: 36px;
}
.mp-step-back:hover { background: rgba(14, 124, 102, 0.1); }
.mp-step-back:active { transform: translateY(1px); }

/* ============== HOW IT WORKS ============== */
.mp-how {
  margin-top: 96px;
  padding-top: 24px;
  scroll-margin-top: 80px;
  position: relative;
  z-index: 1;
}
.mp-how-eyebrow,
.mp-calc-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(14, 124, 102, 0.08);
  border: 1px solid var(--mp-line);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--mp-ink-2);
  text-transform: uppercase;
}
.mp-how-title,
.mp-calc-title {
  margin: 16px 0 28px;
  letter-spacing: -0.025em;
}
.mp-how-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.mp-how-step {
  padding: 22px 20px;
  border-radius: 18px;
  position: relative;
}
.mp-how-step-n {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--mp-teal);
  letter-spacing: 0.08em;
}
.mp-how-step-title {
  margin-top: 10px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.mp-how-step-body {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--mp-mute);
}

/* ============== CALCULATOR ============== */
.mp-calc {
  margin-top: 64px;
  padding-bottom: 96px;
  position: relative;
  z-index: 1;
}
.mp-calc-card {
  padding: 28px;
  border-radius: 22px;
  max-width: 760px;
}
.mp-calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.mp-calc-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mp-calc-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mp-mute);
  font-weight: 700;
}
.mp-calc-label strong {
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
  text-transform: none;
  font-feature-settings: 'tnum';
}
.mp-calc-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--mp-teal), var(--mp-teal-2));
  outline: none;
  margin: 6px 0;
}
.mp-calc-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid var(--mp-teal);
  box-shadow: 0 4px 10px rgba(14, 124, 102, 0.25);
  cursor: pointer;
}
.mp-calc-range::-moz-range-thumb {
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid var(--mp-teal);
  box-shadow: 0 4px 10px rgba(14, 124, 102, 0.25);
  cursor: pointer;
}
.mp-calc-range-foot {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--mp-mute);
  font-weight: 600;
}
.mp-calc-terms {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mp-calc-term {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(14, 124, 102, 0.04);
  border: 1px solid var(--mp-line);
  color: var(--mp-ink-2);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 160ms ease;
  min-width: 56px;
  min-height: 40px;
}
.mp-calc-term:hover {
  background: rgba(14, 124, 102, 0.08);
}
.mp-calc-term.is-active {
  background: linear-gradient(135deg, var(--mp-teal), var(--mp-teal-2));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 14px rgba(14, 124, 102, 0.22);
}

/* Credit-tier picker — full-width row of 4 chips, teal accent. */
.mp-calc-tier-field {
  grid-column: 1 / -1;
  margin-top: 18px;
}
.mp-calc-field--full { grid-column: 1 / -1; }
.mp-calc-tier-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.mp-calc-tier {
  padding: 10px 8px;
  border-radius: 10px;
  background: rgba(14, 124, 102, 0.04);
  border: 1px solid var(--mp-line);
  color: var(--mp-ink-2);
  text-align: center;
  transition: all 160ms ease;
  cursor: pointer;
  min-height: 56px;
}
.mp-calc-tier:hover { background: rgba(14, 124, 102, 0.08); }
.mp-calc-tier.is-active {
  background: linear-gradient(135deg, var(--mp-teal), var(--mp-teal-2));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 14px rgba(14, 124, 102, 0.22);
}
.mp-calc-tier-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.mp-calc-tier-sub {
  display: block;
  font-size: 10.5px;
  opacity: 0.7;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.mp-calc-tier.is-active .mp-calc-tier-sub { opacity: 0.95; }
@media (max-width: 540px) {
  .mp-calc-tier-row { grid-template-columns: repeat(2, 1fr); }
}

.mp-calc-result {
  margin-top: 24px;
  padding: 20px 22px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(14, 124, 102, 0.06), rgba(34, 184, 160, 0.06));
  border: 1px solid var(--mp-line);
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  align-items: center;
}
.mp-calc-result-k {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--mp-mute);
  font-weight: 700;
}
.mp-calc-result-v {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--mp-deep);
  line-height: 1;
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.mp-calc-result-unit {
  font-size: 16px;
  color: var(--mp-mute);
  font-weight: 600;
  margin-left: 2px;
}
.mp-calc-result-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.mp-calc-result-vs {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--mp-ink);
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.mp-calc-cta { margin-top: 18px; }
.mp-calc-disc {
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--mp-mute);
  line-height: 1.55;
}

/* ============== RESPONSIVE ============== */
@media (max-width: 960px) {
  .mp-h1 { font-size: 44px; }
  .mp-h2 { font-size: 28px; }
  .mp-hero-grid { grid-template-columns: 1fr; }
  .mp-hero-right { min-height: 560px; }
  .mp-hero-strip { grid-template-columns: repeat(2, 1fr); }
  .mp-how-grid { grid-template-columns: repeat(2, 1fr); }
  .mp-calc-grid { grid-template-columns: 1fr; }
  .mp-calc-result { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  .mp-h1 { font-size: 34px; }
  .mp-h2 { font-size: 26px; }
  .mp-step { padding: 24px 18px; }
  .mp-offer-amount { font-size: 36px; }
  .mp-chip { font-size: 10px; padding: 5px 9px; }
  .mp-container { padding: 0 18px; }
  .mp-how { margin-top: 72px; }
  .mp-how-grid { grid-template-columns: 1fr; gap: 12px; }
  .mp-how-step { padding: 18px 16px; }
  .mp-calc-card { padding: 22px 18px; }
  .mp-calc-result { padding: 16px 18px; }
  .mp-calc-result-v { font-size: 32px; }
  .mp-calc-result-side { grid-template-columns: 1fr 1fr; }
  .mp-apply-container { padding: 0 18px !important; }
  /* keep inputs touch-target sized */
  .mp-form input { min-height: 48px; font-size: 16px; }
  .mp-form-submit { min-height: 52px; }

  /* ── Hero offer card — mobile fit ─────────────────────────────────
     The hero stage was overflowing on phones:
       - pixel grid bled to the right edge
       - 3-col offer row crushed "Cross River Bank" vertically
       - 5-stage bar labels collided into "PREQUAQUOTOFFERACCEPRAYOUT"
       - floating chips (FCRA / DECISION / PAYOUT / PROMO) wrapped weirdly
     Fix: contain the stage, drop decorative chrome, restack the rows. */
  .mp-hero-stage {
    min-height: auto;
    padding-bottom: 24px;
  }
  .mp-hero-right { min-height: auto; }
  .mp-pixel-grid,
  .mp-halo { display: none; }
  .mp-hero-stage .mp-offer-card {
    position: relative;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    transform: none !important;
  }
  /* 3-col EST. MONTHLY / APR / LENDER becomes a tidy 2-col grid;
     the long "Cross River Bank" lender value spans the full width
     beneath, which avoids the vertical 3-letter wrap. */
  .mp-offer-row {
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
  }
  .mp-offer-row > :nth-child(3) {
    grid-column: 1 / -1;
  }
  .mp-offer-row-v { font-size: 14px; }
  .mp-offer-row-v.sm { font-size: 13px; }
  /* Stage bar — show the track only, drop the 5-label rail since the
     "PREQUAL / QUOTE / OFFER / ACCEPT / PAYOUT" copy collides at any
     width under ~360px. The progress bar already conveys the story. */
  .mp-offer-bar-stages { display: none; }
  /* Floating chips (FCRA / DECISION / PAYOUT / PROMO) — these are
     decorative on mobile and were clipping the bottom of the card.
     The pre-qualified pill + foot row inside the card already make
     the same statement. */
  .mp-chip { display: none; }
  .mp-offer-card { padding: 22px 18px; }
  .mp-offer-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}

/* ============== VIEWPORT LOCK (no horizontal shake) ============== */
html, body { overflow-x: hidden; width: 100%; max-width: 100%; }
.medpay-root, .medpay-root * { max-width: 100%; }
.medpay-root img, .medpay-root svg { max-width: 100%; height: auto; }

/* Respect iOS safe area on the bottom (home indicator) */
.mp-apply-footer { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
`;
