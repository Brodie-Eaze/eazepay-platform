/**
 * TradePay · Onboarding wizard (/tradepay/onboarding)
 *
 * 5-step KYB form. Aurean-style chrome (.mpf-* namespace) + TradePay
 * orange palette. Form state is local (useState); on submit the user
 * lands at /tradepay/success.
 *
 * Step 1 · Business info     · legal name, EIN, address, contractor license
 * Step 2 · Primary contact   · owner / operator name, email, phone
 * Step 3 · Banking + payout  · routing + account, payout cadence
 * Step 4 · Documents         · contractor license, GL insurance, W-9, voided check
 * Step 5 · Review + e-sign   · typed signature, MSA acceptance
 *
 * On submit we don't actually POST anywhere yet — this is a UI
 * scaffold that wires to /api/onboarding/tradepay later. The flow
 * still validates each step before letting the user advance.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step1 = {
  legalName: string;
  ein: string;
  practiceType: string;
  npi: string;
  state: string;
  zip: string;
  streetAddr: string;
};
type Step2 = {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRole: string;
};
type Step3 = {
  bankName: string;
  routing: string;
  account: string;
  cadence: 'next-day' | 'weekly';
};
type Step4 = {
  providerLicense: boolean;
  generalLiability: boolean;
  w9: boolean;
  voidedCheck: boolean;
};
type Step5 = {
  signatureName: string;
  msa: boolean;
};

const STEPS = [
  { n: 1, t: 'Business info' },
  { n: 2, t: 'Owner contact' },
  { n: 3, t: 'Banking + payout' },
  { n: 4, t: 'Documents' },
  { n: 5, t: 'Review + sign' },
];

export default function TradePayOnboarding(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [s1, setS1] = useState<Step1>({
    legalName: '',
    ein: '',
    practiceType: 'roofing',
    npi: '',
    state: '',
    zip: '',
    streetAddr: '',
  });
  const [s2, setS2] = useState<Step2>({
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    ownerRole: 'Owner / Founder',
  });
  const [s3, setS3] = useState<Step3>({
    bankName: '',
    routing: '',
    account: '',
    cadence: 'next-day',
  });
  const [s4, setS4] = useState<Step4>({
    providerLicense: false,
    generalLiability: false,
    w9: false,
    voidedCheck: false,
  });
  const [s5, setS5] = useState<Step5>({
    signatureName: '',
    msa: false,
  });

  const v1 =
    s1.legalName.length > 1 &&
    s1.ein.length >= 9 &&
    s1.state.length === 2 &&
    s1.zip.length >= 5 &&
    s1.streetAddr.length > 5;
  const v2 = s2.ownerName.length > 1 && s2.ownerEmail.includes('@') && s2.ownerPhone.length >= 10;
  const v3 = s3.bankName.length > 1 && s3.routing.length === 9 && s3.account.length >= 4;
  const v4 = s4.providerLicense && s4.generalLiability && s4.w9 && s4.voidedCheck;
  const v5 = s5.signatureName.length > 1 && s5.msa;

  const stepValid = step === 1 ? v1 : step === 2 ? v2 : step === 3 ? v3 : step === 4 ? v4 : v5;

  function next() {
    if (!stepValid) return;
    if (step < 5) setStep(step + 1);
    else router.push('/tradepay/success');
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  return (
    <div className="mpf-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="mpf-nav">
        <div className="mpf-container mpf-nav-inner">
          <Link href="/tradepay/start" className="mpf-brand" aria-label="TradePay home">
            <span className="mpf-brand-mark">
              <LogoIcon />
            </span>
            <span className="mpf-brand-word">
              TradePay<span className="mpf-brand-sub">/Homeowner Financing</span>
            </span>
          </Link>
          <div className="mpf-nav-cta-group">
            <span className="mpf-nav-step">
              Step {step} of {STEPS.length} · {STEPS[step - 1]?.t}
            </span>
          </div>
        </div>
      </header>

      <main className="mpf-main">
        <section className="mpf-hero mpf-hero-tight">
          <div className="mpf-container">
            <div className="mpf-eyebrow-pill">
              <span className="mpf-pulse-dot" />
              Activate TradePay · Step 2 of 2
            </div>
            <h1 className="mpf-h1">
              <span className="mpf-grad-teal">Get your business live</span>
              <br />
              <span className="mpf-grad-teal-deep">in under 10 minutes.</span>
            </h1>
            <p className="mpf-hero-sub">
              We&apos;ll verify the business, wire your payout account, and collect the four
              documents required to onboard a lending merchant. No payment is collected here — the
              $10,000 platform fee is invoiced after KYB clears.
            </p>
          </div>
        </section>

        {/* WIZARD */}
        <section className="mpf-section mpf-wiz-section">
          <div className="mpf-container">
            <div className="mpf-wiz">
              <aside className="mpf-wiz-rail">
                {STEPS.map((s) => (
                  <div
                    key={s.n}
                    className={`mpf-wiz-rail-item ${
                      step === s.n ? 'is-active' : step > s.n ? 'is-done' : ''
                    }`}
                  >
                    <div className="mpf-wiz-rail-n">{step > s.n ? '✓' : s.n}</div>
                    <div className="mpf-wiz-rail-t">{s.t}</div>
                  </div>
                ))}
              </aside>

              <div className="mpf-wiz-body">
                {step === 1 && <Step1Form s={s1} set={setS1} />}
                {step === 2 && <Step2Form s={s2} set={setS2} />}
                {step === 3 && <Step3Form s={s3} set={setS3} />}
                {step === 4 && <Step4Form s={s4} set={setS4} />}
                {step === 5 && <Step5Form s={s5} set={setS5} all={{ s1, s2, s3, s4 }} />}

                <div className="mpf-wiz-actions">
                  <button
                    type="button"
                    className="mpf-btn-ghost"
                    onClick={back}
                    disabled={step === 1}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={`mpf-btn-primary mpf-btn-lg ${stepValid ? '' : 'is-disabled'}`}
                    onClick={next}
                    disabled={!stepValid}
                  >
                    {step === 5 ? 'Submit application' : 'Continue'}
                    <ArrowIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mpf-footer">
        <div className="mpf-container mpf-footer-inner">
          <div className="mpf-footer-brand">
            <LogoIcon />
            <span>TradePay · A vertical of EazePay</span>
          </div>
          <div className="mpf-footer-meta">
            NMLS #2456701 · 7-year audit retention · FCRA / ECOA / TILA compliant
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- step components ----------------------- */

