/**
 * MedPay · Onboarding · Lender marketplace setup
 *   /medpay/onboarding/lender-marketplace
 *
 * Internal form the practice owner fills in so the MedPay underwriting
 * team can submit them to the right panel of lenders. This is what NEXUS
 * (module 04 on the onboarding hub) hands them off to.
 *
 * Form sections:
 *   1. Practice profile  · name, type, monthly volume
 *   2. Ticket sizing     · average + max ticket, treatment categories
 *   3. Lender preferences· APR ceiling, term preferences, BNPL on/off
 *   4. Existing relationships · any lenders already approving you
 *   5. Submit            · saves + emails the launch team
 *
 * Submit POSTs to /api/medpay/lender-setup (stub for now · launch team
 * picks up via email until the underwriting workflow is wired).
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const TREATMENT_CATEGORIES = [
  'Cosmetic dentistry',
  'Orthodontics',
  'Dental implants',
  'Aesthetic injectables',
  'Body contouring',
  'Laser / skin',
  'Hair restoration',
  'Plastic surgery',
  'Vision / LASIK',
  'Fertility',
  'Veterinary',
  'Other',
] as const;

const PRACTICE_TYPES = [
  'Med spa',
  'Aesthetic clinic',
  'Cosmetic dental',
  'General dental',
  'Plastic surgery',
  'Hair restoration',
  'Vision / LASIK',
  'Fertility',
  'Veterinary',
  'Multi-specialty',
  'Other',
] as const;

const MONTHLY_VOLUME_BANDS = [
  '< $50k',
  '$50k – $150k',
  '$150k – $500k',
  '$500k – $1M',
  '$1M – $5M',
  '$5M+',
] as const;

const TERM_PREFS = ['12 mo', '24 mo', '36 mo', '48 mo', '60 mo', '72 mo'] as const;

export default function LenderMarketplaceSetup(): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      // multi-value fields (checkboxes) collect into arrays
      if (payload[k] === undefined) payload[k] = v;
      else if (Array.isArray(payload[k])) (payload[k] as unknown[]).push(v);
      else payload[k] = [payload[k], v];
    });

    try {
      const r = await fetch('/api/medpay/lender-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`Save failed (${r.status})`);
      setDone(true);
    } catch (e) {
      // Fall back to email handoff if the API isn't wired yet · the
      // launch team picks up from the mailto.
      const mailto =
        'mailto:launch@eazepay.com' +
        '?subject=' +
        encodeURIComponent('MedPay · Lender marketplace setup') +
        '&body=' +
        encodeURIComponent(JSON.stringify(payload, null, 2));
      window.location.href = mailto;
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="lm-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lm-card lm-done">
          <div className="lm-pill">✓ Submitted</div>
          <h1 className="lm-h1">Your lender marketplace setup is in.</h1>
          <p className="lm-sub">
            Your underwriting file goes to the launch team. We submit you to the right panel of
            lenders and email you when each one approves you for traffic. Expected: 2&ndash;3
            business days.
          </p>
          <div className="lm-done-actions">
            <Link href="/medpay/onboarding" className="lm-btn lm-btn-primary">
              Back to onboarding
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="lm-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lm-shell">
        <Link href="/medpay/onboarding" className="lm-crumb">
          ← Onboarding
        </Link>
        <div className="lm-head">
          <div className="lm-pill">NEXUS · Module 04</div>
          <h1 className="lm-h1">Lender marketplace setup</h1>
          <p className="lm-sub">
            Tell us how your practice charges, the treatments you fund, and any lenders you already
            run. We use this to underwrite you with the right panel so NEXUS can quote them in
            parallel on every soft-pull.
          </p>
        </div>

        <form className="lm-form" onSubmit={onSubmit}>
          {/* 1. Practice profile */}
          <section className="lm-section">
            <h2 className="lm-h2">Practice profile</h2>
            <div className="lm-row">
              <label className="lm-field">
                <span>Practice / business name</span>
                <input
                  required
                  name="practiceName"
                  type="text"
                  placeholder="e.g. Glow Aesthetic Clinic"
                />
              </label>
              <label className="lm-field">
                <span>Contact email</span>
                <input required name="contactEmail" type="email" placeholder="you@practice.com" />
              </label>
            </div>
            <div className="lm-row">
              <label className="lm-field">
                <span>Practice type</span>
                <select required name="practiceType" defaultValue="">
                  <option value="" disabled>
                    Select one
                  </option>
                  {PRACTICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lm-field">
                <span>Monthly revenue (your practice)</span>
                <select required name="monthlyVolume" defaultValue="">
                  <option value="" disabled>
                    Select a band
                  </option>
                  {MONTHLY_VOLUME_BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* 2. Ticket sizing */}
          <section className="lm-section">
            <h2 className="lm-h2">Ticket sizing</h2>
            <div className="lm-row">
              <label className="lm-field">
                <span>Average ticket (USD)</span>
                <input required name="avgTicket" type="number" min="0" placeholder="e.g. 6500" />
              </label>
              <label className="lm-field">
                <span>Maximum ticket (USD)</span>
                <input required name="maxTicket" type="number" min="0" placeholder="e.g. 25000" />
              </label>
            </div>
            <div className="lm-field">
              <span>Treatment categories you want funded</span>
              <div className="lm-chips">
                {TREATMENT_CATEGORIES.map((c) => (
                  <label key={c} className="lm-chip">
                    <input type="checkbox" name="treatmentCategories" value={c} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Lender preferences */}
          <section className="lm-section">
            <h2 className="lm-h2">Lender preferences</h2>
            <div className="lm-row">
              <label className="lm-field">
                <span>Max APR you&apos;re comfortable presenting (%)</span>
                <input
                  name="maxAPR"
                  type="number"
                  min="0"
                  max="36"
                  step="0.1"
                  placeholder="e.g. 17.9"
                />
              </label>
              <label className="lm-field">
                <span>Preferred terms</span>
                <div className="lm-chips lm-chips-inline">
                  {TERM_PREFS.map((t) => (
                    <label key={t} className="lm-chip">
                      <input type="checkbox" name="termPrefs" value={t} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </label>
            </div>
            <label className="lm-field lm-toggle">
              <input type="checkbox" name="includeBNPL" defaultChecked />
              <span>Include short-term BNPL (Klarna · Affirm) for sub-$2k tickets</span>
            </label>
          </section>

          {/* 4. Existing lender relationships */}
          <section className="lm-section">
            <h2 className="lm-h2">Existing lender relationships</h2>
            <p className="lm-helper">
              Already approved with any of the major patient-financing lenders? List them so we can
              prioritise the panel and avoid duplicate underwriting.
            </p>
            <label className="lm-field">
              <textarea
                name="existingLenders"
                rows={3}
                placeholder="e.g. CareCredit (active), Cherry (approved · not used), Sunbit (pending)"
              />
            </label>
          </section>

          {/* 5. Notes + submit */}
          <section className="lm-section">
            <h2 className="lm-h2">Anything else we should know?</h2>
            <label className="lm-field">
              <textarea
                name="notes"
                rows={3}
                placeholder="Edge cases, packages we should know about, soft-launch goals, etc."
              />
            </label>
          </section>

          {err ? <div className="lm-err">{err}</div> : null}

          <div className="lm-actions">
            <Link href="/medpay/onboarding" className="lm-btn lm-btn-ghost">
              Save &amp; close
            </Link>
            <button type="submit" disabled={submitting} className="lm-btn lm-btn-primary">
              {submitting ? 'Submitting…' : 'Submit for underwriting'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

/* ---------- CSS (matches the MedPay onboarding hub) ---------- */
const CSS = `
:root {
  --lm-bg: #0a0a14;
  --lm-ink: #e6efeb;
  --lm-ink-2: rgba(230, 239, 235, 0.66);
  --lm-ink-3: rgba(230, 239, 235, 0.46);
  --lm-line: rgba(255, 255, 255, 0.10);
  --lm-line-strong: rgba(255, 255, 255, 0.18);
  --lm-brand: #22B8A0;
  --lm-brand-2: #0E7C66;
}

.lm-root {
  min-height: 100vh;
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, rgba(14, 124, 102, 0.22), transparent 60%),
    radial-gradient(ellipse 60% 50% at 50% 100%, rgba(34, 184, 160, 0.14), transparent 55%),
    var(--lm-bg);
  color: var(--lm-ink);
  padding: 48px 24px 80px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.lm-shell {
  max-width: 760px;
  margin: 0 auto;
}
.lm-crumb {
  display: inline-block;
  margin-bottom: 14px;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--lm-ink-2);
  text-decoration: none;
}
.lm-crumb:hover { color: var(--lm-brand); }

.lm-head { margin-bottom: 32px; }
.lm-pill {
  display: inline-block;
  padding: 5px 11px;
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--lm-brand);
  background: rgba(34, 184, 160, 0.12);
  border: 1px solid rgba(34, 184, 160, 0.40);
  border-radius: 999px;
  text-transform: uppercase;
}
.lm-h1 {
  margin: 14px 0 8px;
  font-size: 38px; font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.1;
  color: #fff;
}
.lm-sub {
  font-size: 16px;
  line-height: 1.55;
  color: var(--lm-ink-2);
  max-width: 620px;
}

.lm-form { display: flex; flex-direction: column; gap: 22px; }
.lm-section {
  padding: 22px 24px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid var(--lm-line);
  border-radius: 18px;
  backdrop-filter: blur(14px);
}
.lm-h2 {
  margin: 0 0 16px;
  font-size: 17px; font-weight: 700;
  letter-spacing: -0.005em;
  color: #fff;
}
.lm-helper {
  margin: -8px 0 14px;
  font-size: 13px;
  color: var(--lm-ink-3);
}
.lm-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.lm-row:last-child { margin-bottom: 0; }
.lm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lm-field > span {
  font-size: 13px;
  font-weight: 600;
  color: var(--lm-ink);
  letter-spacing: -0.005em;
}
.lm-field input[type="text"],
.lm-field input[type="email"],
.lm-field input[type="number"],
.lm-field select,
.lm-field textarea {
  width: 100%;
  padding: 11px 13px;
  font: inherit;
  color: var(--lm-ink);
  background: rgba(0, 0, 0, 0.30);
  border: 1px solid var(--lm-line-strong);
  border-radius: 10px;
  font-size: 14px;
}
.lm-field input:focus,
.lm-field select:focus,
.lm-field textarea:focus {
  outline: none;
  border-color: var(--lm-brand);
  box-shadow: 0 0 0 3px rgba(34, 184, 160, 0.20);
}
.lm-field textarea {
  resize: vertical;
  min-height: 70px;
  line-height: 1.5;
}
.lm-toggle {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.20);
  border: 1px solid var(--lm-line);
  border-radius: 10px;
  cursor: pointer;
}
.lm-toggle input { accent-color: var(--lm-brand); width: 16px; height: 16px; }
.lm-toggle span { font-weight: 500; color: var(--lm-ink); }

.lm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lm-chips-inline { padding-top: 4px; }
.lm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 13px;
  font-size: 13px;
  font-weight: 600;
  color: var(--lm-ink);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--lm-line);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
}
.lm-chip:hover { border-color: var(--lm-line-strong); }
.lm-chip input { accent-color: var(--lm-brand); width: 14px; height: 14px; }
.lm-chip:has(input:checked) {
  color: var(--lm-brand);
  background: rgba(34, 184, 160, 0.14);
  border-color: rgba(34, 184, 160, 0.50);
}

.lm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;
}
.lm-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.005em;
  text-decoration: none;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
}
.lm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.lm-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, #0e7c66, #22B8A0);
  box-shadow: 0 14px 28px -10px rgba(34, 184, 160, 0.50);
}
.lm-btn-primary:hover { transform: translateY(-1px); }
.lm-btn-ghost {
  color: var(--lm-ink);
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--lm-line-strong);
}
.lm-btn-ghost:hover { background: rgba(255, 255, 255, 0.08); }

.lm-err {
  padding: 12px 14px;
  font-size: 13px;
  color: rgba(248, 113, 113, 0.95);
  background: rgba(248, 113, 113, 0.10);
  border: 1px solid rgba(248, 113, 113, 0.30);
  border-radius: 10px;
}

/* done state */
.lm-card {
  max-width: 580px;
  margin: 60px auto;
  padding: 36px 32px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(34, 184, 160, 0.40);
  border-radius: 22px;
  text-align: center;
  backdrop-filter: blur(14px);
}
.lm-done-actions {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

@media (max-width: 640px) {
  .lm-row { grid-template-columns: 1fr; }
  .lm-h1 { font-size: 28px; }
}
`;
