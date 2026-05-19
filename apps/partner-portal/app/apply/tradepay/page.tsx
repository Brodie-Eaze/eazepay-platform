'use client';

/**
 * Dedicated TradePay consumer apply page.
 *
 * Why a static route instead of the dynamic /apply/[brand] page?
 * Because the brief is "make it visually identical to /landing/tradepay
 * end-to-end." That requires the same design system (slate + safety
 * orange tokens, glass cards, 3D-perspective offer card, floating
 * chips, status-pill scanline, CTA glow, pulse + chip-float keyframes)
 * applied to every step of the apply flow. Trying to over-layer those
 * onto the multi-brand dynamic page risks bleeding styles into the
 * MedPay and CoachPay apply flows. A dedicated route is the cleanest
 * isolation.
 *
 * Next.js App Router serves the static segment over the dynamic one,
 * so this file owns /apply/tradepay and the dynamic [brand] route
 * handles coachpay (and any future brand).
 *
 * Compliance (FCRA soft-pull consent, ECOA / Reg B footer, session
 * fingerprint binding, idle timeout, replaceState back-prevention,
 * masked PII inputs, in-flight throttle) is preserved 1:1 from the
 * Wave 2C hardening — same imports as the dynamic page.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRightIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  HomeIcon,
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
import {
  saveSubmittedApp,
  submitApplicationToApi,
  UNATTRIBUTED_PARTNER_ID,
} from '../../../lib/submitted-applications';

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
 * tier-fallback walk so a sparse tradepay tier (eg. sub_prime at
 * <$2k) still surfaces offers.
 */