function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="mpf-fld">
      <span className="mpf-fld-l">{label}</span>
      {children}
      {help ? <span className="mpf-fld-help">{help}</span> : null}
    </label>
  );
}

function Step1Form({ s, set }: { s: Step1; set: (x: Step1) => void }) {
  return (
    <div className="mpf-wiz-body-inner">
      <h2 className="mpf-h2">Tell us about your business</h2>
      <p className="mpf-section-sub">
        We pull the EIN against IRS records (60 seconds) and verify the contractor license against
        the state board where required.
      </p>
      <div className="mpf-fld-grid">
        <Field label="Legal business name">
          <input
            type="text"
            placeholder="Holloway Roofing Co., LLC"
            value={s.legalName}
            onChange={(e) => set({ ...s, legalName: e.target.value })}
          />
        </Field>
        <Field label="Trade type">
          <select
            value={s.practiceType}
            onChange={(e) => set({ ...s, practiceType: e.target.value })}
          >
            <option value="roofing">Roofing</option>
            <option value="hvac">HVAC + mechanical</option>
            <option value="solar">Solar + battery</option>
            <option value="remodel">Remodel · kitchen / bath / ADU</option>
            <option value="exterior">Exterior · windows / siding / decking</option>
          </select>
        </Field>
        <Field label="EIN" help="9 digits, no dash">
          <input
            type="text"
            placeholder="88-1234567"
            value={s.ein}
            onChange={(e) => set({ ...s, ein: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })}
          />
        </Field>
        <Field label="State contractor license # (if applicable)">
          <input
            type="text"
            placeholder="FL-CCC1334567"
            value={s.npi}
            onChange={(e) => set({ ...s, npi: e.target.value })}
          />
        </Field>
        <Field label="Street address">
          <input
            type="text"
            placeholder="1418 Maple Dr"
            value={s.streetAddr}
            onChange={(e) => set({ ...s, streetAddr: e.target.value })}
          />
        </Field>
        <Field label="State / ZIP">
          <div className="mpf-fld-row">
            <input
              type="text"
              placeholder="TX"
              maxLength={2}
              style={{ width: 80 }}
              value={s.state}
              onChange={(e) => set({ ...s, state: e.target.value.toUpperCase() })}
            />
            <input
              type="text"
              placeholder="78701"
              value={s.zip}
              onChange={(e) => set({ ...s, zip: e.target.value })}
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

function Step2Form({ s, set }: { s: Step2; set: (x: Step2) => void }) {
  return (
    <div className="mpf-wiz-body-inner">
      <h2 className="mpf-h2">Primary contact</h2>
      <p className="mpf-section-sub">
        Who signs the lender agreement and receives the funded-loan reports? Usually the business
        owner or a senior operator. They&apos;ll get the partner-portal admin seat.
      </p>
      <div className="mpf-fld-grid">
        <Field label="Full name">
          <input
            type="text"
            placeholder="Carter Holloway"
            value={s.ownerName}
            onChange={(e) => set({ ...s, ownerName: e.target.value })}
          />
        </Field>
        <Field label="Role">
          <select value={s.ownerRole} onChange={(e) => set({ ...s, ownerRole: e.target.value })}>
            <option>Owner / Founder</option>
            <option>General manager</option>
            <option>Operations director</option>
            <option>Sales director</option>
          </select>
        </Field>
        <Field label="Email">
          <input
            type="email"
            placeholder="carter@hollowayroofing.com"
            value={s.ownerEmail}
            onChange={(e) => set({ ...s, ownerEmail: e.target.value })}
          />
        </Field>
        <Field label="Mobile" help="Used for KYB verification SMS">
          <input
            type="tel"
            placeholder="+1 (813) 555-0140"
            value={s.ownerPhone}
            onChange={(e) => set({ ...s, ownerPhone: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function Step3Form({ s, set }: { s: Step3; set: (x: Step3) => void }) {
  return (
    <div className="mpf-wiz-body-inner">
      <h2 className="mpf-h2">Banking + payout</h2>
      <p className="mpf-section-sub">
        Where do funded loans land? Lenders wire directly to this business account, merchant-direct,
        within 48-72 hours of the loan settling. No marketplace intermediary holds funds.
      </p>
      <div className="mpf-fld-grid">
        <Field label="Bank name">
          <input
            type="text"
            placeholder="Chase Business"
            value={s.bankName}
            onChange={(e) => set({ ...s, bankName: e.target.value })}
          />
        </Field>
        <Field label="Payout cadence">
          <select
            value={s.cadence}
            onChange={(e) => set({ ...s, cadence: e.target.value as 'next-day' | 'weekly' })}
          >
            <option value="next-day">Per-loan · next business day</option>
            <option value="weekly">Aggregated · weekly Friday</option>
          </select>
        </Field>
        <Field label="Routing number" help="9 digits">
          <input
            type="text"
            placeholder="021000021"
            value={s.routing}
            onChange={(e) =>
              set({ ...s, routing: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })
            }
          />
        </Field>
        <Field label="Account number">
          <input
            type="text"
            placeholder="••••••••3401"
            value={s.account}
            onChange={(e) => set({ ...s, account: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function Step4Form({ s, set }: { s: Step4; set: (x: Step4) => void }) {
  const docs: Array<{ k: keyof Step4; label: string; body: string }> = [
    {
      k: 'providerLicense',
      label: 'Contractor license',
      body: 'Active state contractor license where required (FL CCC, CA CSLB, etc.) or local business license.',
    },
    {
      k: 'generalLiability',
      label: 'General liability + workers comp COI',
      body: 'Active certificate of insurance showing the business carries general-liability and workers-comp coverage.',
    },
    {
      k: 'w9',
      label: 'W-9 (signed)',
      body: 'Current W-9 for the business entity, matching the EIN entered on step 1.',
    },
    {
      k: 'voidedCheck',
      label: 'Voided check or bank letter',
      body: 'Confirms the routing + account number entered on step 3 belong to the business.',
    },
  ];
  return (
    <div className="mpf-wiz-body-inner">
      <h2 className="mpf-h2">Documents</h2>
      <p className="mpf-section-sub">
        Four documents. You can upload now, or check the box and email them to{' '}
        <a href="mailto:onboarding@eazepay.io" style={{ color: 'var(--mp-teal)' }}>
          onboarding@eazepay.io
        </a>{' '}
        within 24 hours.
      </p>
      <div className="mpf-doc-grid">
        {docs.map((d) => (
          <label key={d.k} className={`mpf-doc-row ${s[d.k] ? 'is-checked' : ''}`}>
            <input
              type="checkbox"
              checked={s[d.k]}
              onChange={(e) => set({ ...s, [d.k]: e.target.checked })}
            />
            <div className="mpf-doc-body">
              <div className="mpf-doc-l">{d.label}</div>
              <div className="mpf-doc-b">{d.body}</div>
            </div>
            <div className="mpf-doc-up">Upload</div>
          </label>
        ))}
      </div>
    </div>
  );
}

function Step5Form({
  s,
  set,
  all,
}: {
  s: Step5;
  set: (x: Step5) => void;
  all: { s1: Step1; s2: Step2; s3: Step3; s4: Step4 };
}) {
  return (
    <div className="mpf-wiz-body-inner">
      <h2 className="mpf-h2">Review &amp; sign</h2>
      <p className="mpf-section-sub">
        Confirm the details below. After you sign, our team configures the account, integrates your
        pixel, trains your staff, and validates the first soft-pull. Up to 5 business days.
      </p>

      <div className="mpf-review">
        <ReviewBlock title="Business">
          <ReviewRow k="Legal name" v={all.s1.legalName || '—'} />
          <ReviewRow k="EIN" v={all.s1.ein || '—'} />
          <ReviewRow k="Contractor type" v={all.s1.practiceType} />
          <ReviewRow
            k="Address"
            v={`${all.s1.streetAddr || '—'}, ${all.s1.state || '—'} ${all.s1.zip || ''}`}
          />
        </ReviewBlock>
        <ReviewBlock title="Owner">
          <ReviewRow k="Name" v={all.s2.ownerName || '—'} />
          <ReviewRow k="Role" v={all.s2.ownerRole} />
          <ReviewRow k="Email" v={all.s2.ownerEmail || '—'} />
          <ReviewRow k="Phone" v={all.s2.ownerPhone || '—'} />
        </ReviewBlock>
        <ReviewBlock title="Banking">
          <ReviewRow k="Bank" v={all.s3.bankName || '—'} />
          <ReviewRow k="Routing" v={all.s3.routing || '—'} />
          <ReviewRow k="Account" v={all.s3.account ? `••••${all.s3.account.slice(-4)}` : '—'} />
          <ReviewRow
            k="Payout"
            v={all.s3.cadence === 'next-day' ? 'Per-loan · next day' : 'Weekly · Friday'}
          />
        </ReviewBlock>
        <ReviewBlock title="Pricing (locked)">
          <ReviewRow k="Platform setup" v="$10,000 · one-time" />
          <ReviewRow k="Per smart-form lead" v="$3 · billed monthly" />
          <ReviewRow k="Origination" v="4% of settled loan · monthly" />
          <ReviewRow k="Monthly platform fee" v="$0" />
        </ReviewBlock>
      </div>

      <div className="mpf-sign">
        <Field label="Type your full legal name to e-sign">
          <input
            type="text"
            placeholder="Carter Holloway"
            value={s.signatureName}
            onChange={(e) => set({ ...s, signatureName: e.target.value })}
          />
        </Field>
        <label className="mpf-co-checkbox">
          <input
            type="checkbox"
            checked={s.msa}
            onChange={(e) => set({ ...s, msa: e.target.checked })}
          />
          <span>
            I agree to the EazePay Master Service Agreement and the pricing above. Signing this form
            is legally binding under the E-Sign Act.
          </span>
        </label>
      </div>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mpf-rev-block">
      <div className="mpf-rev-block-h">{title}</div>
      <div>{children}</div>
    </div>
  );
}
function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="mpf-rev-row">
      <span className="mpf-rev-k">{k}</span>
      <span className="mpf-rev-v">{v}</span>
    </div>
  );
}

/* ----------------------------- icons ----------------------- */

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="3" width="20" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 12h10M12 7v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ================================== CSS ============================== */

const CSS = `
.mpf-root {
  --mp-teal: #EA580C;
  --mp-teal-2: #FB923C;
  --mp-teal-light: #FFF7ED;
  --mp-deep: #431407;
  --mp-ink: #0F172A;
  --mp-ink-2: #1E293B;
  --mp-mute: #64748B;
  --mp-line: rgba(234, 88, 12, 0.12);
  --mp-line-strong: rgba(234, 88, 12, 0.22);

  background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 30%, #FAFAF9 65%, #FFFFFF 100%);
  color: var(--mp-ink);
  font-family: inherit;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  min-height: 100vh;
}
.mpf-root * { box-sizing: border-box; }
.mpf-root a { color: inherit; text-decoration: none; }
.mpf-container { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

/* nav */
.mpf-nav {
  position: sticky; top: 0; z-index: 30;
  background: rgba(255,255,255,0.85);
  border-bottom: 1px solid var(--mp-line);
  backdrop-filter: blur(10px);
}
.mpf-nav-inner {
  max-width: 1180px; margin: 0 auto;
  padding: 14px 32px;
  display: flex; align-items: center; gap: 32px;
}
.mpf-brand {
  display: inline-flex; align-items: center; gap: 10px;
  color: var(--mp-teal);
}
.mpf-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  color: #fff;
}
.mpf-brand-word { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; color: var(--mp-ink); }
.mpf-brand-sub { font-weight: 500; color: var(--mp-mute); margin-left: 2px; }
.mpf-nav-cta-group { margin-left: auto; }
.mpf-nav-step {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.10em; font-weight: 600;
  color: var(--mp-teal);
  padding: 6px 12px;
  background: rgba(234, 88, 12, 0.08);
  border: 1px solid var(--mp-line-strong);
  border-radius: 999px;
}

/* hero */
.mpf-main { position: relative; }
.mpf-hero { padding: 56px 0 16px; }
.mpf-hero-tight { padding-bottom: 0; }
.mpf-eyebrow-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(234, 88, 12, 0.10);
  border: 1px solid var(--mp-line-strong);
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
}
.mpf-pulse-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mp-teal-2);
  box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55);
  animation: mpfPulse 1.6s ease-in-out infinite;
}
@keyframes mpfPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251, 146, 60, 0.55); } 50% { box-shadow: 0 0 0 6px rgba(251, 146, 60, 0); } }
.mpf-h1 {
  margin: 18px 0 14px;
  font-size: clamp(36px, 4.4vw, 52px); font-weight: 700;
  letter-spacing: -0.026em; line-height: 1.05;
  color: var(--mp-ink);
}
.mpf-h2 {
  margin: 0 0 8px;
  font-size: 26px; font-weight: 600; letter-spacing: -0.02em;
  color: var(--mp-ink);
}
.mpf-grad-teal { background: linear-gradient(120deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.mpf-grad-teal-deep { background: linear-gradient(120deg, var(--mp-deep) 0%, var(--mp-teal) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.mpf-hero-sub { margin: 0; max-width: 720px; font-size: 17px; line-height: 1.55; color: var(--mp-ink-2); }
.mpf-section-sub { margin: 0 0 24px; font-size: 14.5px; line-height: 1.55; color: var(--mp-mute); max-width: 640px; }

/* wizard */
.mpf-section { padding: 40px 0 24px; }
.mpf-wiz {
  display: grid; grid-template-columns: 220px 1fr;
  gap: 36px; align-items: start;
}
.mpf-wiz-rail {
  display: flex; flex-direction: column; gap: 4px;
  position: sticky; top: 96px;
}
.mpf-wiz-rail-item {
  display: grid; grid-template-columns: 28px 1fr;
  gap: 12px; align-items: center;
  padding: 11px 12px;
  border-radius: 10px;
  font-size: 13.5px; color: var(--mp-mute);
}
.mpf-wiz-rail-item.is-active {
  background: rgba(234, 88, 12, 0.08);
  border: 1px solid var(--mp-line-strong);
  color: var(--mp-ink);
  font-weight: 600;
}
.mpf-wiz-rail-item.is-done { color: var(--mp-ink-2); }
.mpf-wiz-rail-n {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--mp-line-strong);
  font-size: 11px; font-weight: 700;
  color: var(--mp-mute);
}
.mpf-wiz-rail-item.is-active .mpf-wiz-rail-n {
  background: var(--mp-teal);
  border-color: var(--mp-teal);
  color: #fff;
}
.mpf-wiz-rail-item.is-done .mpf-wiz-rail-n {
  background: rgba(251, 146, 60, 0.16);
  border-color: rgba(251, 146, 60, 0.45);
  color: var(--mp-teal);
}
.mpf-wiz-body {
  padding: 32px 36px;
  background: #fff;
  border: 1px solid var(--mp-line-strong);
  border-radius: 18px;
  box-shadow: 0 28px 60px -32px rgba(234, 88, 12, 0.30);
}
.mpf-wiz-body-inner { display: flex; flex-direction: column; gap: 4px; }

/* fields */
.mpf-fld-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.mpf-fld { display: flex; flex-direction: column; gap: 6px; }
.mpf-fld-l { font-size: 12.5px; font-weight: 600; color: var(--mp-ink-2); letter-spacing: 0.02em; }
.mpf-fld input,
.mpf-fld select {
  padding: 11px 14px;
  font-size: 14px; color: var(--mp-ink);
  background: #fff;
  border: 1px solid var(--mp-line-strong);
  border-radius: 10px;
  outline: none; font-family: inherit;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.mpf-fld input:focus,
.mpf-fld select:focus {
  border-color: var(--mp-teal);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.18);
}
.mpf-fld-help {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 11px; color: var(--mp-mute);
}
.mpf-fld-row { display: flex; gap: 8px; }

/* documents */
.mpf-doc-grid { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.mpf-doc-row {
  display: grid; grid-template-columns: 22px 1fr auto;
  gap: 14px; align-items: center;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--mp-line-strong);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}
.mpf-doc-row.is-checked {
  background: rgba(251, 146, 60, 0.06);
  border-color: rgba(251, 146, 60, 0.45);
}
.mpf-doc-row input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 18px; height: 18px;
  border: 1.5px solid var(--mp-line-strong);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  position: relative;
  margin: 0;
}
.mpf-doc-row input[type="checkbox"]:checked {
  background: var(--mp-teal);
  border-color: var(--mp-teal);
}
.mpf-doc-row input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 5px; height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.mpf-doc-l { font-size: 14.5px; font-weight: 600; color: var(--mp-ink); margin-bottom: 4px; }
.mpf-doc-b { font-size: 12.5px; line-height: 1.5; color: var(--mp-ink-2); }
.mpf-doc-up {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.18em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
  padding: 6px 12px;
  background: rgba(234, 88, 12, 0.10);
  border: 1px solid var(--mp-line-strong);
  border-radius: 999px;
}

/* review */
.mpf-review {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 14px; margin-top: 8px; margin-bottom: 18px;
}
.mpf-rev-block {
  padding: 16px 18px;
  background: rgba(234, 88, 12, 0.04);
  border: 1px solid var(--mp-line);
  border-radius: 12px;
}
.mpf-rev-block-h {
  font-family: 'SF Mono', Menlo, 'JetBrains Mono', Consolas, monospace;
  font-size: 10.5px; letter-spacing: 0.22em; font-weight: 700;
  color: var(--mp-teal); text-transform: uppercase;
  margin-bottom: 10px;
}
.mpf-rev-row {
  display: grid; grid-template-columns: 110px 1fr;
  gap: 14px; padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px dashed var(--mp-line);
}
.mpf-rev-row:last-child { border-bottom: none; }
.mpf-rev-k { color: var(--mp-mute); }
.mpf-rev-v { color: var(--mp-ink); font-weight: 500; font-variant-numeric: tabular-nums; }

/* sign */
.mpf-sign {
  margin-top: 16px;
  padding-top: 18px;
  border-top: 1px dashed var(--mp-line);
  display: flex; flex-direction: column; gap: 14px;
}
.mpf-co-checkbox {
  display: grid; grid-template-columns: 22px 1fr;
  gap: 10px; align-items: start;
  font-size: 13px; line-height: 1.5; color: var(--mp-ink-2);
  cursor: pointer;
}
.mpf-co-checkbox input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 18px; height: 18px;
  border: 1.5px solid var(--mp-line-strong);
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  position: relative;
  margin-top: 2px;
}
.mpf-co-checkbox input[type="checkbox"]:checked {
  background: var(--mp-teal);
  border-color: var(--mp-teal);
}
.mpf-co-checkbox input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 5px; top: 1px;
  width: 5px; height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* wizard actions */
.mpf-wiz-actions {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--mp-line);
}

/* buttons */
.mpf-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 22px;
  background: linear-gradient(135deg, var(--mp-teal) 0%, var(--mp-teal-2) 100%);
  color: #fff;
  font-size: 14px; font-weight: 600;
  border-radius: 999px;
  border: 0; cursor: pointer;
  box-shadow: 0 12px 24px -8px rgba(234, 88, 12, 0.45);
  transition: transform .15s ease, box-shadow .15s ease;
}
.mpf-btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -8px rgba(234, 88, 12, 0.55);
}
.mpf-btn-lg { padding: 14px 28px; font-size: 15px; }
.mpf-btn-primary.is-disabled,
.mpf-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.mpf-btn-ghost {
  padding: 12px 22px;
  background: transparent;
  border: 1px solid var(--mp-line-strong);
  border-radius: 999px;
  color: var(--mp-ink);
  font-size: 14px; font-weight: 500;
  cursor: pointer;
}
.mpf-btn-ghost:hover:not(:disabled) {
  background: rgba(234, 88, 12, 0.06);
  border-color: var(--mp-teal);
}
.mpf-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

/* footer */
.mpf-footer {
  margin-top: 64px;
  padding: 32px 0;
  border-top: 1px solid var(--mp-line);
  background: rgba(255, 255, 255, 0.6);
}
.mpf-footer-inner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
}
.mpf-footer-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: 13.5px; color: var(--mp-ink-2); font-weight: 500;
}
.mpf-footer-meta { font-size: 12px; color: var(--mp-mute); text-align: right; }

@media (max-width: 980px) {
  .mpf-wiz { grid-template-columns: 1fr; }
  .mpf-wiz-rail { position: static; flex-direction: row; flex-wrap: wrap; }
  .mpf-fld-grid { grid-template-columns: 1fr; }
  .mpf-review { grid-template-columns: 1fr; }
  .mpf-footer-inner { flex-direction: column; align-items: flex-start; gap: 12px; text-align: left; }
  .mpf-footer-meta { text-align: left; }
}
`;