const TIER_ORDER: CreditTier[] = ['prime_plus', 'prime', 'near_prime', 'sub_prime'];
function filterLenders({ partnerId, tier, amountCents }: FilterArgs): MarketplaceLenderRow[] {
  const passesNonTier = (l: MarketplaceLenderRow): boolean => {
    if (l.brands.length > 0 && !l.brands.includes('tradepay')) return false;
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

export default function TradePayApplyPage() {
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

  // Save app to the per-partner store on engine → offers. Attribution:
  // explicit ?ref=<partnerId> wins. With no ref we stamp
  // UNATTRIBUTED_PARTNER_ID so the row stays out of every partner-scoped
  // portal. Master ops can re-attribute via admin tools.
  const [persisted, setPersisted] = useState(false);
  useEffect(() => {
    if (step !== 'offers' || persisted) return;
    const partnerId = ref || UNATTRIBUTED_PARTNER_ID;
    const top = eligibleLenders[0];
    saveSubmittedApp({
      partnerId,
      brand: 'tradepay',
      customer: `${intake.firstName.trim()} ${intake.lastName.trim()}`.trim(),
      customerEmail: intake.email.trim(),
      amountCents: cents(intake.amount),
      tier,
      lender: top?.displayName ?? 'Pending lender match',
    });
    submitApplicationToApi({
      brand: 'tradepay',
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
  }, [step, persisted, ref, eligibleLenders, intake, tier, applicationId]);

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
      amt < 3_000_00 ||
      amt > 100_000_00
    ) {
      setError(
        'Please fill every field. Phone must be 10 digits and amount between $3,000 and $100,000.',
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
    <div className="tradepay-root tp-root">
      <style dangerouslySetInnerHTML={{ __html: TRADEPAY_APPLY_CSS }} />
      <ConsumerIdleGuard onExpire={handleIdleExpire} />

      {/* ============== NAV ============== */}
      <nav className="tp-apply-nav">
        <div className="tp-apply-nav-inner">
          <a href="#" className="tp-brand">
            <span className="tp-brand-mark">
              <HomeIcon size={16} className="text-white" />
            </span>
            <span className="tp-brand-word">
              TradePay <span className="tp-brand-sub">· Home Improvement Financing</span>
            </span>
          </a>
          <div className="tp-apply-nav-cta">
            {step !== 'landing' && (
              <button type="button" className="tp-btn-ghost" onClick={() => setStep('landing')}>
                Restart
              </button>
            )}
            {step === 'landing' && (
              <button
                type="button"
                className="tp-btn-primary tp-cta-glow"
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
        <main className="tp-apply-main">
          <div className="tp-apply-container">
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
              <p className="tp-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </main>
      )}

      {/* ============== FOOTER (ECOA / Reg B) ============== */}
      <footer className="tp-apply-footer">
        <div className="tp-apply-container">
          <p className="tp-ecoa">{ECOA_FOOTER_NOTICE}</p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LANDING STEP — mirrors /landing/tradepay hero shape (eyebrow pill,
// gradient slate headline with a touch of orange, ranked-offer 3D
// card on the right, floating chips at all four corners, hero trust
// strip). Consumer-facing copy: homeowner financing their home
// project rather than the contractor pitch on the marketing page.
// ─────────────────────────────────────────────────────────────────────
function LandingStep({ onApply }: { onApply: () => void }) {
  return (
    <section id="top" className="tp-hero">
      <div className="tp-mesh" />
      <div className="tp-grid" />
      <div className="tp-noise" />
      <div className="tp-apply-hero-container">
        <div className="tp-hero-grid">
          <div>
            <span className="tp-eyebrow-pill">
              <span className="tp-pill-dot tp-pill-dot-orange" />
              SOFT PULL · ZERO IMPACT TO YOUR SCORE
            </span>
            <h1 className="tp-h1">
              <span className="tp-grad-text">Finance your home project.</span>
              <br />
              <span className="tp-grad-text-darker">Decision in 14 seconds.</span>
            </h1>
            <p className="tp-hero-sub">
              HVAC, roofing, solar, kitchens, baths and exteriors. the lender marketplace quotes in
              parallel on a single soft pull. <strong>Pre-qualify in 60 seconds.</strong> Loans from
              $3,000 to $100,000. Terms up to 72 months. APR from 5.9% for qualifying borrowers.
              Funds land within 48 to 72 hours.
            </p>
            <div className="tp-hero-ctas">
              <button type="button" className="tp-btn-primary tp-cta-glow lg" onClick={onApply}>
                Check my rate
                <ArrowRightIcon size={14} />
              </button>
              <a href="#how" className="tp-btn-ghost lg">
                How it works
              </a>
            </div>
            <div className="tp-trust-strip tp-apply-trust-strip">
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  60<span className="tp-trust-pct">sec</span>
                </div>
                <div className="tp-trust-lbl">Pre-qualification</div>
              </div>
              <div className="tp-trust-cell">
                <div className="tp-trust-num">Real-time</div>
                <div className="tp-trust-lbl">Lenders parallel</div>
              </div>
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  5.9<span className="tp-trust-pct">%</span>
                </div>
                <div className="tp-trust-lbl">APR from</div>
              </div>
              <div className="tp-trust-cell">
                <div className="tp-trust-num">
                  0<span className="tp-trust-pct">%</span>
                </div>
                <div className="tp-trust-lbl">Credit impact</div>
              </div>
            </div>
          </div>

          <div className="tp-hero-right tp-hero-scene">
            <div className="tp-hero-stage">
              <div className="tp-offer-card tp-apply-offer-card">
                {/* Header */}
                <div className="tp-offer-card-head">
                  <div className="tp-status-pill">
                    <span className="tp-status-pill-scan" aria-hidden />
                    <span className="tp-live-dot" />
                    <span className="tp-status-pill-label">TRADEPAY · APPROVED</span>
                  </div>
                  <span className="tp-offer-card-sub">Soft pull · 0 impact</span>
                </div>

                {/* Project line */}
                <div className="tp-offer-card-project">
                  <div>
                    <div className="tp-offer-card-eyebrow">Roof replacement · sample offer</div>
                    <div className="tp-offer-card-amount">$24,000</div>
                  </div>
                  <div className="tp-offer-card-right">
                    <div className="tp-offer-card-eyebrow">Match time</div>
                    <div className="tp-offer-card-match">14s</div>
                  </div>
                </div>

                {/* Ranked offer rows */}
                <div className="tp-offer-card-rows">
                  <div className="tp-offer-card-row-head">
                    <div>Lender</div>
                    <div className="ta-right">Monthly</div>
                    <div className="ta-right">APR</div>
                    <div className="ta-right">Term</div>
                  </div>
                  <div className="tp-offer-card-row tp-offer-row-primary">
                    <div className="tp-row-l">
                      <span className="tp-star">*</span>
                      <span className="tp-row-name">CoreCredit</span>
                      <span className="tp-row-recommend">RECOMMENDED</span>
                    </div>
                    <div className="ta-right tabular tp-row-strong">$480 / mo</div>
                    <div className="ta-right tabular">8.49%</div>
                    <div className="ta-right tabular">60 mo</div>
                  </div>
                  <div className="tp-offer-card-row">
                    <div className="tp-row-l">
                      <span className="tp-row-dot" />
                      <span className="tp-row-name">FinWise</span>
                    </div>
                    <div className="ta-right tabular">$510 / mo</div>
                    <div className="ta-right tabular">9.99%</div>
                    <div className="ta-right tabular">60 mo</div>
                  </div>
                  <div className="tp-offer-card-row">
                    <div className="tp-row-l">
                      <span className="tp-row-dot" />
                      <span className="tp-row-name">BuildBank</span>
                    </div>
                    <div className="ta-right tabular">$436 / mo</div>
                    <div className="ta-right tabular">6.99%</div>
                    <div className="ta-right tabular">60 mo</div>
                  </div>
                </div>

                {/* Live stats strip */}
                <div className="tp-stat-strip">
                  <div className="tp-stat-cell">
                    <div className="tp-stat-num">$12.8M</div>
                    <div className="tp-stat-lbl">Funded · 30d</div>
                  </div>
                  <div className="tp-stat-cell">
                    <div className="tp-stat-num">Soft</div>
                    <div className="tp-stat-lbl">Pull · zero impact</div>
                  </div>
                  <div className="tp-stat-cell">
                    <div className="tp-stat-num">Real-time</div>
                    <div className="tp-stat-lbl">Lenders parallel</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="tp-offer-card-foot">
                  <div className="tp-offer-card-foot-l">
                    Funds in 48 to 72hr · paid direct to your contractor
                  </div>
                  <div className="tp-funded-chip">
                    <span className="tp-funded-chip-dot" /> APPROVED
                  </div>
                </div>

                {/* CTA button inside card */}
                <button
                  type="button"
                  className="tp-btn-primary tp-cta-glow tp-offer-card-cta"
                  onClick={onApply}
                >
                  Start my application
                  <ArrowRightIcon size={14} />
                </button>
              </div>
            </div>

            {/* Floating chips, anchored to corners */}
            <div
              className="tp-chip tp-chip-orange tp-chip-pulse"
              style={{ top: '-16px', left: '-8px' }}
            >
              <span className="tp-chip-dot tp-chip-dot-orange" />
              <span className="tp-chip-k">FCRA</span>
              <span className="tp-chip-v">soft pull · 0 impact</span>
            </div>
            <div className="tp-chip tp-chip-funded" style={{ top: '-16px', right: '-8px' }}>
              <span className="tp-chip-dot" />
              <span className="tp-chip-k">DECISION</span>
              <span className="tp-chip-v">14s · lender marketplace</span>
            </div>
            <div className="tp-chip" style={{ bottom: '-16px', left: '-8px' }}>
              <span className="tp-chip-dot" />
              <span className="tp-chip-k">PAYOUT</span>
              <span className="tp-chip-v">contractor-direct · 48-72hr</span>
            </div>
            <div className="tp-chip" style={{ bottom: '-16px', right: '-8px' }}>
              <span className="tp-chip-dot" />
              <span className="tp-chip-k">PROMO</span>
              <span className="tp-chip-v">0% interest plans · T&Cs</span>
            </div>
          </div>
        </div>

        {/* ============== HOW IT WORKS ============== */}
        <section id="how" className="tp-how">
          <div className="tp-how-eyebrow">
            <span className="tp-pill-dot tp-pill-dot-orange" />
            HOW IT WORKS · 4 STEPS
          </div>
          <h2 className="tp-h2 tp-how-title">
            <span className="tp-grad-text">From quote to funded</span>
            <br />
            <span className="tp-grad-text-darker">in 72 hours.</span>
          </h2>
          <div className="tp-how-grid">
            {[
              {
                n: '01',
                title: 'Apply at quote time',
                body: 'Soft credit pull only — zero impact to your score. Takes about 60 seconds, in the driveway or on the kitchen counter.',
              },
              {
                n: '02',
                title: 'We match you',
                body: 'contractor-friendly lenders across the marketplace quote in parallel. Pre-qualified offers ranked by lowest total cost.',
              },
              {
                n: '03',
                title: 'You pick the plan',
                body: 'Compare APR, term, and monthly payment side-by-side. Plans from 24 to 84 months. APR from 8.49%.',
              },
              {
                n: '04',
                title: 'Contractor paid direct',
                body: 'Once you accept, the lender pays your contractor directly — typically within 48 to 72 hours of acceptance.',
              },
            ].map((s) => (
              <div key={s.n} className="tp-how-step tp-step-card">
                <div className="tp-how-step-n">{s.n}</div>
                <div className="tp-how-step-title">{s.title}</div>
                <p className="tp-how-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============== CALCULATOR ============== */}
        <section className="tp-calc">
          <div className="tp-calc-eyebrow">
            <span className="tp-pill-dot tp-pill-dot-orange" />
            PAYMENT ESTIMATOR · ILLUSTRATIVE ONLY
          </div>
          <h2 className="tp-h2 tp-calc-title">
            <span className="tp-grad-text">What might my</span>
            <br />
            <span className="tp-grad-text-darker">monthly payment look like?</span>
          </h2>
          <TradePayCalculator onApply={onApply} />
        </section>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TradePay payment estimator. Amortization across a real-world APR
// ramp tied to credit tier — Excellent → Building. Disclosed as
// illustrative so a contractor demoing the calc at the quote
// doesn't set false expectations against a homeowner whose real
// pre-qual lands in a higher tier.
// ─────────────────────────────────────────────────────────────────────
const TP_TIERS = [
  { key: 'excellent', label: 'Excellent', sub: '720+ FICO', apr: 0.059 },
  { key: 'good', label: 'Good', sub: '660–719', apr: 0.099 },
  { key: 'fair', label: 'Fair', sub: '600–659', apr: 0.149 },
  { key: 'building', label: 'Building', sub: 'under 600', apr: 0.249 },
] as const;
type TpTier = (typeof TP_TIERS)[number]['key'];

function TradePayCalculator({ onApply }: { onApply: () => void }) {
  const [amount, setAmount] = useState(24000);
  const [term, setTerm] = useState<12 | 24 | 36 | 48 | 60 | 72 | 84>(60);
  const [tier, setTier] = useState<TpTier>('good');
  const activeTier = TP_TIERS.find((t) => t.key === tier)!;
  const APR = activeTier.apr;
  const r = APR / 12;
  const monthly = Math.round((amount * r) / (1 - Math.pow(1 + r, -term)));
  const totalPaid = monthly * term;
  const totalInterest = Math.max(0, totalPaid - amount);

  return (
    <div className="tp-calc-card tp-step-card">
      <div className="tp-calc-grid">
        <div className="tp-calc-field">
          <div className="tp-calc-label">
            <span>Project amount</span>
            <strong>${amount.toLocaleString('en-US')}</strong>
          </div>
          <input
            type="range"
            min={2500}
            max={75000}
            step={500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tp-calc-range"
            aria-label="Project amount in USD"
          />
          <div className="tp-calc-range-foot">
            <span>$2.5k</span>
            <span>$75k</span>
          </div>
        </div>

        <div className="tp-calc-field">
          <div className="tp-calc-label">
            <span>Term</span>
            <strong>{term} months</strong>
          </div>
          <div className="tp-calc-terms">
            {([12, 24, 36, 48, 60, 72, 84] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`tp-calc-term ${t === term ? 'is-active' : ''}`}
                onClick={() => setTerm(t)}
                aria-pressed={t === term}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tp-calc-field tp-calc-field--full tp-calc-tier-field">
        <div className="tp-calc-label">
          <span>Credit profile</span>
          <strong>
            {activeTier.label} · {activeTier.sub}
          </strong>
        </div>
        <div className="tp-calc-select-wrap">
          <select
            className="tp-calc-select"
            value={tier}
            onChange={(e) => setTier(e.target.value as TpTier)}
            aria-label="Credit profile"
          >
            {TP_TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} · {t.sub}
              </option>
            ))}
          </select>
          <span className="tp-calc-select-caret" aria-hidden>
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

      <div className="tp-calc-result">
        <div className="tp-calc-result-main">
          <div className="tp-calc-result-k">Est. monthly</div>
          <div className="tp-calc-result-v">
            ${monthly.toLocaleString('en-US')}
            <span className="tp-calc-result-unit"> / mo</span>
          </div>
        </div>
        <div className="tp-calc-result-side">
          <div>
            <div className="tp-calc-result-k">Total interest</div>
            <div className="tp-calc-result-vs">${totalInterest.toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>

      <button type="button" className="tp-btn-primary lg full tp-calc-cta" onClick={onApply}>
        Check my real rate
        <ArrowRightIcon size={14} />
      </button>
      <p className="tp-calc-disc">
        Illustrative — based on a representative {activeTier.label.toLowerCase()} credit profile (
        {activeTier.sub}). Soft pull only; your actual APR, term, and monthly payment are set by
        your pre-qualified offers.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DISCLAIMER STEP — FCRA soft-pull consent. Verbatim language, glass
// card, slate gradient CTA with the orange aura.
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
    <div className="tp-step tp-step-card">
      <div className="tp-step-tag">01 · CONSENT</div>
      <h2 className="tp-h2">
        <span className="tp-grad-text">Quick consent.</span>
        <br />
        <span className="tp-grad-text-darker">No impact to your credit score.</span>
      </h2>
      <p className="tp-step-body">
        Before we match you with lenders, federal law requires you to authorize a soft credit
        inquiry. Your score is not affected.
      </p>

      <div className="tp-consent-box">
        <p className="tp-consent-text">{SOFT_PULL_CONSENT_TEXT}</p>
      </div>

      <label className="tp-consent-toggle">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          I authorize a soft credit pull and have read the Privacy Policy and E-Sign Disclosure.
        </span>
      </label>

      <div className="tp-step-actions">
        <button type="button" className="tp-btn-ghost lg" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="tp-btn-primary tp-cta-glow lg"
          onClick={onAccept}
          disabled={consentBusy}
        >
          {consentBusy ? 'Confirming...' : 'I agree, continue'}
          {!consentBusy && <ArrowRightIcon size={14} />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// INTAKE STEP — 5-field minimal pre-qual form. Glass card, slate
// gradient submit. PII fields use autoComplete=off so browser-restore
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
    <div className="tp-step tp-step-card">
      <button type="button" className="tp-step-back" onClick={onBack} aria-label="Back to consent">
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="tp-step-tag">02 · YOUR DETAILS</div>
      <h2 className="tp-h2">
        <span className="tp-grad-text">Let&apos;s match you with</span>
        <br />
        <span className="tp-grad-text-darker">the right plan.</span>
      </h2>
      <p className="tp-step-body">
        Soft credit inquiry only. Your details stay private and encrypted.
      </p>

      <form
        className="tp-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        autoComplete="off"
      >
        <div className="tp-form-row">
          <label>
            <span className="tp-form-label">First name</span>
            <input
              type="text"
              value={intake.firstName}
              onChange={(e) => setIntake({ ...intake, firstName: e.target.value })}
              required
              autoComplete="off"
            />
          </label>
          <label>
            <span className="tp-form-label">Last name</span>
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
          <span className="tp-form-label">Email</span>
          <input
            type="email"
            value={intake.email}
            onChange={(e) => setIntake({ ...intake, email: e.target.value })}
            required
            autoComplete="off"
          />
        </label>
        <label>
          <span className="tp-form-label">Mobile phone</span>
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
          <span className="tp-form-label">Project amount (USD)</span>
          <input
            type="text"
            inputMode="numeric"
            value={intake.amount}
            onChange={(e) => setIntake({ ...intake, amount: e.target.value })}
            required
            autoComplete="off"
            placeholder="24000"
          />
          <span className="tp-form-helper">
            Most homeowners borrow between $3,000 and $100,000.
          </span>
        </label>

        <button type="submit" className="tp-btn-primary tp-cta-glow lg full tp-form-submit">
          See my offers
          <ArrowRightIcon size={14} />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ENGINE STEP — animated "quoting the lender marketplace in parallel" loading
// screen. Mirrors the 5-stage waterfall schematic from the landing
// page: Pre-qual → Brief → Decision → Match → Funded. Progress bar
// fill + status pill scanline lifted from landing.
// ─────────────────────────────────────────────────────────────────────
function EngineStep() {
  const stages = [
    'Soft credit pull · FCRA permissible purpose',
    'Affordability check · debt-to-income ratio',
    'Brief reshaped for routing · tier + amount',
    'Quoting the lender marketplace in parallel · 5s SLA',
    'Ranking by lowest monthly payment',
  ];
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => Math.min(i + 1, stages.length - 1)), 600);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <div className="tp-step tp-step-card tp-engine">
      <div className="tp-step-tag">
        <span className="tp-pill-dot tp-pill-dot-orange" />
        LIVE
      </div>
      <h2 className="tp-h2">
        <span className="tp-grad-text">Quoting</span>
        <br />
        <span className="tp-grad-text-darker">the lender marketplace in parallel.</span>
      </h2>

      <div className="tp-engine-bar">
        <div className="tp-engine-bar-track">
          <div className="tp-engine-bar-fill" />
        </div>
      </div>

      <ul className="tp-engine-stages">
        {stages.map((s, i) => (
          <li key={s} className={i <= activeIdx ? 'on' : ''}>
            <span className={i <= activeIdx ? 'tp-engine-tick on' : 'tp-engine-tick'}>
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
// OFFERS STEP — "AI Recommended" hero offer card (same 3D perspective
// + slate-with-orange-accent style as the landing hero card) plus a
// list of ranked secondary cards beneath, hover-lift glass surfaces.
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
  const effectiveAmount = amountCents > 0 ? amountCents : 24_000_00;
  const [term, setTerm] = useState<48 | 60 | 72>(60);
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
      <div className="tp-step tp-step-card">
        <div className="tp-step-tag">NO MATCHES</div>
        <h2 className="tp-h2">
          <span className="tp-grad-text">No matches right now.</span>
        </h2>
        <p className="tp-step-body">
          Your referring contractor has no lenders enabled for this credit tier. Reach out to them
          or try a different project amount.
        </p>
      </div>
    );
  }

  const top = lenders[0]!;
  const rest = lenders.slice(1);
  const likelihoodFor = (idx: number) => Math.max(40, 80 - idx * 10);

  return (
    <div className="tp-offers">
      <button
        type="button"
        className="tp-step-back"
        onClick={onBack}
        aria-label="Back to your details"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </button>
      <div className="tp-offers-head">
        <div className="tp-step-tag">
          <span className="tp-pill-dot tp-pill-dot-orange" />
          OFFERS READY
        </div>
        <h2 className="tp-h2">
          <span className="tp-grad-text">You&apos;ve been matched.</span>
        </h2>
        <p className="tp-step-body">
          the lender marketplace quotes in parallel. Ranked by lowest monthly payment. Soft pull
          only — your credit score is unchanged.
        </p>
        <p className="tp-offers-meta">
          Expires in {mm}:{ss} · {tierLabel[tier]} · FICO {tierFico[tier]}
        </p>
      </div>

      {/* Recommended hero offer — 3D perspective + orange-accent recommendation row. */}
      <div className="tp-hero-scene tp-offers-hero-scene">
        <div className="tp-hero-stage">
          <div className="tp-offer-card tp-apply-offer-card tp-offer-card-hero">
            <div className="tp-offer-card-head">
              <div className="tp-status-pill">
                <span className="tp-status-pill-scan" aria-hidden />
                <span className="tp-live-dot" />
                <span className="tp-status-pill-label">AI RECOMMENDED · APPROVAL 92%</span>
              </div>
              <span className="tp-offer-card-sub">Soft pull · 0 impact</span>
            </div>

            <div className="tp-offer-card-project">
              <div>
                <div className="tp-offer-card-eyebrow">{top.displayName} · approved</div>
                <div className="tp-offer-card-amount">{fmt(effectiveAmount)}</div>
              </div>
              <div className="tp-offer-card-right">
                <div className="tp-offer-card-eyebrow">Est. monthly</div>
                <div className="tp-offer-card-match">
                  ${monthly.toLocaleString('en-US')}
                  <span className="tp-offer-card-match-sub"> · {term} mo</span>
                </div>
              </div>
            </div>

            <div className="tp-offer-card-rows">
              <div className="tp-offer-card-row tp-offer-row-primary">
                <div className="tp-row-l">
                  <span className="tp-star">*</span>
                  <span className="tp-row-name">{top.displayName}</span>
                  <span className="tp-row-recommend">BEST RATE</span>
                </div>
                <div className="ta-right tabular tp-row-strong">
                  ${monthly.toLocaleString('en-US')} / mo
                </div>
                <div className="ta-right tabular">5.9% – 8.9%</div>
                <div className="ta-right tabular">{term} mo</div>
              </div>
            </div>

            <div className="tp-term-row">
              <span className="tp-term-label">Term</span>
              <div className="tp-term-toggle">
                {([48, 60, 72] as const).map((t) => (
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

            <button
              type="button"
              onClick={() => setChosen(top.id)}
              className="tp-btn-primary tp-cta-glow tp-offer-card-cta"
            >
              Apply with {top.displayName}
              <ArrowRightIcon size={14} />
            </button>

            <div className="tp-offer-card-foot">
              <span>
                <ChartIcon size={11} /> Lowest monthly payment
              </span>
              <span>
                <ShieldIcon size={11} /> Best approval likelihood
              </span>
              <span>
                <BoltIcon size={11} /> Contractor-direct · 48-72hr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary cards — hover-lift glass. */}
      {rest.length > 0 && (
        <div className="tp-offers-more">
          <button type="button" onClick={() => setShowMore((v) => !v)} className="tp-offers-toggle">
            <span>Other available options ({rest.length})</span>
            <span className={'tp-offers-chevron ' + (showMore ? 'open' : '')}>▾</span>
          </button>
          {showMore && (
            <ul className="tp-offers-list">
              {rest.map((l, idx) => {
                const lk = likelihoodFor(idx);
                const fits =
                  amountCents === 0 ||
                  (amountCents >= l.minAmountCents && amountCents <= l.maxAmountCents);
                return (
                  <li
                    key={l.id}
                    className={
                      'tp-offer-card tp-offer-card-secondary' +
                      (chosen === l.id ? ' is-chosen' : '')
                    }
                  >
                    <div className="tp-offer-card-head">
                      <div className="tp-status-pill">
                        <span className="tp-status-pill-label tp-status-pill-quiet">
                          {l.displayName}
                        </span>
                      </div>
                      <span className="tp-offer-card-sub">
                        {fits ? 'eligible' : 'outside envelope'}
                      </span>
                    </div>
                    <div className="tp-offer-card-row tp-offer-card-row-stat">
                      <div className="tp-row-stat">
                        <div className="tp-row-stat-k">Approval</div>
                        <div className="tp-row-stat-v">{lk}%</div>
                      </div>
                      <div className="tp-row-stat">
                        <div className="tp-row-stat-k">Range</div>
                        <div className="tp-row-stat-v sm">
                          {fmt(l.minAmountCents)} – {fmt(l.maxAmountCents)}
                        </div>
                      </div>
                      <div className="tp-row-stat">
                        <div className="tp-row-stat-k">Term</div>
                        <div className="tp-row-stat-v sm">24 – 84 mo</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChosen(l.id)}
                      className="tp-btn-ghost tp-offer-secondary-cta"
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
// CSS — lifted directly from /landing/tradepay/page.tsx for the slate
// + orange tokens, glass cards, gradient buttons, 3D hero-stage, status
// pill scanline, floating chips, pulse + chip-float + CTA-glow + sway
// keyframes. New selectors at the bottom adapt the design system to
// apply-flow surfaces (forms, step containers, engine progress, ECOA
// footer, offer card layout).
// ─────────────────────────────────────────────────────────────────────
const TRADEPAY_APPLY_CSS = `
.tradepay-root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
}
.tradepay-root.tp-root {
  --tp-slate-950: #020617;
  --tp-slate-900: #0F172A;
  --tp-slate-800: #1E293B;
  --tp-slate-700: #334155;
  --tp-slate-600: #475569;
  --tp-slate-500: #64748B;
  --tp-slate-400: #94A3B8;
  --tp-slate-300: #CBD5E1;
  --tp-slate-200: #E2E8F0;
  --tp-slate-100: #F1F5F9;
  --tp-slate-50:  #F8FAFC;
  --tp-orange: #F97316;
  --tp-orange-warm: #FB923C;
  --tp-orange-deep: #EA580C;
  --tp-paper: #FAFAF9;
  color: var(--tp-slate-900);
  background: linear-gradient(180deg, #FAFAF9 0%, #FFFFFF 35%, #F8FAFC 70%, #FFFFFF 100%);
}
.tradepay-root * { box-sizing: border-box; }
.tradepay-root a { color: inherit; text-decoration: none; }
.tradepay-root button { font-family: inherit; cursor: pointer; }

/* ============== Type ============== */
.tradepay-root .tp-h1 {
  font-size: clamp(2.25rem, 4.2vw, 4rem);
  line-height: 1.04;
  letter-spacing: -0.025em;
  font-weight: 700;
  margin-top: 20px;
}
.tradepay-root .tp-h2 {
  font-size: clamp(1.6rem, 2.8vw, 2.4rem);
  line-height: 1.08;
  letter-spacing: -0.022em;
  font-weight: 700;
  margin-top: 14px;
}
.tradepay-root .tp-grad-text {
  background: linear-gradient(180deg, #0F172A 0%, #334155 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.tradepay-root .tp-grad-text-darker {
  background: linear-gradient(135deg, #0F172A 0%, #475569 80%, #64748B 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* ============== Buttons ============== */
.tradepay-root .tp-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
  color: #F8FAFC;
  font-weight: 600; font-size: 14px;
  border: none;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.08) inset,
    0 0 0 1px rgba(15,23,42,0.9),
    0 12px 28px -10px rgba(15,23,42,0.55);
  transition: transform .15s ease, box-shadow .15s ease;
  position: relative;
}
.tradepay-root .tp-btn-primary::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(249,115,22,0.32), transparent 35%, transparent 70%, rgba(249,115,22,0.18));
  z-index: -1;
  filter: blur(6px);
  opacity: 0.7;
}
.tradepay-root .tp-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.1) inset,
    0 0 0 1px rgba(15,23,42,1),
    0 16px 38px -12px rgba(15,23,42,0.7);
}
.tradepay-root .tp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.tradepay-root .tp-btn-primary.lg { padding: 14px 22px; font-size: 15px; border-radius: 12px; }
.tradepay-root .tp-btn-primary.full { width: 100%; justify-content: center; }

.tradepay-root .tp-btn-ghost {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid rgba(15,23,42,0.16);
  background: rgba(255,255,255,0.6);
  color: var(--tp-slate-700);
  font-weight: 500;
  font-size: 14px;
  transition: all .15s ease;
}
.tradepay-root .tp-btn-ghost:hover {
  border-color: rgba(15,23,42,0.32);
  background: rgba(255,255,255,1);
  color: var(--tp-slate-900);
}
.tradepay-root .tp-btn-ghost.lg { padding: 14px 22px; font-size: 15px; border-radius: 12px; }

/* ============== Nav ============== */
.tradepay-root .tp-apply-nav {
  position: sticky; top: 0; z-index: 50;
  padding: 16px 0;
}
.tradepay-root .tp-apply-nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 10px 16px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(15,23,42,0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 14px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 8px 26px -16px rgba(15,23,42,0.25);
  margin-left: 24px; margin-right: 24px;
}
.tradepay-root .tp-brand { display: flex; align-items: center; gap: 10px; }
.tradepay-root .tp-brand-mark {
  width: 30px; height: 30px; border-radius: 8px;
  background: linear-gradient(135deg, #0F172A 0%, #334155 100%);
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px -6px rgba(15,23,42,0.45);
  position: relative;
}
.tradepay-root .tp-brand-mark::after {
  content: "";
  position: absolute; inset: -1px;
  border-radius: inherit;
  background: linear-gradient(120deg, rgba(249,115,22,0.28), transparent 60%);
  z-index: -1;
  filter: blur(5px);
}
.tradepay-root .tp-brand-word {
  font-weight: 700; font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--tp-slate-900);
}
.tradepay-root .tp-brand-sub { color: var(--tp-slate-500); font-weight: 400; }
.tradepay-root .tp-apply-nav-cta { display: flex; align-items: center; gap: 8px; }
@media (max-width: 640px) {
  .tradepay-root .tp-apply-nav-inner { margin-left: 12px; margin-right: 12px; padding: 8px 12px; }
  .tradepay-root .tp-brand-sub { display: none; }
}

/* ============== Hero ============== */
.tradepay-root .tp-hero {
  position: relative;
  padding: 64px 0 64px;
  overflow: hidden;
}
.tradepay-root .tp-mesh {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 60% 50% at 12% 0%, rgba(15,23,42,0.06), transparent 60%),
    radial-gradient(ellipse 70% 50% at 88% 30%, rgba(249,115,22,0.05), transparent 60%),
    radial-gradient(ellipse 80% 60% at 50% 95%, rgba(51,65,85,0.04), transparent 60%);
}
.tradepay-root .tp-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 85%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 85%);
}
.tradepay-root .tp-noise {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
}
.tradepay-root .tp-noise::before {
  content: "";
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.5; pointer-events: none;
}
.tradepay-root .tp-apply-hero-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  position: relative; z-index: 1;
}
.tradepay-root .tp-hero-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: 48px;
  align-items: start;
  position: relative;
}

/* Eyebrow pill */
.tradepay-root .tp-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(15,23,42,0.10);
  box-shadow: 0 6px 16px -6px rgba(15,23,42,0.12);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--tp-slate-700);
}
.tradepay-root .tp-pill-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--tp-slate-700);
  box-shadow: 0 0 0 2px rgba(15,23,42,0.10);
  display: inline-block;
}
.tradepay-root .tp-pill-dot-orange {
  background: var(--tp-orange);
  box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 12px rgba(249,115,22,0.7);
  animation: tpPulseOrange 2.4s ease-in-out infinite;
}
@keyframes tpPulseOrange {
  0%, 100% { box-shadow: 0 0 0 2px rgba(249,115,22,0.22), 0 0 12px rgba(249,115,22,0.6); }
  50% { box-shadow: 0 0 0 4px rgba(249,115,22,0.32), 0 0 18px rgba(249,115,22,0.85); }
}

.tradepay-root .tp-hero-sub {
  margin-top: 22px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--tp-slate-600);
  max-width: 560px;
}
.tradepay-root .tp-hero-sub strong { color: var(--tp-slate-900); font-weight: 600; }
.tradepay-root .tp-hero-ctas {
  margin-top: 26px;
  display: flex; flex-wrap: wrap; gap: 10px;
}

/* Trust strip */
.tradepay-root .tp-trust-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: rgba(15,23,42,0.10);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(15,23,42,0.08);
  margin-top: 28px;
  max-width: 580px;
}
.tradepay-root .tp-trust-cell {
  background: rgba(255,255,255,0.85);
  padding: 12px 14px;
}
.tradepay-root .tp-trust-num {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--tp-slate-900);
  font-variant-numeric: tabular-nums;
}
.tradepay-root .tp-trust-pct {
  color: var(--tp-slate-500);
  font-weight: 500;
  font-size: 0.65em;
  margin-left: 2px;
}
.tradepay-root .tp-trust-lbl {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--tp-slate-500);
  margin-top: 3px;
  font-weight: 500;
}

/* ============== Hero stage (3D scene) ============== */
.tradepay-root .tp-hero-right { position: relative; }
.tradepay-root .tp-hero-scene {
  perspective: 1400px;
  perspective-origin: 50% 40%;
}
.tradepay-root .tp-hero-stage {
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}
.tradepay-root .tp-hero-stage:hover {
  transform: rotateY(-3deg) rotateX(2deg) translateY(-4px);
}
@media (prefers-reduced-motion: no-preference) {
  .tradepay-root .tp-hero-stage {
    animation: tpFloat 9s ease-in-out infinite;
  }
}
@keyframes tpFloat {
  0%, 100% { transform: translateY(0) rotateY(0deg) rotateX(0deg); }
  50%      { transform: translateY(-8px) rotateY(-0.6deg) rotateX(0.4deg); }
}

/* ============== Offer card ============== */
.tradepay-root .tp-offer-card {
  background: #FFFFFF;
  border: 1px solid rgba(15,23,42,0.10);
  border-radius: 18px;
  overflow: hidden;
  box-shadow:
    0 1px 0 rgba(255,255,255,1) inset,
    0 30px 70px -22px rgba(15,23,42,0.30),
    0 12px 28px -10px rgba(15,23,42,0.18);
  position: relative;
  z-index: 1;
}
.tradepay-root .tp-offer-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .tp-status-pill {
  position: relative;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 2px 0;
  overflow: hidden;
  border-radius: 4px;
}
.tradepay-root .tp-status-pill-scan {
  position: absolute;
  left: -30%; top: 0; bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.18) 50%, transparent 100%);
  pointer-events: none;
}
@media (prefers-reduced-motion: no-preference) {
  .tradepay-root .tp-status-pill-scan {
    animation: tpStatusScan 6s ease-in-out infinite;
  }
}
@keyframes tpStatusScan {
  0%   { transform: translateX(0); opacity: 0; }
  8%   { opacity: 1; }
  50%  { transform: translateX(280%); opacity: 1; }
  92%  { opacity: 0; }
  100% { transform: translateX(280%); opacity: 0; }
}
.tradepay-root .tp-status-pill-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--tp-slate-700);
}
.tradepay-root .tp-status-pill-quiet { color: var(--tp-slate-700); }
.tradepay-root .tp-live-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: var(--tp-orange);
  box-shadow: 0 0 0 3px rgba(249,115,22,0.18), 0 0 14px rgba(249,115,22,0.6);
  animation: tpPulseOrange 2.4s ease-in-out infinite;
}
.tradepay-root .tp-offer-card-sub {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--tp-slate-500);
  font-weight: 500;
}

.tradepay-root .tp-offer-card-project {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
  gap: 12px;
}
.tradepay-root .tp-offer-card-right { text-align: right; }
.tradepay-root .tp-offer-card-eyebrow {
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--tp-slate-500);
  font-weight: 600;
}
.tradepay-root .tp-offer-card-amount {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--tp-slate-900);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.tradepay-root .tp-offer-card-match {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  color: var(--tp-slate-900);
  font-variant-numeric: tabular-nums;
}
.tradepay-root .tp-offer-card-match-sub {
  color: var(--tp-slate-500);
  font-weight: 500;
  font-size: 0.7em;
}

.tradepay-root .tp-offer-card-rows {
  padding: 14px 18px 8px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .tp-offer-card-row-head {
  display: grid;
  grid-template-columns: 4fr 3fr 2fr 2fr;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--tp-slate-500);
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .ta-right { text-align: right; }
.tradepay-root .tabular { font-variant-numeric: tabular-nums; }
.tradepay-root .tp-offer-card-row {
  display: grid;
  grid-template-columns: 4fr 3fr 2fr 2fr;
  align-items: center;
  padding: 10px 0;
  font-size: 12.5px;
  color: var(--tp-slate-600);
}
.tradepay-root .tp-offer-card-row.tp-offer-row-primary {
  background: linear-gradient(90deg, rgba(249,115,22,0.05), rgba(249,115,22,0));
  margin: 0 -18px;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid rgba(249,115,22,0.18);
}
.tradepay-root .tp-row-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
.tradepay-root .tp-row-name { color: var(--tp-slate-700); font-weight: 500; }
.tradepay-root .tp-offer-row-primary .tp-row-name { color: var(--tp-slate-900); font-weight: 600; }
.tradepay-root .tp-row-strong { font-weight: 600; color: var(--tp-slate-900); }
.tradepay-root .tp-star {
  color: var(--tp-orange);
  font-size: 14px;
  line-height: 1;
  font-weight: 700;
}
.tradepay-root .tp-row-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--tp-slate-400);
  display: inline-block;
}
.tradepay-root .tp-row-recommend {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--tp-orange-deep);
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(249,115,22,0.08);
  border: 1px solid rgba(249,115,22,0.20);
  margin-left: 4px;
}

.tradepay-root .tp-stat-strip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgba(15,23,42,0.06);
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
}
.tradepay-root .tp-stat-cell {
  padding: 12px 14px;
  text-align: center;
  border-right: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .tp-stat-cell:last-child { border-right: 0; }
.tradepay-root .tp-stat-num {
  font-size: 17px;
  font-weight: 700;
  color: var(--tp-slate-900);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.tradepay-root .tp-stat-lbl {
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--tp-slate-500);
  margin-top: 3px;
  font-weight: 500;
}

.tradepay-root .tp-offer-card-foot {
  padding: 14px 18px;
  background: rgba(15,23,42,0.02);
  border-top: 1px solid rgba(15,23,42,0.06);
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.tradepay-root .tp-offer-card-foot-l {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--tp-slate-600);
  font-weight: 500;
}
.tradepay-root .tp-offer-card-foot span {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10.5px;
  color: var(--tp-slate-600);
}
.tradepay-root .tp-funded-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.20em;
  padding: 4px 9px;
  border-radius: 5px;
  color: #FFFFFF;
  background: linear-gradient(180deg, #F97316 0%, #EA580C 100%);
  box-shadow: 0 0 0 1px rgba(234,88,12,0.5), 0 4px 14px -4px rgba(249,115,22,0.55);
}
.tradepay-root .tp-funded-chip-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: #FFFFFF;
  box-shadow: 0 0 6px rgba(255,255,255,0.9);
}
.tradepay-root .tp-offer-card-cta {
  /* Cap the CTA at a readable button width on wide desktops. */
  margin: 14px auto 18px;
  width: 100%;
  max-width: 360px;
  display: flex;
  justify-content: center;
  padding: 12px;
  font-size: 13px;
}

/* ============== Floating chips ============== */
.tradepay-root .tp-chip {
  position: absolute;
  z-index: 8;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.95);
  border: 1px solid rgba(15,23,42,0.10);
  color: var(--tp-slate-800);
  font-size: 10.5px;
  white-space: nowrap;
  box-shadow: 0 10px 24px -10px rgba(15,23,42,0.25);
  display: inline-flex; align-items: center; gap: 6px;
  backdrop-filter: blur(8px);
  animation: tpChipFloat 9s ease-in-out infinite;
}
.tradepay-root .tp-chip-orange {
  background: linear-gradient(180deg, #FFFFFF 0%, #FEFCE8 100%);
  border-color: rgba(249,115,22,0.32);
  box-shadow:
    0 0 0 1px rgba(249,115,22,0.12),
    0 10px 24px -8px rgba(249,115,22,0.35);
}
.tradepay-root .tp-chip-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--tp-slate-500);
}
.tradepay-root .tp-chip-dot-orange {
  background: var(--tp-orange);
  box-shadow: 0 0 0 2px rgba(249,115,22,0.18), 0 0 8px rgba(249,115,22,0.6);
}
.tradepay-root .tp-chip-k {
  color: var(--tp-slate-500);
  letter-spacing: 0.14em;
  font-size: 9.5px;
  font-weight: 600;
}
.tradepay-root .tp-chip-v {
  color: var(--tp-slate-900);
  font-weight: 600;
}
@keyframes tpChipFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@media (prefers-reduced-motion: no-preference) {
  .tradepay-root .tp-chip-pulse {
    animation: tpChipFloat 9s ease-in-out infinite, tpChipPulse 5s ease-in-out infinite;
  }
  .tradepay-root .tp-chip-funded {
    animation: tpChipFloat 9s ease-in-out infinite, tpChipFundedPulse 4.5s ease-in-out infinite;
  }
}
@keyframes tpChipPulse {
  0%, 100% {
    box-shadow:
      0 0 0 1px rgba(249,115,22,0.12),
      0 10px 24px -8px rgba(249,115,22,0.35);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(249,115,22,0.22),
      0 14px 32px -8px rgba(249,115,22,0.55);
  }
}
@keyframes tpChipFundedPulse {
  0%, 100% {
    box-shadow:
      0 10px 24px -10px rgba(15,23,42,0.25),
      0 0 0 1px rgba(249,115,22,0.0);
  }
  50% {
    box-shadow:
      0 12px 28px -10px rgba(15,23,42,0.3),
      0 0 0 2px rgba(249,115,22,0.18),
      0 0 18px rgba(249,115,22,0.20);
  }
}

/* ============== Primary CTA glow ============== */
@media (prefers-reduced-motion: no-preference) {
  .tradepay-root .tp-cta-glow {
    animation: tpCtaGlow 4s ease-in-out infinite;
  }
}
@keyframes tpCtaGlow {
  0%, 100% {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.08) inset,
      0 0 0 1px rgba(15,23,42,0.9),
      0 12px 28px -10px rgba(15,23,42,0.55),
      0 0 0 0 rgba(249,115,22,0.0),
      0 0 16px rgba(249,115,22,0.10);
  }
  50% {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.10) inset,
      0 0 0 1px rgba(15,23,42,1),
      0 16px 36px -12px rgba(15,23,42,0.65),
      0 0 0 3px rgba(249,115,22,0.18),
      0 0 28px rgba(249,115,22,0.32);
  }
}

/* ============== Apply flow surfaces ============== */
.tradepay-root .tp-apply-main {
  position: relative; z-index: 1;
  padding: 40px 0 80px;
}
.tradepay-root .tp-apply-container {
  /* Tighter on desktop so offers + form columns don't sprawl. */
  max-width: 640px;
  margin: 0 auto;
  padding: 0 24px;
  position: relative; z-index: 1;
}
.tradepay-root .tp-apply-footer {
  position: relative; z-index: 1;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(15,23,42,0.08);
  padding: 22px 0;
  margin-top: 60px;
}
.tradepay-root .tp-ecoa {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--tp-slate-500);
}

/* Step container — same surface as landing offer card. */
.tradepay-root .tp-step {
  border-radius: 18px;
  padding: 32px 28px;
  position: relative;
}
.tradepay-root .tp-step-card {
  background: #FFFFFF;
  border: 1px solid rgba(15,23,42,0.10);
  box-shadow:
    0 1px 0 rgba(255,255,255,1) inset,
    0 30px 70px -22px rgba(15,23,42,0.20),
    0 12px 28px -10px rgba(15,23,42,0.12);
}
.tradepay-root .tp-step-tag {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 10px;
  letter-spacing: 0.20em;
  font-weight: 700;
  color: var(--tp-slate-700);
  padding: 5px 11px;
  border-radius: 6px;
  background: var(--tp-slate-100);
  border: 1px solid rgba(15,23,42,0.06);
  text-transform: uppercase;
}
.tradepay-root .tp-step-body {
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--tp-slate-600);
}
.tradepay-root .tp-step-actions {
  margin-top: 28px;
  display: flex; gap: 10px; flex-wrap: wrap;
}

/* Disclaimer */
.tradepay-root .tp-consent-box {
  margin-top: 22px;
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--tp-slate-50);
  border: 1px solid rgba(15,23,42,0.08);
}
.tradepay-root .tp-consent-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--tp-slate-700);
}
.tradepay-root .tp-consent-toggle {
  margin-top: 18px;
  display: flex; gap: 12px; align-items: flex-start;
  font-size: 13px;
  line-height: 1.55;
  color: var(--tp-slate-700);
  cursor: pointer;
}
.tradepay-root .tp-consent-toggle input {
  margin-top: 3px;
  width: 18px; height: 18px;
  accent-color: var(--tp-slate-900);
}

/* Form */
.tradepay-root .tp-form {
  margin-top: 24px;
  display: grid; gap: 16px;
}
.tradepay-root .tp-form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
@media (max-width: 540px) {
  .tradepay-root .tp-form-row { grid-template-columns: 1fr; }
}
.tradepay-root .tp-form label {
  display: grid; gap: 6px;
}
.tradepay-root .tp-form-label {
  font-size: 10.5px;
  letter-spacing: 0.16em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--tp-slate-500);
}
.tradepay-root .tp-form input {
  font-family: inherit;
  height: 48px;
  border-radius: 10px;
  border: 1px solid rgba(15,23,42,0.16);
  background: #FFFFFF;
  padding: 0 16px;
  font-size: 15px;
  color: var(--tp-slate-900);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.tradepay-root .tp-form input:focus {
  outline: none;
  border-color: var(--tp-slate-900);
  box-shadow:
    0 0 0 3px rgba(15,23,42,0.10),
    0 0 0 4px rgba(249,115,22,0.12);
}
.tradepay-root .tp-form-helper {
  font-size: 11px;
  color: var(--tp-slate-500);
  margin-top: 2px;
}
.tradepay-root .tp-form-submit {
  margin-top: 8px;
}
.tradepay-root .tp-form-error {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(220, 38, 38, 0.06);
  border: 1px solid rgba(220, 38, 38, 0.25);
  font-size: 13px;
  color: #B91C1C;
}

/* Engine step */
.tradepay-root .tp-engine .tp-h2 { margin-top: 18px; }
.tradepay-root .tp-engine-bar {
  margin-top: 24px;
}
.tradepay-root .tp-engine-bar-track {
  height: 6px; border-radius: 999px;
  background: rgba(15,23,42,0.08);
  overflow: hidden;
  position: relative;
}
.tradepay-root .tp-engine-bar-fill {
  height: 100%; width: 80%;
  background: linear-gradient(90deg, var(--tp-slate-900) 0%, var(--tp-slate-700) 60%, var(--tp-orange) 100%);
  border-radius: 999px;
  animation: tpFill 4s ease-in-out infinite;
}
@keyframes tpFill {
  0%, 100% { width: 80%; }
  50% { width: 95%; }
}
.tradepay-root .tp-engine-stages {
  margin-top: 22px;
  display: grid; gap: 10px;
  list-style: none; padding: 0;
}
.tradepay-root .tp-engine-stages li {
  display: flex; align-items: center; gap: 12px;
  font-size: 13px;
  color: var(--tp-slate-500);
  transition: color .25s ease, opacity .25s ease;
  opacity: 0.6;
}
.tradepay-root .tp-engine-stages li.on {
  color: var(--tp-slate-900);
  opacity: 1;
}
.tradepay-root .tp-engine-tick {
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--tp-slate-100);
  border: 1px solid rgba(15,23,42,0.06);
  color: var(--tp-slate-500);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.tradepay-root .tp-engine-tick.on {
  background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
  border-color: transparent;
  color: #FFFFFF;
  box-shadow: 0 0 0 1px rgba(249,115,22,0.18), 0 6px 16px -4px rgba(15,23,42,0.45);
}

/* Offers screen */
.tradepay-root .tp-offers { display: grid; gap: 20px; }
.tradepay-root .tp-offers-head {
  text-align: center;
  padding: 0 8px 8px;
}
.tradepay-root .tp-offers-head .tp-step-tag { margin: 0 auto; }
.tradepay-root .tp-offers-head .tp-h2 { margin-top: 18px; }
.tradepay-root .tp-offers-head .tp-step-body {
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
}
.tradepay-root .tp-offers-meta {
  margin-top: 14px;
  font-size: 11px;
  letter-spacing: 0.18em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--tp-slate-500);
}

.tradepay-root .tp-offers-hero-scene {
  margin-top: 4px;
}

/* Term toggle inside hero offer card */
.tradepay-root .tp-term-row {
  padding: 14px 18px 0;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.tradepay-root .tp-term-label {
  font-size: 10px;
  letter-spacing: 0.16em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--tp-slate-500);
}
.tradepay-root .tp-term-toggle {
  display: inline-flex; padding: 4px; border-radius: 10px;
  background: var(--tp-slate-100);
  gap: 4px;
  border: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .tp-term-toggle button {
  border: none; background: transparent;
  padding: 7px 13px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tp-slate-500);
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.tradepay-root .tp-term-toggle button.on {
  background: #FFFFFF;
  color: var(--tp-slate-900);
  box-shadow: 0 4px 12px -4px rgba(15,23,42,0.20);
}

/* Offers list toggle */
.tradepay-root .tp-offers-more { margin-top: 8px; }
.tradepay-root .tp-offers-toggle {
  width: 100%;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border-radius: 10px;
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(15,23,42,0.16);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--tp-slate-700);
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease, color .15s ease;
}
.tradepay-root .tp-offers-toggle:hover {
  border-color: rgba(15,23,42,0.32);
  background: rgba(255,255,255,1);
  color: var(--tp-slate-900);
}
.tradepay-root .tp-offers-chevron {
  transition: transform .2s ease;
  display: inline-block;
}
.tradepay-root .tp-offers-chevron.open { transform: rotate(180deg); }
.tradepay-root .tp-offers-list {
  margin-top: 14px;
  padding: 0;
  list-style: none;
  display: grid; gap: 12px;
}
.tradepay-root .tp-offer-card-secondary {
  padding: 18px;
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.tradepay-root .tp-offer-card-secondary .tp-offer-card-head {
  padding: 0 0 12px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
}
.tradepay-root .tp-offer-card-row-stat {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px 0;
  border-bottom: 0;
}
.tradepay-root .tp-row-stat-k {
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--tp-slate-500);
}
.tradepay-root .tp-row-stat-v {
  margin-top: 3px;
  font-size: 16px;
  font-weight: 700;
  color: var(--tp-slate-900);
  font-variant-numeric: tabular-nums;
}
.tradepay-root .tp-row-stat-v.sm { font-size: 12px; font-weight: 600; }
.tradepay-root .tp-offer-card-secondary:hover {
  transform: translateY(-3px);
  border-color: rgba(15,23,42,0.16);
  box-shadow:
    0 1px 0 rgba(255,255,255,1) inset,
    0 30px 70px -22px rgba(15,23,42,0.25);
}
.tradepay-root .tp-offer-card-secondary.is-chosen {
  border-color: rgba(249,115,22,0.4);
  box-shadow:
    0 1px 0 rgba(255,255,255,1) inset,
    0 30px 70px -22px rgba(249,115,22,0.30),
    0 0 0 1px rgba(249,115,22,0.18);
}
.tradepay-root .tp-offer-secondary-cta {
  width: 100%;
  justify-content: center;
  margin-top: 6px;
}

/* ============== Responsive ============== */
@media (max-width: 960px) {
  .tradepay-root .tp-hero-grid { grid-template-columns: 1fr; }
  .tradepay-root .tp-apply-trust-strip { grid-template-columns: repeat(2, 1fr); }
  .tradepay-root .tp-hero-right { margin-top: 36px; }
}
@media (max-width: 540px) {
  .tradepay-root .tp-step { padding: 24px 20px; }
  .tradepay-root .tp-offer-card-amount { font-size: 24px; }
  .tradepay-root .tp-chip { font-size: 10px; padding: 5px 9px; }
  .tradepay-root .tp-offer-card-row-head,
  .tradepay-root .tp-offer-card-row { grid-template-columns: 5fr 4fr 3fr 3fr; font-size: 11.5px; }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .tradepay-root *,
  .tradepay-root *::before,
  .tradepay-root *::after {
    animation: none !important;
    transition: none !important;
  }
  .tradepay-root .tp-hero-stage,
  .tradepay-root .tp-hero-stage:hover {
    transform: none !important;
  }
}

/* ============== STEP BACK BUTTON ============== */
.tradepay-root .tp-step-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: rgba(15, 23, 42, 0.05);
  color: #334155;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: background 160ms ease, transform 160ms ease;
  min-height: 36px;
}
.tradepay-root .tp-step-back:hover { background: rgba(249, 115, 22, 0.08); border-color: rgba(249, 115, 22, 0.22); color: #c2410c; }
.tradepay-root .tp-step-back:active { transform: translateY(1px); }

/* ============== HOW IT WORKS ============== */
.tradepay-root .tp-how {
  margin-top: 96px;
  padding-top: 24px;
  scroll-margin-top: 80px;
  position: relative;
  z-index: 1;
}
.tradepay-root .tp-how-eyebrow,
.tradepay-root .tp-calc-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(249, 115, 22, 0.08);
  border: 1px solid rgba(249, 115, 22, 0.22);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #c2410c;
  text-transform: uppercase;
}
.tradepay-root .tp-how-title,
.tradepay-root .tp-calc-title { margin: 16px 0 28px; letter-spacing: -0.025em; }
.tradepay-root .tp-how-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.tradepay-root .tp-how-step { padding: 22px 20px; border-radius: 18px; position: relative; }
.tradepay-root .tp-how-step-n {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  font-weight: 700;
  color: #ea580c;
  letter-spacing: 0.08em;
}
.tradepay-root .tp-how-step-title {
  margin-top: 10px;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
}
.tradepay-root .tp-how-step-body {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: #475569;
}

/* ============== CALCULATOR ============== */
.tradepay-root .tp-calc {
  margin-top: 64px;
  padding-bottom: 96px;
  position: relative;
  z-index: 1;
}
.tradepay-root .tp-calc-card { padding: 28px; border-radius: 22px; max-width: 760px; }
.tradepay-root .tp-calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.tradepay-root .tp-calc-field { display: flex; flex-direction: column; gap: 10px; }
.tradepay-root .tp-calc-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
}
.tradepay-root .tp-calc-label strong {
  font-size: 18px;
  letter-spacing: -0.02em;
  color: #0f172a;
  text-transform: none;
  font-feature-settings: 'tnum';
}
.tradepay-root .tp-calc-range {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #0f172a, #f97316);
  outline: none;
  margin: 6px 0;
}
.tradepay-root .tp-calc-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #f97316;
  box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
  cursor: pointer;
}
.tradepay-root .tp-calc-range::-moz-range-thumb {
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #f97316;
  box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
  cursor: pointer;
}
.tradepay-root .tp-calc-range-foot {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}
.tradepay-root .tp-calc-terms { display: flex; flex-wrap: wrap; gap: 8px; }
.tradepay-root .tp-calc-term {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: #334155;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 160ms ease;
  min-width: 56px;
  min-height: 40px;
}
.tradepay-root .tp-calc-term:hover {
  background: rgba(249, 115, 22, 0.06);
  border-color: rgba(249, 115, 22, 0.22);
}
.tradepay-root .tp-calc-term.is-active {
  background: linear-gradient(135deg, #0f172a, #ea580c);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 6px 14px rgba(249, 115, 22, 0.3);
}

/* Credit-tier dropdown — single native select, slate+orange accent. */
.tradepay-root .tp-calc-tier-field {
  grid-column: 1 / -1;
  margin-top: 18px;
}
.tradepay-root .tp-calc-field--full { grid-column: 1 / -1; }
.tradepay-root .tp-calc-select-wrap {
  position: relative;
  display: block;
}
.tradepay-root .tp-calc-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  padding: 14px 40px 14px 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all 160ms ease;
  min-height: 52px;
  font-variant-numeric: tabular-nums;
}
.tradepay-root .tp-calc-select:hover {
  background: rgba(249, 115, 22, 0.06);
  border-color: rgba(249, 115, 22, 0.22);
}
.tradepay-root .tp-calc-select:focus {
  outline: none;
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.2);
}
.tradepay-root .tp-calc-select-caret {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f97316;
  pointer-events: none;
}

.tradepay-root .tp-calc-result {
  margin-top: 24px;
  padding: 20px 22px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.06), rgba(15, 23, 42, 0.04));
  border: 1px solid rgba(15, 23, 42, 0.1);
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
  align-items: center;
}
.tradepay-root .tp-calc-result-k {
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
}
.tradepay-root .tp-calc-result-v {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: #0f172a;
  line-height: 1;
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.tradepay-root .tp-calc-result-unit {
  font-size: 16px;
  color: #64748b;
  font-weight: 600;
  margin-left: 2px;
}
.tradepay-root .tp-calc-result-side {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.tradepay-root .tp-calc-result-vs {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #0f172a;
  margin-top: 4px;
  font-feature-settings: 'tnum';
}
.tradepay-root .tp-calc-cta { margin-top: 18px; }
.tradepay-root .tp-calc-disc {
  margin-top: 12px;
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.55;
}

/* ============== RESPONSIVE — HOW / CALC ============== */
@media (max-width: 960px) {
  .tradepay-root .tp-how-grid { grid-template-columns: repeat(2, 1fr); }
  .tradepay-root .tp-calc-grid { grid-template-columns: 1fr; }
  .tradepay-root .tp-calc-result { grid-template-columns: 1fr; }
}
@media (max-width: 540px) {
  .tradepay-root .tp-how { margin-top: 72px; }
  .tradepay-root .tp-how-grid { grid-template-columns: 1fr; gap: 12px; }
  .tradepay-root .tp-how-step { padding: 18px 16px; }
  .tradepay-root .tp-calc-card { padding: 22px 18px; }
  .tradepay-root .tp-calc-result { padding: 16px 18px; }
  .tradepay-root .tp-calc-result-v { font-size: 32px; }
  .tradepay-root .tp-calc-result-side { grid-template-columns: 1fr 1fr; }
  .tradepay-root .tp-apply-container { padding: 0 18px !important; }
  /* keep inputs touch-target sized */
  .tradepay-root .tp-form input { min-height: 48px; font-size: 16px; }
}

/* ============== VIEWPORT LOCK (no horizontal shake) ============== */
html, body { overflow-x: hidden; width: 100%; max-width: 100%; }
.tradepay-root, .tradepay-root * { max-width: 100%; }
.tradepay-root img, .tradepay-root svg { max-width: 100%; height: auto; }
.tradepay-root .tp-apply-footer { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
`;
